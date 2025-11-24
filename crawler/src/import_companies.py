import argparse
import csv
import sqlite3
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Literal
from urllib.parse import urlsplit, urlunsplit

import httpx
from pydantic import BaseModel, Field, TypeAdapter

from src.result import Result

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "jordan.sqlite"
DEFAULT_BATCH_SIZE = 100


class CsvCompany(BaseModel):
    """CSV の 1 行を表す入力モデル。"""

    name: str
    domain: str
    website_url: str | None = Field(default=None, alias="website_url")
    city: str | None = None
    employee_range: str | None = None


class Args(BaseModel):
    csv: Path
    db: Path = DEFAULT_DB_PATH
    on_duplicate: Literal["skip", "update"] = "skip"
    batch_size: int = DEFAULT_BATCH_SIZE


@dataclass
class ImportStats:
    inserted_companies: int = 0
    inserted_domains: int = 0
    skipped_duplicates: int = 0
    updated_companies: int = 0
    failed_rows: int = 0


def _parse_args() -> Args:
    """CLI 引数を解釈する。"""
    parser = argparse.ArgumentParser(
        description="Import companies and domains from a CSV into SQLite."
    )
    parser.add_argument(
        "--csv",
        required=True,
        type=Path,
        help=(
            "Path to CSV file (required). Columns: "
            "name,domain[,website_url,city,employee_range]"
        ),
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"Path to SQLite DB (default: {DEFAULT_DB_PATH})",
    )
    parser.add_argument(
        "--on-duplicate",
        choices=["skip", "update"],
        default="skip",
        help="How to handle rows whose domain already exists (default: skip).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"Commit every N rows (default: {DEFAULT_BATCH_SIZE}).",
    )

    parsed_args = parser.parse_args()
    return TypeAdapter(Args).validate_python(vars(parsed_args))


def _normalize_domain(raw: str) -> Result[str, ValueError]:
    """ドメイン文字列を簡易検証して返す。"""
    value = (raw or "").strip().lower()
    if not value or "." not in value:
        return Result.err(ValueError("domain is empty or invalid"))
    return Result.ok(value)


def _extract_domain_from_url(url: str) -> Result[str, Exception]:
    """URL から netloc を取り出し、簡易検証して返す。"""
    try:
        parsed = urlsplit(url)
    except Exception as exc:
        return Result.err(exc)
    host = (parsed.netloc or "").split("@")[-1].split(":")[0].strip().lower()
    return _normalize_domain(host)


def _normalize_website_url(
    raw: str | None, *, fallback_domain: str | None = None
) -> Result[str | None, Exception]:
    """
    website_url をルート URL に正規化し、最低限の妥当性を確認する。
    - スキーム無しは https を付与
    - path/query/fragment は落として https://host/ の形に揃える
    - host が無い / 空白を含む / ドットを含まない場合はエラー
    - raw が None/空文字の場合は None を返す
    """
    if raw is None:
        return Result.ok(None)

    value = raw.strip()
    if not value:
        return Result.ok(None)

    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"

    try:
        parsed = urlsplit(value)
    except Exception as exc:
        return Result.err(exc)

    host = (parsed.netloc or "").strip()
    if not host and fallback_domain:
        host = fallback_domain.strip()

    if not host or " " in host or "." not in host:
        return Result.err(ValueError(f"Invalid host in website_url: {raw!r}"))

    normalized = urlunsplit((parsed.scheme or "https", host, "/", "", ""))
    return Result.ok(normalized)


def _validate_website_url(url: str) -> Result[str, Exception]:
    """実際に GET を行い、成功した URL のみ通す。"""
    try:
        response = httpx.get(
            url,
            headers={"User-Agent": "jordan-crawler/0.1"},
            timeout=3.0,
            follow_redirects=True,
        )
        if response.status_code >= 400:
            return Result.err(ValueError(f"GET {url} returned {response.status_code}"))
        return Result.ok(str(response.url))
    except Exception as exc:
        return Result.err(exc)


