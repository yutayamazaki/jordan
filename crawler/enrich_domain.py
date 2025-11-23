from __future__ import annotations

import argparse
import sqlite3
import time
from pathlib import Path
from typing import Dict, List

from tqdm import tqdm

from enrichers.domain import DomainEnricher, EmailEntry
from src.domains import Domain
from src.result import Result

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "jordan.sqlite"


def load_emails_by_domain(
    conn: sqlite3.Connection,
) -> Result[Dict[str, List[EmailEntry]], Exception]:
    """emails と contacts を突き合わせ、verified_ok のみをドメインごとに集計する。"""
    try:
        cursor = conn.execute(
            """
            SELECT
                e.email,
                e.status,
                c.first_name,
                c.last_name
            FROM emails AS e
            INNER JOIN contacts AS c ON c.id = e.contact_id
            WHERE instr(e.email, '@') > 0
              AND e.status = 'verified_ok'
            """
        )
    except Exception as exc:  # pragma: no cover - sqlite3 error is enough
        return Result.err(exc)

    mapping: Dict[str, List[EmailEntry]] = {}
    for row in cursor:
        email = row["email"]
        try:
            local, domain = email.split("@", 1)
        except ValueError:
            continue

        entry = EmailEntry(
            local=local,
            first_name=row["first_name"],
            last_name=row["last_name"],
            status=row["status"],
        )
        mapping.setdefault(domain.lower(), []).append(entry)

    return Result.ok(mapping)


def load_domains(conn: sqlite3.Connection) -> Result[List[Domain], Exception]:
    """domains テーブルを全件ロードする。"""
    try:
        cursor = conn.execute(
            """
            SELECT
                id,
                company_id,
                domain,
                disposable,
                webmail,
                accept_all,
                pattern,
                first_seen_at,
                last_seen_at,
                created_at,
                updated_at
            FROM domains
            ORDER BY id
            """
        )
        domains = []
        for row in cursor:
            item = dict(row)
            item["id"] = str(row["id"])
            item["company_id"] = str(row["company_id"])
            domains.append(Domain.model_validate(item))
        return Result.ok(domains)
    except Exception as exc:  # pragma: no cover - sqlite3 error is enough
        return Result.err(exc)


def update_pattern(
    conn: sqlite3.Connection, domain_id: str, pattern: str
) -> Result[None, Exception]:
    """Domain.pattern を 1 件ずつ更新する。"""
    try:
        conn.execute(
            "UPDATE domains SET pattern = ?, updated_at = ? WHERE id = ?",
            (pattern, int(time.time()), domain_id),
        )
        conn.commit()
        return Result.ok(None)
    except Exception as exc:  # pragma: no cover - sqlite3 error is enough
        return Result.err(exc)


def run(db_path: Path) -> Result[int, Exception]:
    """既存のメールアドレスからパターンを推定し、domains.pattern を埋める。"""
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
    except Exception as exc:  # pragma: no cover - sqlite3 error is enough
        return Result.err(exc)

    try:
        email_result = load_emails_by_domain(conn)
        if email_result.is_err():
            return Result.err(email_result.unwrap_err())
        emails_by_domain = email_result.unwrap()

        domains_result = load_domains(conn)
        if domains_result.is_err():
            return Result.err(domains_result.unwrap_err())
        domains = domains_result.unwrap()

        targets = [domain for domain in domains if domain.domain.lower() in emails_by_domain]
        enricher = DomainEnricher(emails_by_domain)

        updated = 0
        progress = tqdm(targets, desc="updating domain patterns")
        for domain in progress:
            enriched_result = enricher.enrich(domain)
            if enriched_result.is_err():
                return Result.err(enriched_result.unwrap_err())

            enriched = enriched_result.unwrap()
            if not enriched.pattern:
                continue

            update_result = update_pattern(conn, enriched.id, enriched.pattern)
            if update_result.is_err():
                return Result.err(update_result.unwrap_err())

            updated += 1
            progress.set_postfix(pattern=enriched.pattern, updated=updated, refresh=False)

        return Result.ok(updated)
    finally:
        conn.close()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Update domains.pattern by voting existing emails."
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"Path to SQLite DB (default: {DEFAULT_DB_PATH})",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    result = run(args.db)
    if result.is_err():
        error = result.unwrap_err()
        print(f"Error: {error}")
        raise SystemExit(1)

    updated = result.unwrap()
    print(f"Updated {updated} domain patterns.")


if __name__ == "__main__":
    main()
