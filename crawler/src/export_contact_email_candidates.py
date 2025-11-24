from __future__ import annotations

import argparse
import csv
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

from pydantic import BaseModel, TypeAdapter

from src.enrichers.domain import PATTERN_BUILDERS
from src.result import Result

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "jordan.sqlite"
DEFAULT_OUTPUT_PATH = Path(__file__).resolve().parents[1] / "contact_email_candidates.csv"
FALLBACK_PATTERNS: Sequence[str] = (
    "f-last",
    "last",
    "first.last",
    "last.first",
    "first-last",
    "last-first",
    "first_last",
    "last_first",
    "firstlast",
    "lastfirst",
    "f.last",
    "f_last",
    "flast",
)


class Args(BaseModel):
    db: Path = DEFAULT_DB_PATH
    output: Path = DEFAULT_OUTPUT_PATH
    skip_if_email_exists: bool = False


@dataclass
class CompanyRecord:
    id: str
    name: str
    primary_domain_id: str | None


@dataclass
class DomainRecord:
    id: str
    company_id: str
    domain: str
    pattern: str | None


@dataclass
class ContactRecord:
    id: str
    company_id: str
    full_name: str
    first_name: str | None
    last_name: str | None
    position: str | None
    department: str | None
    city: str | None
    linkedin_url: str | None
    source_label: str | None
    source_url: str | None


@dataclass
class CandidateRow:
    company_id: str
    company_name: str
    contact_id: str
    full_name: str
    first_name: str | None
    last_name: str | None
    position: str | None
    department: str | None
    city: str | None
    linkedin_url: str | None
    source_label: str | None
    source_url: str | None
    domain: str | None
    pattern: str | None
    email_candidate: str | None

    def to_csv(self) -> dict[str, str | None]:
        return {
            "company_id": self.company_id,
            "company_name": self.company_name,
            "contact_id": self.contact_id,
            "full_name": self.full_name,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "position": self.position,
            "department": self.department,
            "city": self.city,
            "linkedin_url": self.linkedin_url,
            "source_label": self.source_label,
            "source_url": self.source_url,
            "domain": self.domain,
            "pattern": self.pattern,
            "email_candidate": self.email_candidate,
        }


def _parse_args() -> Args:
    """CLI 引数を解釈し、Args モデルでバリデーションする。"""
    parser = argparse.ArgumentParser(
        description="Generate expected email addresses for contacts and export them as CSV."
    )
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH, help="Path to SQLite DB")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Where to write the CSV (default: crawler/contact_email_candidates.csv)",
    )
    parser.add_argument(
        "--skip-if-email-exists",
        action="store_true",
        help="Ignore contacts that already have at least one email row.",
    )
    parsed = parser.parse_args()
    args = TypeAdapter(Args).validate_python(vars(parsed))
    return args


def _connect(db_path: Path) -> Result[sqlite3.Connection, Exception]:
    """Row factory を有効にした SQLite 接続を開く。"""
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return Result.ok(conn)
    except Exception as exc:
        return Result.err(exc)


def _load_companies(conn: sqlite3.Connection) -> Result[dict[str, CompanyRecord], Exception]:
    """企業 ID をキーに名前と primary_domain_id を取得する。"""
    try:
        cursor = conn.execute("SELECT id, name, primary_domain_id FROM companies")
        mapping: dict[str, CompanyRecord] = {}
        for row in cursor:
            company_id = str(row["id"])
            primary_domain_id = row["primary_domain_id"]
            mapping[company_id] = CompanyRecord(
                id=company_id,
                name=row["name"],
                primary_domain_id=str(primary_domain_id) if primary_domain_id is not None else None,
            )
        return Result.ok(mapping)
    except Exception as exc:
        return Result.err(exc)


def _load_domains(
    conn: sqlite3.Connection,
) -> Result[tuple[dict[str, DomainRecord], dict[str, list[DomainRecord]]], Exception]:
    """ドメインを ID 単位と企業単位の双方で参照できるよう読み込む。"""
    try:
        cursor = conn.execute("SELECT id, company_id, domain, pattern FROM domains ORDER BY id")
        domain_by_id: dict[str, DomainRecord] = {}
        domains_by_company: dict[str, list[DomainRecord]] = {}
        for row in cursor:
            record = DomainRecord(
                id=str(row["id"]),
                company_id=str(row["company_id"]),
                domain=row["domain"],
                pattern=row["pattern"],
            )
            domain_by_id[record.id] = record
            domains_by_company.setdefault(record.company_id, []).append(record)
        return Result.ok((domain_by_id, domains_by_company))
    except Exception as exc:
        return Result.err(exc)


