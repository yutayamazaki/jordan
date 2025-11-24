from __future__ import annotations

import argparse
import asyncio
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import dotenv
from pydantic import BaseModel, Field, TypeAdapter
from tqdm import tqdm

from src.adapters.openai import StructuredOutputOptions, create_structured_outputs
from src.result import Result

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "jordan.sqlite"
DEFAULT_CONCURRENCY = 5
DEFAULT_MAX_PER_COMPANY = 10


class LlmContactSource(BaseModel):
    url: str
    pageTitle: str | None = None


class LlmContact(BaseModel):
    full_name: str
    first_name: str | None = None
    last_name: str | None = None
    position: str | None = None
    department: str | None = None
    sources: list[LlmContactSource] = Field(default_factory=list)


class LlmContactList(BaseModel):
    contacts: list[LlmContact]


class Args(BaseModel):
    db: Path = DEFAULT_DB_PATH
    department: str | None = None
    skip_if_contacts_exist: bool = False


@dataclass
class CompanyTarget:
    company_id: str  # uuid
    company_name: str
    domain: str
    website_url: str | None


def _parse_args() -> Args:
    # Load environment variables
    dotenv.load_dotenv()
    parser = argparse.ArgumentParser(
        description="Fetch contacts via OpenAI Responses API with web search."
    )
    parser.add_argument("--db", type=Path, default=DEFAULT_DB_PATH, help="Path to SQLite DB")
    parser.add_argument("--department", type=str, default=None, help="Target department (optional)")
    parser.add_argument(
        "--skip-if-contacts-exist",
        action="store_true",
        help="Skip companies that already have at least one contact",
    )
    parsed = parser.parse_args()
    return TypeAdapter(Args).validate_python(vars(parsed))


def _ensure_contacts_table(conn: sqlite3.Connection) -> None:
    """
    contacts.id を INTEGER PRIMARY KEY AUTOINCREMENT 前提で作成する。
    既存テーブルがある場合は何もしない（型が異なる場合はユーザー側でマイグレーションを行う想定）。
    """
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL,
          full_name TEXT NOT NULL,
          first_name TEXT,
          last_name TEXT,
          position TEXT,
          department TEXT,
          department_category TEXT,
          position_category TEXT,
          seniority TEXT,
          city TEXT,
          linkedin_url TEXT,
          twitter_url TEXT,
          phone_number TEXT,
          source_label TEXT,
          source_url TEXT,
          first_seen_at INTEGER,
          last_seen_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
        """
    )


def _iter_targets(
    conn: sqlite3.Connection, skip_if_contacts_exist: bool
) -> Iterable[CompanyTarget]:
    where_clause = ""
    if skip_if_contacts_exist:
        where_clause = (
            "WHERE NOT EXISTS (SELECT 1 FROM contacts "
            "WHERE contacts.company_id = companies.id)"
        )
    cursor = conn.execute(
        f"""
        SELECT companies.id AS company_id, companies.name AS company_name, domains.domain AS domain,
               companies.website_url AS website_url
        FROM companies
        JOIN domains ON domains.company_id = companies.id
        {where_clause}
        ORDER BY companies.id
        """
    )
    for row in cursor:
        yield CompanyTarget(
            company_id=str(row["company_id"]),
            company_name=row["company_name"],
            domain=row["domain"],
            website_url=row["website_url"],
        )


def _normalize_name_token(token: str | None) -> str | None:
    if not token:
        return None
    normalized = token.strip().lower()
    filtered = "".join(ch for ch in normalized if ch.isalpha() or ch in ("-", "'"))
    return filtered or None


def _build_prompt(company_name: str, domain: str, department: str | None, max_contacts: int) -> str:
    trimmed_department = (department or "").strip()
    department_description = trimmed_department if trimmed_department else "特に指定なし"
    category_description = ""
    # getDepartmentCategorySearchInfo の代替: 部署カテゴリ情報があればここで拡張可能
    # 現状は空文字扱い

    return f"""
