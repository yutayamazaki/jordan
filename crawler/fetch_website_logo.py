import argparse
import sqlite3
from pathlib import Path
from typing import Iterable

import httpx
from tqdm import tqdm

from enrichers.company import CompanyEnricher
from src.domains import Company
from src.result import Result

DEFAULT_TIMEOUT_SECONDS = 3.0


def ensure_logo_column(conn: sqlite3.Connection) -> Result[None, Exception]:
    """logo_url カラムが存在しない場合は追加する。"""
    try:
        columns = conn.execute("PRAGMA table_info(companies)").fetchall()
        has_logo = any(col[1] == "logo_url" for col in columns)
        if not has_logo:
            conn.execute("ALTER TABLE companies ADD COLUMN logo_url TEXT")
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def iter_companies(conn: sqlite3.Connection) -> Iterable[Company]:
    """website_url が空でなく、logo_url が未設定の企業を逐次返す。"""
    cursor = conn.execute(
        """
        SELECT
            id,
            name,
            website_url,
            logo_url,
            description,
            industry,
            country,
            city,
            employee_range,
            primary_domain_id,
            created_at,
            updated_at
        FROM companies
        WHERE website_url IS NOT NULL
          AND TRIM(website_url) != ''
          AND (logo_url IS NULL OR TRIM(logo_url) = '')
        ORDER BY id
        """
    )
    for row in cursor:
        yield Company.model_validate(dict(row))


def count_pending(conn: sqlite3.Connection) -> int:
    """処理対象の件数を返す。"""
    row = conn.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM companies
        WHERE website_url IS NOT NULL
          AND TRIM(website_url) != ''
          AND (logo_url IS NULL OR TRIM(logo_url) = '')
        """
    ).fetchone()
    return int(row["cnt"]) if row and "cnt" in row.keys() else 0


def update_logo(conn: sqlite3.Connection, company_id: str, logo_url: str) -> Result[None, Exception]:
    """logo_url を 1 件ずつ更新する。"""
    try:
        conn.execute(
            "UPDATE companies SET logo_url = ? WHERE id = ?",
            (logo_url, company_id),
        )
        conn.commit()
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def run(db_path: Path) -> Result[int, Exception]:
    """DB から企業を逐次取得し、favicon を探索し次第 DB に書き戻す。"""
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
    except Exception as exc:  # pragma: no cover - sqlite3 error is enough
        return Result.err(exc)

    ensure_result = ensure_logo_column(conn)
    if ensure_result.is_err():
        conn.close()
        return Result.err(ensure_result.unwrap_err())

    try:
        total = count_pending(conn)
        updated = 0
        with httpx.Client(
            timeout=DEFAULT_TIMEOUT_SECONDS,
            headers={"User-Agent": "jordan-crawler/0.1"},
        ) as client:
            enricher = CompanyEnricher(client)
            progress = tqdm(iter_companies(conn), total=total, desc="fetching favicons")
            for company in progress:
                enriched_result = enricher.enrich(company)
                if enriched_result.is_err():
                    return Result.err(enriched_result.unwrap_err())

                enriched = enriched_result.unwrap()
                if not enriched.logo_url:
                    continue

                update_result = update_logo(conn, company.id, enriched.logo_url)
                if update_result.is_err():
                    return Result.err(update_result.unwrap_err())

                updated += 1
                progress.set_postfix(updated=updated, refresh=False)
        return Result.ok(updated)
    finally:
        conn.close()


def _parse_args() -> argparse.Namespace:
    """CLI 引数を解釈する。"""
    parser = argparse.ArgumentParser(
        description="Fetch favicon URLs for companies using website_url in SQLite."
    )
    default_db = Path(__file__).resolve().parent.parent / "data" / "jordan.sqlite"
    parser.add_argument(
        "--db",
        type=Path,
        default=default_db,
        help=f"Path to SQLite DB (default: {default_db})",
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
    print(f"Updated {updated} company logo_url values.")


if __name__ == "__main__":
    main()
