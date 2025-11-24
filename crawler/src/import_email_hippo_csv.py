from __future__ import annotations

import argparse
import csv
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, TypeAdapter

from src.enrichers.domain import PATTERN_BUILDERS
from src.result import Result

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "jordan.sqlite"


class Args(BaseModel):
    csv: Path = Field(alias="csv")
    db: Path = DEFAULT_DB_PATH
    source: str = "email_hippo_gui"


@dataclass
class HippoRow:
    email: str
    status: str
    additional_status_info: Optional[str]
    domain_country_code: Optional[str]
    mail_server_country_code: Optional[str]


@dataclass
class ContactName:
    id: int
    first_name: Optional[str]
    last_name: Optional[str]


def _parse_args() -> Args:
    parser = argparse.ArgumentParser(
        description="Import EmailHippo GUI CSV and create emails rows."
    )
    parser.add_argument("--csv", type=Path, required=True, help="Path to EmailHippo CSV/TSV")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH, help="Path to SQLite DB")
    parser.add_argument(
        "--source",
        type=str,
        default="email_hippo_gui",
        help="emails.source に保存する値 (default: email_hippo_gui)",
    )
    parsed = parser.parse_args()
    return TypeAdapter(Args).validate_python(vars(parsed))


def _connect(db_path: Path) -> Result[sqlite3.Connection, Exception]:
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return Result.ok(conn)
    except Exception as exc:
        return Result.err(exc)


def _ensure_email_columns(conn: sqlite3.Connection) -> Result[None, Exception]:
    """status_info / domain_country_code / mail_server_country_code を追加する。"""
    try:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(emails)")}
        pending_alters: list[str] = []
        if "status_info" not in columns:
            pending_alters.append("ALTER TABLE emails ADD COLUMN status_info TEXT")
        if "domain_country_code" not in columns:
            pending_alters.append("ALTER TABLE emails ADD COLUMN domain_country_code TEXT")
        if "mail_server_country_code" not in columns:
            pending_alters.append("ALTER TABLE emails ADD COLUMN mail_server_country_code TEXT")
        for statement in pending_alters:
            conn.execute(statement)
        if pending_alters:
            conn.commit()
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def _load_rows(path: Path) -> Result[list[HippoRow], Exception]:
    """EmailHippo GUI の CSV/TSV をパースする。"""
    try:
        with path.open(newline="", encoding="utf-8") as handle:
            sample = handle.read(1024)
            handle.seek(0)
            dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
            reader = csv.DictReader(handle, dialect=dialect)
            rows: list[HippoRow] = []
            for raw in reader:
                if raw is None:
                    continue
                email_value = (raw.get("CheckedEmailAddress") or raw.get("Column1") or "").strip()
                if not email_value:
                    continue
                rows.append(
                    HippoRow(
                        email=email_value,
                        status=(raw.get("Status") or "").strip() or "pending",
                        additional_status_info=(raw.get("AdditionalStatusInfo") or "").strip() or None,
                        domain_country_code=(raw.get("DomainCountryCode") or "").strip() or None,
                        mail_server_country_code=(raw.get("MailServerCountryCode") or "").strip()
                        or None,
                    )
                )
            return Result.ok(rows)
    except Exception as exc:
        return Result.err(exc)


def _find_domain_and_company_id(
    conn: sqlite3.Connection, email_value: str
) -> tuple[Optional[int], Optional[str]]:
    try:
        _, domain = email_value.split("@", 1)
    except ValueError:
        return None, None
    cursor = conn.execute(
        "SELECT id, company_id FROM domains WHERE domain = ? LIMIT 1", (domain.lower(),)
    )
    row = cursor.fetchone()
    if not row:
        return None, None
    return int(row["id"]), str(row["company_id"])


def _load_contacts_by_company(
    conn: sqlite3.Connection,
) -> Result[dict[str, list[ContactName]], Exception]:
    try:
        cursor = conn.execute(
            "SELECT id, company_id, first_name, last_name FROM contacts WHERE first_name IS NOT NULL AND last_name IS NOT NULL"
        )
        mapping: dict[str, list[ContactName]] = {}
        for row in cursor:
            company_id = str(row["company_id"])
            mapping.setdefault(company_id, []).append(
                ContactName(
                    id=int(row["id"]),
                    first_name=row["first_name"],
                    last_name=row["last_name"],
                )
            )
        return Result.ok(mapping)
    except Exception as exc:
        return Result.err(exc)


