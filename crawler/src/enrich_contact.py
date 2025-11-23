import argparse
import sqlite3
import time
from pathlib import Path
from typing import Iterable

from tqdm import tqdm

from src.domains import Contact
from src.enrichers.contact import ContactEnricher
from src.result import Result

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "jordan.sqlite"


def ensure_department_category_column(conn: sqlite3.Connection) -> Result[None, Exception]:
    """department_category カラムが存在しない場合は追加する。"""
    try:
        columns = conn.execute("PRAGMA table_info(contacts)").fetchall()
        has_column = any(col[1] == "department_category" for col in columns)
        if not has_column:
            conn.execute("ALTER TABLE contacts ADD COLUMN department_category TEXT")
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def ensure_position_category_column(conn: sqlite3.Connection) -> Result[None, Exception]:
    """position_category カラムが存在しない場合は追加する。"""
    try:
        columns = conn.execute("PRAGMA table_info(contacts)").fetchall()
        has_column = any(col[1] == "position_category" for col in columns)
        if not has_column:
            conn.execute("ALTER TABLE contacts ADD COLUMN position_category TEXT")
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def count_targets(conn: sqlite3.Connection, only_missing: bool = True) -> int:
    """分類対象件数を返す。"""
    where_clause = (
        """
        (
            department IS NOT NULL
            AND TRIM(department) != ''
            AND (department_category IS NULL OR TRIM(department_category) = '')
        )
        OR (
            position IS NOT NULL
            AND TRIM(position) != ''
            AND (position_category IS NULL OR TRIM(position_category) = '')
        )
        """
        if only_missing
        else """
        (
            department IS NOT NULL AND TRIM(department) != ''
        )
        OR (
            position IS NOT NULL AND TRIM(position) != ''
        )
        """
    )
    row = conn.execute(f"SELECT COUNT(*) AS cnt FROM contacts WHERE {where_clause}").fetchone()
    return int(row["cnt"]) if row and "cnt" in row.keys() else 0


def iter_contacts(conn: sqlite3.Connection, only_missing: bool = True) -> Iterable[Contact]:
    """department / position がありカテゴリ未設定の担当者を逐次返す。"""
    where_clause = (
        """
        (
            department IS NOT NULL
            AND TRIM(department) != ''
            AND (department_category IS NULL OR TRIM(department_category) = '')
        )
        OR (
            position IS NOT NULL
            AND TRIM(position) != ''
            AND (position_category IS NULL OR TRIM(position_category) = '')
        )
        """
        if only_missing
        else """
        (
            department IS NOT NULL
            AND TRIM(department) != ''
        )
        OR (
            position IS NOT NULL
            AND TRIM(position) != ''
        )
        """
    )
    cursor = conn.execute(
        f"""
        SELECT
            id,
            company_id,
            full_name,
            first_name,
            last_name,
            position,
            department,
            department_category,
            position_category,
            seniority,
            country,
            city,
            linkedin_url,
            twitter_url,
            phone_number,
            source_label,
            source_url,
            first_seen_at,
            last_seen_at,
            created_at,
            updated_at
        FROM contacts
        WHERE {where_clause}
        ORDER BY id
        """
    )
    for row in cursor:
        item = dict(row)
        # SQLite は TEXT カラムでも int を返すケースがあるため、明示的に文字列化する
        item["id"] = str(row["id"])
        item["company_id"] = str(row["company_id"])
        yield Contact.model_validate(item)


def update_categories(
    conn: sqlite3.Connection,
    contact_id: str,
    department_category: str | None,
    position_category: str | None,
) -> Result[None, Exception]:
    """department_category / position_category を 1 件ずつ更新する。"""
    try:
        conn.execute(
            """
            UPDATE contacts
            SET
              department_category = COALESCE(?, department_category),
              position_category = COALESCE(?, position_category),
              updated_at = ?
            WHERE id = ?
            """,
            (department_category, position_category, int(time.time()), contact_id),
        )
        conn.commit()
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def run(db_path: Path, recompute_all: bool = False) -> Result[int, Exception]:
    """部署名のテキストを正規化カテゴリに分類し、contacts.department_category を埋める。"""
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
    except Exception as exc:  # pragma: no cover - sqlite3 error is enough
        return Result.err(exc)

    ensure_result = ensure_department_category_column(conn)
    if ensure_result.is_err():
        conn.close()
        return Result.err(ensure_result.unwrap_err())
    pos_result = ensure_position_category_column(conn)
    if pos_result.is_err():
        conn.close()
        return Result.err(pos_result.unwrap_err())

    try:
        only_missing = not recompute_all
        total = count_targets(conn, only_missing=only_missing)
        enricher = ContactEnricher()
        updated = 0

        progress = tqdm(
            iter_contacts(conn, only_missing=only_missing),
            total=total,
            desc="classifying contacts",
        )
        for contact in progress:
            original_dept_category = contact.department_category
            original_pos_category = contact.position_category

            enriched_result = enricher.enrich(contact)
            if enriched_result.is_err():
                return Result.err(enriched_result.unwrap_err())

            enriched = enriched_result.unwrap()
            if not enriched.department_category and not enriched.position_category:
                continue

            # 既存カテゴリが埋まっている場合は上書きしない（再計算モード除く）
            dept_value: str | None = None
            pos_value: str | None = None
            if recompute_all or not (
                original_dept_category and str(original_dept_category).strip()
            ):
                dept_value = enriched.department_category
            if recompute_all or not (original_pos_category and str(original_pos_category).strip()):
                pos_value = enriched.position_category
            if dept_value is None and pos_value is None:
                continue

            update_result = update_categories(conn, enriched.id, dept_value, pos_value)
            if update_result.is_err():
                return Result.err(update_result.unwrap_err())

            updated += 1
            progress.set_postfix(
                dept=enriched.department_category,
                pos=enriched.position_category,
                updated=updated,
                refresh=False,
            )

        return Result.ok(updated)
    finally:
        conn.close()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="SQLite の contacts テーブルの部署・役職をカテゴリに分類して埋めます。",
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"利用する SQLite DB のパス（デフォルト: {DEFAULT_DB_PATH}）",
    )
    parser.add_argument(
        "--recompute-all",
        action="store_true",
        help="既存のカテゴリが入っていても再計算して上書きします（デフォルトは未設定のみ更新）。",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    result = run(args.db, recompute_all=args.recompute_all)
    if result.is_err():
        error = result.unwrap_err()
        print(f"Error: {error}")
        raise SystemExit(1)

    updated = result.unwrap()
    print(f"Updated {updated} contacts.")


if __name__ == "__main__":
    main()