def _load_companies_from_csv(path: Path) -> Result[list[CsvCompany], Exception]:
    """CSV から行を読み込む。"""
    try:
        with path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                return Result.ok([])

            # 正規化のためヘッダーをすべて小文字にする
            fieldnames = [name.lower().strip() for name in reader.fieldnames]
            reader.fieldnames = fieldnames

            rows: list[CsvCompany] = []
            for line_no, raw_row in enumerate(reader, start=2):
                # 全カラム空の行はスキップ
                if raw_row is None or all(not (v or "").strip() for v in raw_row.values()):
                    continue

                normalized = {
                    k.lower(): (v.strip() or None) if isinstance(v, str) else v
                    for k, v in raw_row.items()
                }
                try:
                    row = CsvCompany.model_validate(normalized)
                    rows.append(row)
                except Exception as exc:
                    print(f"[IMPORT] Skip line {line_no}: {exc}")
                    continue

            return Result.ok(rows)
    except Exception as exc:
        return Result.err(exc)


def _ensure_logo_column(conn: sqlite3.Connection) -> Result[None, Exception]:
    """companies.logo_url が無い場合に追加する。"""
    try:
        columns = conn.execute("PRAGMA table_info(companies)").fetchall()
        has_logo = any(col[1] == "logo_url" for col in columns)
        if not has_logo:
            conn.execute("ALTER TABLE companies ADD COLUMN logo_url TEXT")
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def _ensure_industry_column(conn: sqlite3.Connection) -> Result[None, Exception]:
    """companies.industry が無い場合に追加する。"""
    try:
        columns = conn.execute("PRAGMA table_info(companies)").fetchall()
        has_column = any(col[1] == "industry" for col in columns)
        if not has_column:
            conn.execute("ALTER TABLE companies ADD COLUMN industry TEXT")
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def _ensure_description_column(conn: sqlite3.Connection) -> Result[None, Exception]:
    """companies.description が無い場合に追加する。"""
    try:
        columns = conn.execute("PRAGMA table_info(companies)").fetchall()
        has_column = any(col[1] == "description" for col in columns)
        if not has_column:
            conn.execute("ALTER TABLE companies ADD COLUMN description TEXT")
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def _ensure_schema(conn: sqlite3.Connection) -> Result[None, Exception]:
    """古い DB でも動かすため、必要カラムを追加しておく。"""
    for ensure_fn in (_ensure_logo_column, _ensure_industry_column, _ensure_description_column):
        result = ensure_fn(conn)
        if result.is_err():
            return result
    return Result.ok(None)


def _update_existing_company(
    conn: sqlite3.Connection,
    company_id: str,
    row: CsvCompany,
    updated_at: int,
) -> Result[None, Exception]:
    """既存 company を on-duplicate=update の方針で上書きする。"""
    try:
        website_url_result = _normalize_website_url(row.website_url)
        if website_url_result.is_err():
            return Result.err(website_url_result.unwrap_err())
        website_url = website_url_result.unwrap()

        if website_url:
            validated = _validate_website_url(website_url)
            if validated.is_err():
                return Result.err(validated.unwrap_err())
            website_url = validated.unwrap()

        conn.execute(
            """
            UPDATE companies
            SET
              name = COALESCE(?, name),
              website_url = COALESCE(?, website_url),
              city = COALESCE(?, city),
              employee_range = COALESCE(?, employee_range),
              updated_at = ?
            WHERE id = ?
            """,
            (
                row.name.strip(),
                website_url,
                (row.city or "").strip() or None,
                (row.employee_range or "").strip() or None,
                updated_at,
                company_id,
            ),
        )
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def _insert_company_and_domain(
    conn: sqlite3.Connection,
    row: CsvCompany,
    domain: str,
    now_ts: int,
) -> Result[tuple[str, str], Exception]:
    """company と domain を新規追加する。"""
    try:
        website_url_result = _normalize_website_url(row.website_url, fallback_domain=domain)
        if website_url_result.is_err():
            return Result.err(website_url_result.unwrap_err())
        website_url = website_url_result.unwrap()

        if website_url is None:
            inferred = _normalize_website_url(f"https://{domain}", fallback_domain=domain)
            if inferred.is_err():
                return Result.err(inferred.unwrap_err())
            website_url = inferred.unwrap()

        if website_url:
            validated = _validate_website_url(website_url)
            if validated.is_err():
                return Result.err(validated.unwrap_err())
            website_url = validated.unwrap()

        # ここで UUID を発行
        company_id = str(uuid.uuid4())

        # id を含めて INSERT する
        conn.execute(
            """
            INSERT INTO companies (
              id,
              name,
              website_url,
              description,
              industry,
              city,
              employee_range,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?)
            """,
            (
                company_id,
                row.name.strip(),
                website_url,
                (row.city or "").strip() or None,
                (row.employee_range or "").strip() or None,
                now_ts,
                now_ts,
            ),
        )

        domain_cursor = conn.execute(
            """
            INSERT INTO domains (
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
            ) VALUES (?, ?, 0, 0, 0, NULL, NULL, NULL, ?, ?)
            """,
            (company_id, domain, now_ts, now_ts),
        )
        domain_id = str(domain_cursor.lastrowid)

        return Result.ok((company_id, domain_id))
    except Exception as exc:
        return Result.err(exc)


