import argparse
import sqlite3
from pathlib import Path
from typing import Iterable

import pydantic
import httpx
from tqdm import tqdm

from src.domains import Company
from src.enrichers.company import CompanyEnricher
from src.result import Result

DEFAULT_TIMEOUT_SECONDS = 3.0
DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "jordan.sqlite"


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


def ensure_industry_column(conn: sqlite3.Connection) -> Result[None, Exception]:
    """industry カラムが存在しない場合は追加する。"""
    try:
        columns = conn.execute("PRAGMA table_info(companies)").fetchall()
        has_column = any(col[1] == "industry" for col in columns)
        if not has_column:
            conn.execute("ALTER TABLE companies ADD COLUMN industry TEXT")
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def iter_companies(
    conn: sqlite3.Connection, only_missing: bool = True
) -> Iterable[Company]:
    """
    website_url があり、logo_url / industry が未設定の企業を逐次返す。
    recompute_all の場合は website_url がある全件を返す。
    """
    where_clause = (
        """
        website_url IS NOT NULL
          AND TRIM(website_url) != ''
          AND (
            (logo_url IS NULL OR TRIM(logo_url) = '')
            OR (industry IS NULL OR TRIM(industry) = '')
          )
        """
        if only_missing
        else """
        website_url IS NOT NULL
          AND TRIM(website_url) != ''
        """
    )
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
        WHERE {where_clause}
        ORDER BY id
        """.format(where_clause=where_clause)
    )
    for row in cursor:
        yield Company.model_validate(dict(row))


def count_pending(conn: sqlite3.Connection, only_missing: bool = True) -> int:
    """処理対象の件数を返す。"""
    where_clause = (
        """
        website_url IS NOT NULL
          AND TRIM(website_url) != ''
          AND (
            (logo_url IS NULL OR TRIM(logo_url) = '')
            OR (industry IS NULL OR TRIM(industry) = '')
          )
        """
        if only_missing
        else """
        website_url IS NOT NULL
          AND TRIM(website_url) != ''
        """
    )
    row = conn.execute(
        f"""
        SELECT COUNT(*) AS cnt
        FROM companies
        WHERE {where_clause}
        """
    ).fetchone()
    return int(row["cnt"]) if row and "cnt" in row.keys() else 0


def update_company(
    conn: sqlite3.Connection,
    company_id: str,
    logo_url: str | None,
    industry: str | None,
    recompute_all: bool,
) -> Result[None, Exception]:
    """logo_url と industry を 1 件ずつ更新する。"""
    try:
        if recompute_all:
            conn.execute(
                """
                UPDATE companies
                SET
                  logo_url = ?,
                  industry = ?
                WHERE id = ?
                """,
                (logo_url, industry, company_id),
            )
        else:
            conn.execute(
                """
                UPDATE companies
                SET
                  logo_url = COALESCE(?, logo_url),
                  industry = COALESCE(?, industry)
                WHERE id = ?
                """,
                (logo_url, industry, company_id),
            )
        conn.commit()
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def run(
    db_path: Path, recompute_all: bool = False
) -> Result[int, Exception]:
    """
    DB から企業を逐次取得し、favicon と業種を探索し次第 DB に書き戻す。
    """
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
    except Exception as exc:  # pragma: no cover - sqlite3 error is enough
        return Result.err(exc)

    ensure_result = ensure_logo_column(conn)
    if ensure_result.is_err():
        conn.close()
        return Result.err(ensure_result.unwrap_err())
    industry_result = ensure_industry_column(conn)
    if industry_result.is_err():
        conn.close()
        return Result.err(industry_result.unwrap_err())

    try:
        only_missing = not recompute_all
        total = count_pending(conn, only_missing=only_missing)
        updated = 0
        with httpx.Client(
            timeout=DEFAULT_TIMEOUT_SECONDS,
            headers={"User-Agent": "jordan-crawler/0.1"},
        ) as client:
            enricher = CompanyEnricher(client, recompute_all=recompute_all)
            progress = tqdm(
                iter_companies(conn, only_missing=only_missing),
                total=total,
                desc="enriching companies",
            )
            for company in progress:
                enriched_result = enricher.enrich(company)
                if enriched_result.is_err():
                    return Result.err(enriched_result.unwrap_err())

                enriched = enriched_result.unwrap()
                if not enriched.logo_url and not enriched.industry:
                    continue

                update_result = update_company(
                    conn,
                    company.id,
                    enriched.logo_url,
                    enriched.industry,
                    recompute_all=recompute_all,
                )
                if update_result.is_err():
                    return Result.err(update_result.unwrap_err())

                updated += 1
                progress.set_postfix(updated=updated, refresh=False)
        return Result.ok(updated)
    finally:
        conn.close()


class Args(pydantic.BaseModel):
    db: Path = DEFAULT_DB_PATH
    recompute_all: bool = False


def _parse_args() -> Args:
    """CLI 引数を解釈する。"""
    parser = argparse.ArgumentParser(
        description=(
            "Fetch favicon URLs and classify industry for companies using "
            "website_url in SQLite."
        )
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"Path to SQLite DB (default: {DEFAULT_DB_PATH})",
    )
    parser.add_argument(
        "--recompute-all",
        action="store_true",
        help=(
            "既存の logo_url / industry が入っていても再計算して上書きします"
            "（デフォルトは未設定のみ更新）。"
        ),
    )
    parsed_args = parser.parse_args()
    return Args.model_validate(vars(parsed_args))


def main() -> None:
    args = _parse_args()

    result = run(args.db, recompute_all=args.recompute_all)
    if result.is_err():
        error = result.unwrap_err()
        print(f"Error: {error}")
        raise SystemExit(1)

    updated = result.unwrap()
    print(f"Updated {updated} companies (logo_url / industry).")


if __name__ == "__main__":
    main()