あなたはB2B企業の担当者情報を調査するリサーチエージェントです。
以下の会社情報に基づいてWEB検索ツールを用い、サービスの導入事例や採用ページなど、
氏名・役職・部署が明示されている担当者情報を、最大{max_contacts}件収集してください。
その際、各担当者情報がどのページから得られたか（URLとページタイトル）も一緒に特定し、構造化して出力してください。

## 会社情報
- 会社名: {company_name}
- 会社ドメイン: {domain}
- 部署: {department_description}
{category_description}

## 調査方針

1. WEB検索では、会社名と以下のようなキーワードを組み合わせて検索し、
   氏名・役職・部署が載っていそうなページを優先的に調査してください。

   - サービス事例・導入事例ページ
     - 例: 「導入事例」「お客様事例」「事例インタビュー」「case study」
   - 採用・リクルート関連ページ
     - 例: 「採用サイト」「社員インタビュー」「メンバー紹介」「先輩インタビュー」
   - 会社情報・組織系ページ
     - 例: 「会社情報」「役員紹介」「組織図」「management team」
   - IR・プレス・ニュース
     - 例: 「プレスリリース」「ニュース」「IR」「コーポレートガバナンス」
   - セミナー・イベント・登壇情報
     - 例: 「セミナー」「ウェビナー」「イベント」「登壇者」
   - オウンドメディア・ブログ
     - 例: 「ブログ」「オウンドメディア」「note」「技術ブログ」
   - パートナー・アライアンス紹介ページ
     - 例: 「パートナー」「アライアンス」「提携」

2. 特に、以下の条件を満たす人物を「担当者候補」として抽出してください。
   - 氏名（フルネーム）が記載されている
   - 役職または部署名が一緒に記載されている
   - 当該企業の従業員・役員など、法人の公式な立場を持つ人物である
   - 顧客企業側の担当者が事例インタビュー等に記載されている場合も候補に含めてよい

3. 部署指定がある場合（上記の「部署」情報が空でない場合）は、
   - その部署と関連がありそうな人物（同じ部門名や、近い業務領域の役職）や、
   - 部署カテゴリに含まれると考えられる部署名を持つ人物を優先的に抽出してください。

4. 以下のような人物は除外してください。
   - 就活生や応募者、インターン応募者など、従業員・役員ではない人物
   - 氏名だけで役職・部署が一切分からない人物
   - 個人のSNSアカウントや、企業と無関係な個人ブログ上の人物
   - 推測だけに基づく人物情報（確実にページ上に記載されていない情報）
   - 代表取締役・社長・会長・取締役会長 など、社長・会長クラスの役職者

5. 氏名の英字化について
   - 「名（firstName）」「姓（lastName）」は、氏名から推測されるローマ字表記を、
     すべて小文字のアルファベットで出力してください。
     例: 山田 太郎 → firstName: "taro", lastName: "yamada"
   - ローマ字表記が明確に分からない場合は、
     一般的な日本人名のローマ字表記に基づいて自然に推測してください。

【出力項目】

担当者の情報として、1人あたり以下の項目を出力してください。

1. 氏名（半角スペース区切りの漢字など本名）
2. 役職
3. 部署
4. 名（firstName, すべて小文字のアルファベット）
5. 姓（lastName, すべて小文字のアルファベット）
6. 情報ソース（sources）
   - その担当者情報が記載されていたページの URL（url）
   - そのページのタイトル（pageTitle）
   - 複数のページから確認できた場合は、sources配列に複数要素を含めてください

【出力フォーマット】
JSON 形式で、以下のスキーマに従って出力してください。

```json
{LlmContactList.__dict__}
```