def import_companies(
    conn: sqlite3.Connection,
    rows: Iterable[CsvCompany],
    *,
    on_duplicate: Literal["skip", "update"] = "skip",
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> Result[ImportStats, Exception]:
    """ロード済み行を DB に取り込む。"""
    stats = ImportStats()
    now_ts = int(time.time())

    try:
        for idx, row in enumerate(rows):
            raw_domain = (row.domain or "").strip()
            domain_result = _normalize_domain(raw_domain) if raw_domain else None

            if domain_result is None:
                url_result = _normalize_website_url(row.website_url)
                if url_result.is_err():
                    stats.failed_rows += 1
                    print(
                        f"[IMPORT] Invalid domain (row {idx}): domain empty and website_url invalid"
                    )
                    continue
                normalized_url = url_result.unwrap()
                if normalized_url is None:
                    stats.failed_rows += 1
                    print(
                        f"[IMPORT] Invalid domain (row {idx}): both domain and website_url missing"
                    )
                    continue
                domain_result = _extract_domain_from_url(normalized_url)

            if domain_result.is_err():
                stats.failed_rows += 1
                print(f"[IMPORT] Invalid domain (row {idx}): {row.domain!r}")
                continue
            domain = domain_result.unwrap()

            existing = conn.execute(
                "SELECT id, company_id FROM domains WHERE domain = ?", (domain,)
            ).fetchone()

            if existing:
                if on_duplicate == "skip":
                    stats.skipped_duplicates += 1
                    continue

                update_result = _update_existing_company(
                    conn,
                    company_id=str(existing["company_id"]),
                    row=row,
                    updated_at=now_ts,
                )
                if update_result.is_err():
                    stats.failed_rows += 1
                    print(
                        "[IMPORT] Failed to update existing company for "
                        f"{domain}: {update_result.unwrap_err()}"
                    )
                    continue
                stats.updated_companies += 1
            else:
                insert_result = _insert_company_and_domain(
                    conn,
                    row=row,
                    domain=domain,
                    now_ts=now_ts,
                )
                if insert_result.is_err():
                    stats.failed_rows += 1
                    print(
                        "[IMPORT] Failed to insert company for "
                        f"{domain}: {insert_result.unwrap_err()}"
                    )
                    continue

                stats.inserted_companies += 1
                stats.inserted_domains += 1

            if batch_size > 0 and idx % batch_size == 0:
                conn.commit()

        conn.commit()
        return Result.ok(stats)
    except Exception as exc:
        return Result.err(exc)


def run(
    csv_path: Path,
    db_path: Path,
    *,
    on_duplicate: Literal["skip", "update"] = "skip",
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> Result[ImportStats, Exception]:
    """同期 API。"""
    load_result = _load_companies_from_csv(csv_path)
    if load_result.is_err():
        return Result.err(load_result.unwrap_err())

    rows = load_result.unwrap()
    if not rows:
        return Result.ok(ImportStats())

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
    except Exception as exc:
        return Result.err(exc)

    try:
        ensure_result = _ensure_schema(conn)
        if ensure_result.is_err():
            return Result.err(ensure_result.unwrap_err())

        return import_companies(
            conn,
            rows,
            on_duplicate=on_duplicate,
            batch_size=batch_size,
        )
    finally:
        conn.close()


def main() -> None:
    args = _parse_args()
    result = run(
        args.csv,
        args.db,
        on_duplicate=args.on_duplicate,
        batch_size=args.batch_size,
    )

    if result.is_err():
        error = result.unwrap_err()
        print(f"Error: {error}")
        raise SystemExit(1)

    stats = result.unwrap()
    print(
        "Import finished - "
        f"inserted_companies={stats.inserted_companies}, "
        f"inserted_domains={stats.inserted_domains}, "
        f"updated_companies={stats.updated_companies}, "
        f"skipped_duplicates={stats.skipped_duplicates}, "
        f"failed_rows={stats.failed_rows}"
    )


if __name__ == "__main__":
    main()
