import sqlite3
from pathlib import Path

from enrich_contact import (
    ensure_department_category_column,
    iter_contacts,
    run,
)
from enrichers.contact import classify_department_category, classify_position_category


def _make_db(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE contacts (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            full_name TEXT NOT NULL,
            position TEXT,
            first_name TEXT,
            last_name TEXT,
            department TEXT,
            department_category TEXT,
            position_category TEXT,
            seniority TEXT,
            country TEXT,
            city TEXT,
            linkedin_url TEXT,
            twitter_url TEXT,
            phone_number TEXT,
            source_label TEXT,
            source_url TEXT,
            first_seen_at INTEGER,
            last_seen_at INTEGER,
            created_at INTEGER,
            updated_at INTEGER
        )
        """
    )
    return conn


def test_ensure_department_category_column_adds_when_missing(tmp_path: Path) -> None:
    db_path = tmp_path / "test.sqlite"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE contacts (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            full_name TEXT NOT NULL
        )
        """
    )

    result = ensure_department_category_column(conn)
    assert result.is_ok()

    columns = [col[1] for col in conn.execute("PRAGMA table_info(contacts)").fetchall()]
    assert "department_category" in columns
    conn.close()


def test_iter_contacts_filters_pending_only(tmp_path: Path) -> None:
    db_path = tmp_path / "test.sqlite"
    conn = _make_db(db_path)
    now = 1
    rows = [
        ("1", "c1", "Alice", "部長", None, None, "営業部", None, None),
        ("2", "c1", "Bob", "スタッフ", None, None, "", None, None),
        ("3", "c2", "Carol", "CTO", None, None, "IT部", "情報システム", "経営"),
    ]
    for rid, cid, name, pos, fn, ln, dept, dept_cat, pos_cat in rows:
        conn.execute(
            """
            INSERT INTO contacts (
                id, company_id, full_name, position, first_name, last_name, department,
                department_category, position_category, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (rid, cid, name, pos, fn, ln, dept, dept_cat, pos_cat, now, now),
        )
    conn.commit()

    pending = list(iter_contacts(conn))
    assert [c.id for c in pending] == ["1", "2"]
    assert pending[0].department == "営業部"
    assert pending[0].position == "部長"
    assert pending[1].department == ""
    assert pending[1].position == "スタッフ"
    conn.close()


def test_run_classifies_and_updates_department_category(tmp_path: Path) -> None:
    db_path = tmp_path / "test.sqlite"
    conn = _make_db(db_path)
    now = 1
    conn.execute(
        """
        INSERT INTO contacts (
            id, company_id, full_name, department, department_category,
            position, position_category, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("10", "c10", "Eve", "マーケティング部", None, "課長", None, now, now),
    )
    conn.commit()
    conn.close()

    result = run(db_path)
    assert result.is_ok()
    assert result.unwrap() == 1

    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT department_category, position_category FROM contacts WHERE id = ?",
        ("10",),
    ).fetchone()
    conn.close()

    assert row is not None
    assert row[0] == classify_department_category("マーケティング部")
    assert row[1] == classify_position_category("課長")
