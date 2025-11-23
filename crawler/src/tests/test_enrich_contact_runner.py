from __future__ import annotations

import sqlite3
import time
from pathlib import Path

from src.enrich_contact import run


def _prepare_db(tmp_path: Path) -> Path:
    """簡易な contacts テーブルを準備し、数件のダミーデータを投入する。"""
    db_path = tmp_path / "contacts.sqlite"
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE contacts (
            id TEXT PRIMARY KEY,
            company_id TEXT,
            full_name TEXT,
            first_name TEXT,
            last_name TEXT,
            position TEXT,
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
    now = int(time.time())
    conn.executemany(
        """
        INSERT INTO contacts (
            id, company_id, full_name, first_name, last_name, position, department,
            department_category, position_category, seniority, country, city, linkedin_url,
            twitter_url, phone_number, source_label, source_url, first_seen_at, last_seen_at,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                "1",
                "1",
                "山田 太郎",
                "太郎",
                "山田",
                "課長",
                "情報システム部",
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                now,
                now,
                now,
                now,
            ),
            (
                "2",
                "1",
                "佐藤 次郎",
                "次郎",
                "佐藤",
                "部長",
                "営業部",
                "営業",
                "部長",
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                now,
                now,
                now,
                now,
            ),
            (
                "3",
                "2",
                "田中 花子",
                "花子",
                "田中",
                "室長",
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                now,
                now,
                now,
                now,
            ),
        ],
    )
    conn.commit()
    conn.close()
    return db_path


def test_run_updates_only_missing(tmp_path: Path) -> None:
    db_path = _prepare_db(tmp_path)

    result = run(db_path)
    assert result.is_ok()
    assert result.unwrap() == 2  # id=1,3 が更新対象

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    row1 = conn.execute(
        "SELECT department_category, position_category FROM contacts WHERE id = '1'"
    ).fetchone()
    assert row1["department_category"] == "情報システム"
    assert row1["position_category"] == "次長・課長"

    # 既にカテゴリが埋まっているレコードは上書きしない
    row2 = conn.execute(
        "SELECT department_category, position_category FROM contacts WHERE id = '2'"
    ).fetchone()
    assert row2["department_category"] == "営業"
    assert row2["position_category"] == "部長"

    conn.close()


def test_run_recompute_all_overwrites_existing(tmp_path: Path) -> None:
    db_path = _prepare_db(tmp_path)
    # 既存カテゴリをあえて不正値にしておく
    conn = sqlite3.connect(db_path)
    conn.execute(
        "UPDATE contacts SET department_category = 'その他', position_category = 'その他' "
        "WHERE id = '2'"
    )
    conn.commit()
    conn.close()

    result = run(db_path, recompute_all=True)
    assert result.is_ok()

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    row2 = conn.execute(
        "SELECT department_category, position_category FROM contacts WHERE id = '2'"
    ).fetchone()
    assert row2["department_category"] == "営業"
    assert row2["position_category"] == "部長"
    conn.close()
