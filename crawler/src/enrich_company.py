import argparse
import asyncio
import sqlite3
from pathlib import Path
from typing import Iterable

import httpx
from pydantic import BaseModel, TypeAdapter
from tqdm import tqdm

from src.domains import Company
from src.enrichers.company import CompanyEnricher
from src.result import Result

DEFAULT_TIMEOUT_SECONDS = 3.0
DEFAULT_CONCURRENCY = 20
DEFAULT_BATCH_SIZE = 100
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
    website_url があり、logo_url / industry / description が未設定の企業を逐次返す。
    recompute_all の場合は website_url がある全件を返す。
    """
    where_clause = (
        """
        website_url IS NOT NULL
          AND TRIM(website_url) != ''
          AND (
            (logo_url IS NULL OR TRIM(logo_url) = '')
            OR (industry IS NULL OR TRIM(industry) = '')
            OR (description IS NULL OR TRIM(description) = '')
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
            OR (description IS NULL OR TRIM(description) = '')
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
    description: str | None,
    recompute_all: bool,
    *,
    commit: bool = True,
) -> Result[None, Exception]:
    """logo_url / industry / description を 1 件ずつ更新する。"""
    try:
        if recompute_all:
            conn.execute(
                """
                UPDATE companies
                SET
                  logo_url = ?,
                  industry = ?,
                  description = ?
                WHERE id = ?
                """,
                (logo_url, industry, description, company_id),
            )
        else:
            conn.execute(
                """
                UPDATE companies
                SET
                  logo_url = COALESCE(?, logo_url),
                  industry = COALESCE(?, industry),
                  description = COALESCE(?, description)
                WHERE id = ?
                """,
                (logo_url, industry, description, company_id),
            )
        if commit:
            conn.commit()
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


async def _writer(
    queue: "asyncio.Queue[UpdatePayload | None]",
    conn: sqlite3.Connection,
    recompute_all: bool,
    batch_size: int,
) -> Result[int, Exception]:
    """Queue から取得した更新をまとめて commit する。"""
    updated = 0
    pending_since_commit = 0
    try:
        while True:
            item = await queue.get()
            if item is None:
                break

            update_result = update_company(
                conn,
                item.company_id,
                item.logo_url,
                item.industry,
                item.description,
                recompute_all=recompute_all,
                commit=False,
            )
            if update_result.is_err():
                return Result.err(update_result.unwrap_err())

            updated += 1
            pending_since_commit += 1
            if pending_since_commit >= batch_size:
                conn.commit()
                pending_since_commit = 0

        if pending_since_commit:
            conn.commit()
        return Result.ok(updated)
    except Exception as exc:
        return Result.err(exc)


async def run_async(
    db_path: Path, recompute_all: bool = False, concurrency: int = DEFAULT_CONCURRENCY
) -> Result[int, Exception]:
    """
    DB から企業を取得し、favicon / meta description / 業種を並列で探索して DB にバッチ書き戻しする。
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
        companies = list(iter_companies(conn, only_missing=only_missing))
        total = len(companies)
        if total == 0:
            return Result.ok(0)

        errors: list[tuple[str, str]] = []
        queue: asyncio.Queue[UpdatePayload | None] = asyncio.Queue()
        writer_task = asyncio.create_task(
            _writer(
                queue,
                conn,
                recompute_all=recompute_all,
                batch_size=DEFAULT_BATCH_SIZE,
            )
        )
        writer_result: Result[int, Exception] | None = None
        processing_error: Exception | None = None

        try:
            timeout = httpx.Timeout(DEFAULT_TIMEOUT_SECONDS)
            limits = httpx.Limits(
                max_connections=concurrency,
                max_keepalive_connections=concurrency,
            )
            async with httpx.AsyncClient(
                timeout=timeout,
                headers={"User-Agent": "jordan-crawler/0.1"},
                limits=limits,
            ) as client:
                enricher = CompanyEnricher(client, recompute_all=recompute_all)
                semaphore = asyncio.Semaphore(max(1, concurrency))
                progress = tqdm(total=total, desc="enriching companies")

                async def _process_company(
                    company: Company,
                ) -> Result[UpdatePayload | None, Exception]:
                    async with semaphore:
                        try:
                            enriched_result = await enricher.enrich(company)
                            if enriched_result.is_err():
                                errors.append(
                                    (company.name or "", str(enriched_result.unwrap_err()))
                                )
                                return Result.ok(None)

                            enriched = enriched_result.unwrap()
                            payload = UpdatePayload(
                                company_id=company.id,
                                logo_url=enriched.logo_url,
                                industry=enriched.industry,
                                description=enriched.description,
                            )
                            try:
                                await queue.put(payload)
                            except Exception as exc:
                                return Result.err(exc)
                            return Result.ok(payload)
                        except Exception as exc:
                            errors.append((company.name or "", str(exc)))
                            return Result.err(exc)
                        finally:
                            progress.update(1)

                tasks = [asyncio.create_task(_process_company(company)) for company in companies]
                for task in asyncio.as_completed(tasks):
                    task_result = await task
                    if task_result.is_err() and not processing_error:
                        processing_error = task_result.unwrap_err()
                progress.close()
        except Exception as exc:
            processing_error = exc
        finally:
            await queue.put(None)
            writer_result = await writer_task

        if processing_error:
            return Result.err(processing_error)
        if writer_result is not None and writer_result.is_err():
            return Result.err(writer_result.unwrap_err())

        updated = writer_result.unwrap() if writer_result is not None else 0
        if errors:
            print(f"Processed with {len(errors)} errors:")
            for name, message in errors:
                prefix = f"[{name}]" if name else "[unknown]"
                print(f"{prefix} {message}")
        return Result.ok(updated)
    finally:
        conn.close()


def run(
    db_path: Path, recompute_all: bool = False
) -> Result[int, Exception]:
    """同期 API として async 実装をラップする。"""
    return asyncio.run(run_async(db_path, recompute_all=recompute_all))


class Args(BaseModel):
    db: Path = DEFAULT_DB_PATH
    recompute_all: bool = False


class UpdatePayload(BaseModel):
    """DB 更新用キューに積むメッセージ。"""

    company_id: str
    logo_url: str | None
    industry: str | None
    description: str | None

def _parse_args() -> Args:
    """CLI 引数を解釈する。"""
    parser = argparse.ArgumentParser(
        description=(
            "Fetch favicon URLs, meta descriptions, and classify industry for "
            "companies using website_url in SQLite."
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
            "既存の logo_url / description / industry が入っていても再計算して上書きします"
            "（デフォルトは未設定のみ更新）。"
        ),
    )
    parsed_args = parser.parse_args()
    return TypeAdapter(Args).validate_python(vars(parsed_args))


def main() -> None:
    args = _parse_args()

    result = run(args.db, recompute_all=args.recompute_all)
    if result.is_err():
        error = result.unwrap_err()
        print(f"Error: {error}")
        raise SystemExit(1)

    updated = result.unwrap()
    print(f"Updated {updated} companies (logo_url / description / industry).")


if __name__ == "__main__":
    main()