def _load_contacts(conn: sqlite3.Connection) -> Result[list[ContactRecord], Exception]:
    """エクスポートに必要なメタ情報付きで contacts を全件読み込む。"""
    try:
        cursor = conn.execute(
            """
            SELECT
                id,
                company_id,
                full_name,
                first_name,
                last_name,
                position,
                department,
                city,
                linkedin_url,
                source_label,
                source_url
            FROM contacts
            ORDER BY company_id, id
            """
        )
        contacts: list[ContactRecord] = []
        for row in cursor:
            contacts.append(
                ContactRecord(
                    id=str(row["id"]),
                    company_id=str(row["company_id"]),
                    full_name=row["full_name"],
                    first_name=row["first_name"],
                    last_name=row["last_name"],
                    position=row["position"],
                    department=row["department"],
                    city=row["city"],
                    linkedin_url=row["linkedin_url"],
                    source_label=row["source_label"],
                    source_url=row["source_url"],
                )
            )
        return Result.ok(contacts)
    except Exception as exc:
        return Result.err(exc)


def _load_contacts_with_emails(conn: sqlite3.Connection) -> Result[set[str], Exception]:
    """emails テーブルに紐づく contact_id の集合を返す。"""
    try:
        cursor = conn.execute("SELECT DISTINCT contact_id FROM emails WHERE contact_id IS NOT NULL")
        contact_ids = {str(row["contact_id"]) for row in cursor}
        return Result.ok(contact_ids)
    except sqlite3.OperationalError:
        # emails テーブルが無い環境でも動かしたいので握りつぶす
        return Result.ok(set())
    except Exception as exc:
        return Result.err(exc)


def _select_company_domain(
    companies: dict[str, CompanyRecord],
    domain_by_id: dict[str, DomainRecord],
    domains_by_company: dict[str, list[DomainRecord]],
) -> dict[str, DomainRecord | None]:
    """primary_domain_id を優先して各企業の代表ドメインを選ぶ。"""
    selected: dict[str, DomainRecord | None] = {}
    for company_id, company in companies.items():
        domain: DomainRecord | None = None
        if company.primary_domain_id:
            domain = domain_by_id.get(company.primary_domain_id)
        if domain is None:
            domain_list = domains_by_company.get(company_id)
            if domain_list:
                domain = domain_list[0]
        selected[company_id] = domain
    return selected


def _normalize_name_token(token: str | None) -> str | None:
    """パターン生成に使う英数字のみ残した小文字トークンを作る。"""
    if not token:
        return None
    normalized = "".join(ch for ch in token.strip().lower() if ch.isascii())
    filtered = "".join(ch for ch in normalized if ch.isalnum())
    return filtered or None


def _build_local(pattern: str, first: str | None, last: str | None) -> str | None:
    """指定パターンに沿って local-part を構築する。"""
    builder = PATTERN_BUILDERS.get(pattern)
    if builder is None:
        return None

    needs_first = "first" in pattern or pattern.startswith("f")
    needs_last = "last" in pattern
    if needs_first and not first:
        return None
    if needs_last and not last:
        return None

    try:
        return builder(first or "", last or "")
    except Exception:
        return None


def _generate_candidates(
    domain_value: str | None,
    pattern: str | None,
    first_name: str | None,
    last_name: str | None,
) -> list[str]:
    """ドメイン・パターン情報からユニークなメール候補を作る。"""
    if not domain_value:
        return []

    first = _normalize_name_token(first_name)
    last = _normalize_name_token(last_name)
    patterns: Iterable[str]
    if pattern and pattern in PATTERN_BUILDERS:
        patterns = (pattern,)
    else:
        patterns = FALLBACK_PATTERNS

    candidates: list[str] = []
    seen: set[str] = set()
    for pattern_name in patterns:
        local = _build_local(pattern_name, first, last)
        if not local:
            continue
        email = f"{local}@{domain_value}"
        if email in seen:
            continue
        candidates.append(email)
        seen.add(email)
    return candidates


