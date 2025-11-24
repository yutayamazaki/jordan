import sqlite3
from pathlib import Path

from src.import_companies import ImportStats, run


def _create_schema(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE companies (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              website_url TEXT,
              description TEXT,
              industry TEXT,
              city TEXT,
              employee_range TEXT,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE domains (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL,
              domain TEXT NOT NULL UNIQUE,
              disposable INTEGER NOT NULL DEFAULT 0,
              webmail INTEGER NOT NULL DEFAULT 0,
              accept_all INTEGER NOT NULL DEFAULT 0,
              pattern TEXT,
              first_seen_at INTEGER,
              last_seen_at INTEGER,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def test_import_inserts_company_and_domain(tmp_path: Path) -> None:
    db_path = tmp_path / "db.sqlite"
    _create_schema(db_path)

    csv_path = tmp_path / "companies.csv"
    csv_path.write_text("name,domain\nAcme Inc,acme.example\n", encoding="utf-8")

    result = run(csv_path, db_path)
    assert result.is_ok()
    stats = result.unwrap()
    assert stats == ImportStats(inserted_companies=1, inserted_domains=1)

    conn = sqlite3.connect(db_path)
    try:
        conn.row_factory = sqlite3.Row
        company = conn.execute("SELECT * FROM companies").fetchone()
        domain = conn.execute("SELECT * FROM domains").fetchone()
        assert company is not None
        assert domain is not None
        assert company["website_url"] == "https://acme.example"
    finally:
        conn.close()


def test_import_skips_duplicate_domain(tmp_path: Path) -> None:
    db_path = tmp_path / "db.sqlite"
    _create_schema(db_path)

    conn = sqlite3.connect(db_path)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute(
            """
            INSERT INTO companies (
              id, name, website_url, description, industry, city,
              employee_range, created_at, updated_at
            ) VALUES (?, ?, ?, NULL, NULL, NULL, NULL, 0, 0)
            """,
            (1, "Existing Co", "https://existing.example"),
        )
        conn.execute(
            """
            INSERT INTO domains (
              id, company_id, domain, disposable, webmail, accept_all,
              pattern, first_seen_at, last_seen_at, created_at, updated_at
            ) VALUES (?, ?, ?, 0, 0, 0, NULL, NULL, NULL, 0, 0)
            """,
            (1, 1, "existing.example"),
        )
        conn.commit()
    finally:
        conn.close()

    csv_path = tmp_path / "companies.csv"
    csv_path.write_text("name,domain\nNew Co,existing.example\n", encoding="utf-8")

    result = run(csv_path, db_path, on_duplicate="skip")
    assert result.is_ok()
    stats = result.unwrap()
    assert stats.skipped_duplicates == 1
    assert stats.inserted_companies == 0

    conn = sqlite3.connect(db_path)
    try:
        conn.row_factory = sqlite3.Row
        company = conn.execute("SELECT name FROM companies WHERE id = 'c1'").fetchone()
        assert company is not None
        assert company["name"] == "Existing Co"
    finally:
        conn.close()


def test_import_updates_existing_company(tmp_path: Path) -> None:
    db_path = tmp_path / "db.sqlite"
    _create_schema(db_path)

    conn = sqlite3.connect(db_path)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute(
            """
            INSERT INTO companies (
              id, name, website_url, description, industry, city,
              employee_range, created_at, updated_at
            ) VALUES (?, ?, ?, NULL, NULL, NULL, NULL, 0, 0)
            """,
            (1, "Old Co", None),
        )
        conn.execute(
            """
            INSERT INTO domains (
              id, company_id, domain, disposable, webmail, accept_all,
              pattern, first_seen_at, last_seen_at, created_at, updated_at
            ) VALUES (?, ?, ?, 0, 0, 0, NULL, NULL, NULL, 0, 0)
            """,
            (1, 1, "update.example"),
        )
        conn.commit()
    finally:
        conn.close()

    csv_path = tmp_path / "companies.csv"
    csv_path.write_text(
        "name,domain,website_url,city,employee_range\n"
        "New Co,update.example,https://updated.example,Tokyo,11-50\n",
        encoding="utf-8",
    )

    result = run(csv_path, db_path, on_duplicate="update")
    assert result.is_ok()
    stats = result.unwrap()
    assert stats.updated_companies == 1
    assert stats.inserted_companies == 0

    conn = sqlite3.connect(db_path)
    try:
        conn.row_factory = sqlite3.Row
        company = conn.execute(
            """
            SELECT name, website_url, city, employee_range
            FROM companies
            WHERE id = 'c1'
            """
        ).fetchone()
        assert company is not None
        assert company["name"] == "New Co"
        assert company["website_url"] == "https://updated.example"
        assert company["city"] == "Tokyo"
        assert company["employee_range"] == "11-50"
    finally:
        conn.close()


def test_import_extracts_domain_from_website_url(tmp_path: Path) -> None:
    db_path = tmp_path / "db.sqlite"
    _create_schema(db_path)

    csv_path = tmp_path / "companies.csv"
    csv_path.write_text(
        "name,domain,website_url\n"
        "NoDomain Co,,https://nodomain.example/path\n",
        encoding="utf-8",
    )

    result = run(csv_path, db_path)
    assert result.is_ok()

    conn = sqlite3.connect(db_path)
    try:
        conn.row_factory = sqlite3.Row
        domain = conn.execute("SELECT domain FROM domains").fetchone()
        assert domain is not None
        assert domain["domain"] == "nodomain.example"
    finally:
        conn.close()