制約:
- 回答には引用・参照・citationなどの情報を付与しないでください。
- JSON以外のテキスト（説明文や前置き、後書き）は出力しないでください。
- sources には、実際に担当者情報が確認できたページのみを含めてください。
"""


async def _call_openai(
    prompt: str,
    max_contacts: int,
) -> Result[list[LlmContact], Exception]:
    class ResponseSchema(BaseModel):
        contacts: list[LlmContact] = Field(max_length=max_contacts)

    result = await create_structured_outputs(
        prompt,
        ResponseSchema,
        StructuredOutputOptions(
            model="gpt-5-nano-2025-08-07",
            use_web_search=True,
            reasoning_effort="low",
        ),
    )
    if result.is_err():
        return Result.err(result.unwrap_err())
    parsed = result.unwrap()
    return Result.ok(parsed.contacts)


def _save_contact(
    conn: sqlite3.Connection,
    company_id: int,
    contact: LlmContact,
) -> Result[bool, Exception]:
    exists = conn.execute(
        "SELECT 1 FROM contacts WHERE company_id = ? AND full_name = ?",
        (company_id, contact.full_name),
    ).fetchone()
    if exists:
        return Result.ok(False)
    now_ts = int(time.time())
    source_url = contact.sources[0].url if contact.sources else None
    first_name = _normalize_name_token(contact.first_name)
    last_name = _normalize_name_token(contact.last_name)
    try:
        conn.execute(
            """
            INSERT INTO contacts (
              company_id, full_name, first_name, last_name, position, department,
              source_label, source_url, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                company_id,
                contact.full_name,
                first_name,
                last_name,
                contact.position,
                contact.department,
                "openai_web_search",
                source_url,
                now_ts,
                now_ts,
            ),
        )
        conn.commit()
        return Result.ok(True)
    except Exception as exc:
        return Result.err(exc)


async def run_async(args: Args) -> Result[int, Exception]:
    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    _ensure_contacts_table(conn)

    targets = list(_iter_targets(conn, skip_if_contacts_exist=args.skip_if_contacts_exist))
    if not targets:
        return Result.ok(0)

    errors: list[tuple[str, str]] = []
    progress = tqdm(total=len(targets), desc="fetching contacts")
    saved_count = 0

    semaphore = asyncio.Semaphore(max(1, DEFAULT_CONCURRENCY))

    async def _process(target: CompanyTarget) -> None:
        async with semaphore:
            try:
                prompt = _build_prompt(
                    company_name=target.company_name,
                    domain=target.domain,
                    department=args.department,
                    max_contacts=DEFAULT_MAX_PER_COMPANY,
                )
                contacts_result = await _call_openai(prompt, DEFAULT_MAX_PER_COMPANY)
                if contacts_result.is_err():
                    print(f"Error fetching contacts for {target.company_name}: {contacts_result.unwrap_err()}")
                    errors.append((target.company_name, str(contacts_result.unwrap_err())))
                    return
                contacts = contacts_result.unwrap()
                nonlocal saved_count
                for contact in contacts:
                    save_result = _save_contact(conn, target.company_id, contact)
                    if save_result.is_err():
                        print(f"Error saving contact for {target.company_name}: {save_result.unwrap_err()}")
                        errors.append((target.company_name, str(save_result.unwrap_err())))
                        return
                    if save_result.unwrap():
                        saved_count += 1
            except Exception as exc:  # noqa: BLE001
                print(f"Error processing {target.company_name}: {exc}")
                errors.append((target.company_name, str(exc)))
            finally:
                progress.update(1)

    tasks = [asyncio.create_task(_process(t)) for t in targets]
    await asyncio.gather(*tasks)
    progress.close()

    if errors:
        messages = "\n".join(f"[{name}] {message}" for name, message in errors)
        return Result.err(RuntimeError(f"Completed with {len(errors)} errors:\n{messages}"))
    return Result.ok(saved_count)


def main() -> None:
    args = _parse_args()
    result = asyncio.run(run_async(args))
    if result.is_err():
        error = result.unwrap_err()
        print(f"Error: {error}")
        raise SystemExit(1)
    saved = result.unwrap()
    print(f"Completed without errors. Saved {saved} contacts.")


if __name__ == "__main__":
    main()