def _build_candidate_rows(
    contacts: list[ContactRecord],
    companies: dict[str, CompanyRecord],
    company_domains: dict[str, DomainRecord | None],
    skip_contact_ids: set[str],
) -> list[CandidateRow]:
    """候補ごとに 1 行のレコードを作成し CSV に渡す。"""
    rows: list[CandidateRow] = []
    for contact in contacts:
        if skip_contact_ids and contact.id in skip_contact_ids:
            continue

        company = companies.get(contact.company_id)
        if company is None:
            continue

        domain_record = company_domains.get(contact.company_id)
        domain_value = domain_record.domain if domain_record else None
        pattern_value = domain_record.pattern if domain_record else None
        candidate_emails = _generate_candidates(
            domain_value,
            pattern_value,
            contact.first_name,
            contact.last_name,
        )

        if not candidate_emails:
            rows.append(
                CandidateRow(
                    company_id=contact.company_id,
                    company_name=company.name,
                    contact_id=contact.id,
                    full_name=contact.full_name,
                    first_name=contact.first_name,
                    last_name=contact.last_name,
                    position=contact.position,
                    department=contact.department,
                    city=contact.city,
                    linkedin_url=contact.linkedin_url,
                    source_label=contact.source_label,
                    source_url=contact.source_url,
                    domain=domain_value,
                    pattern=pattern_value,
                    email_candidate=None,
                )
            )
            continue

        for candidate_email in candidate_emails:
            rows.append(
                CandidateRow(
                    company_id=contact.company_id,
                    company_name=company.name,
                    contact_id=contact.id,
                    full_name=contact.full_name,
                    first_name=contact.first_name,
                    last_name=contact.last_name,
                    position=contact.position,
                    department=contact.department,
                    city=contact.city,
                    linkedin_url=contact.linkedin_url,
                    source_label=contact.source_label,
                    source_url=contact.source_url,
                    domain=domain_value,
                    pattern=pattern_value,
                    email_candidate=candidate_email,
                )
            )
    return rows


def export_candidates(args: Args) -> Result[int, Exception]:
    """CLI/テストの共通エントリーポイント。CSV を書き出し件数を返す。"""
    conn_result = _connect(args.db)
    if conn_result.is_err():
        return Result.err(conn_result.unwrap_err())
    conn = conn_result.unwrap()

    try:
        companies_result = _load_companies(conn)
        if companies_result.is_err():
            return Result.err(companies_result.unwrap_err())
        companies = companies_result.unwrap()

        domains_result = _load_domains(conn)
        if domains_result.is_err():
            return Result.err(domains_result.unwrap_err())
        domain_by_id, domains_by_company = domains_result.unwrap()

        contacts_result = _load_contacts(conn)
        if contacts_result.is_err():
            return Result.err(contacts_result.unwrap_err())
        contacts = contacts_result.unwrap()

        skip_ids: set[str] = set()
        if args.skip_if_email_exists:
            skip_result = _load_contacts_with_emails(conn)
            if skip_result.is_err():
                return Result.err(skip_result.unwrap_err())
            skip_ids = skip_result.unwrap()

        company_domains = _select_company_domain(companies, domain_by_id, domains_by_company)

    finally:
        conn.close()

    rows = _build_candidate_rows(
        contacts=contacts,
        companies=companies,
        company_domains=company_domains,
        skip_contact_ids=skip_ids,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "company_id",
        "company_name",
        "contact_id",
        "full_name",
        "first_name",
        "last_name",
        "position",
        "department",
        "city",
        "linkedin_url",
        "source_label",
        "source_url",
        "domain",
        "pattern",
        "email_candidate",
    ]
    try:
        with args.output.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            for row in rows:
                writer.writerow(row.to_csv())
    except Exception as exc:
        return Result.err(exc)

    return Result.ok(len(rows))


def main() -> None:
    args = _parse_args()
    result = export_candidates(args)
    if result.is_err():
        raise SystemExit(f"[export_contact_email_candidates] {result.unwrap_err()}")
    count = result.unwrap()
    print(f"Wrote {count} rows to {args.output}")


if __name__ == "__main__":
    main()