def _normalize_token(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = "".join(ch for ch in value.strip().lower() if ch.isascii())
    filtered = "".join(ch for ch in normalized if ch.isalnum())
    return filtered or None


def _guess_contact_id(
    local_part: str,
    company_id: Optional[str],
    contacts_by_company: dict[str, list[ContactName]],
) -> Optional[int]:
    if not company_id:
        return None

    candidates = contacts_by_company.get(company_id) or []
    if not candidates:
        return None

    normalized_local = local_part.lower()
    matches: list[int] = []
    for contact in candidates:
        first = _normalize_token(contact.first_name)
        last = _normalize_token(contact.last_name)
        if not first or not last:
            continue
        for pattern, builder in PATTERN_BUILDERS.items():
            try:
                built = builder(first, last)
            except Exception:
                continue
            if built == normalized_local:
                matches.append(contact.id)
                break

    if len(matches) == 1:
        return matches[0]
    return None


def _insert_email(
    conn: sqlite3.Connection,
    row: HippoRow,
    domain_id: Optional[int],
    company_id: Optional[str],
    source: str,
    contacts_by_company: dict[str, list[ContactName]],
) -> Result[None, Exception]:
    try:
        now = int(time.time())
        contact_id: Optional[int] = None
        try:
            local, _ = row.email.split("@", 1)
            contact_id = _guess_contact_id(local, company_id, contacts_by_company)
        except Exception:
            contact_id = None

        # Skip if the email already exists
        existing = conn.execute(
            "SELECT 1 FROM emails WHERE email = ? LIMIT 1",
            (row.email,),
        ).fetchone()
        if existing:
            return Result.ok(None)

        conn.execute(
            """
            INSERT INTO emails (
                id, contact_id, domain_id, email, kind, source, status,
                status_info, domain_country_code, mail_server_country_code,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                None,  # autoincrement
                contact_id,
                domain_id,
                row.email,
                None,
                source,
                row.status,
                row.additional_status_info,
                row.domain_country_code,
                row.mail_server_country_code,
                now,
                now,
            ),
        )
        conn.commit()
        return Result.ok(None)
    except Exception as exc:
        return Result.err(exc)


def run(args: Args) -> Result[int, Exception]:
    conn_result = _connect(args.db)
    if conn_result.is_err():
        return Result.err(conn_result.unwrap_err())
    conn = conn_result.unwrap()
    try:
        ensure_result = _ensure_email_columns(conn)
        if ensure_result.is_err():
            print("Ensuring email columns failed:", ensure_result.unwrap_err())
            return Result.err(ensure_result.unwrap_err())

        contacts_result = _load_contacts_by_company(conn)
        if contacts_result.is_err():
            print("Loading contacts by company failed:", contacts_result.unwrap_err())
            return Result.err(contacts_result.unwrap_err())
        contacts_by_company = contacts_result.unwrap()

        rows_result = _load_rows(args.csv)
        if rows_result.is_err():
            print("Loading rows failed:", rows_result.unwrap_err())
            return Result.err(rows_result.unwrap_err())
        rows = rows_result.unwrap()

        inserted = 0
        for row in rows:
            domain_id, company_id = _find_domain_and_company_id(conn, row.email)
            insert_result = _insert_email(conn, row, domain_id, company_id, args.source, contacts_by_company)
            print(f"[{'OK' if insert_result.is_ok() else f'SKIP {insert_result.unwrap_err()}'}] {row.email}")
            if insert_result.is_err():
                print(f"[SKIP] {row.email}: {insert_result.unwrap_err()}")
                continue
            inserted += 1

        return Result.ok(inserted)
    finally:
        conn.close()


def main() -> None:
    args = _parse_args()
    result = run(args)
    if result.is_err():
        raise SystemExit(f"[import_email_hippo_csv] {result.unwrap_err()}")
    print(f"Inserted {result.unwrap()} email rows.")


if __name__ == "__main__":
    main()
