## 概要

`crawler/` は `data/jordan.sqlite` に入った既存データを補完するための小さな ETL 群です。Pydantic モデル（`src/domains.py`）で型を整えつつ、`src/result.py` の `Result` 型で失敗を明示的に扱う構成になっています。

## 主なスクリプト

- `src/enrich_contact.py`  
  `contacts.department` / `contacts.position` の文字列を正規化し、部署カテゴリ（`department_category`）と役職カテゴリ（`position_category`）を推定して更新します。カラムが無い場合は `ALTER TABLE` で追加し、`tqdm` で進捗を出します。デフォルトでは未設定のレコードだけを更新し、`--recompute-all` を付けると既存カテゴリも再計算して上書きします。
- `src/enrich_company.py`  
  `companies.website_url` をもとに favicon（ロゴ代替）を探索し `logo_url` を埋め、`meta description` を抽出して `description` に保存し、Web テキストから簡易ルールで業種ラベルを判定して `industry` を補完します。
- `src/enrich_domain.py`  
  既存メール（`emails` と `contacts` を join）からローカル部のパターンを多数決で推定し、`domains.pattern` を更新します。`first.last` や `flast` などの組み合わせを候補として比較します。
- `src/infer_contact_names.py`  
  `contacts` の `first_name` / `last_name` が空の行をピックアップし、LLM に氏名のローマ字表記を推定させて更新します。会社名・部署・役職も併せて渡して推論精度を補助します。
- `src/import_companies.py`  
  `name,domain` などの CSV から `companies` / `domains` に追加入力します。ドメイン重複時の挙動は `--on-duplicate=skip|update` で切り替えられ、`--infer-website` を付けると `website_url` が空でも `https://{domain}` を補完します。
- `src/search_contacts.py`  
  OpenAI Responses API の Structured Outputs を使って、各企業の Web 検索結果から担当者候補を JSON 化して `contacts` テーブルに追加します。`OPENAI_API_KEY` を `.env` などで設定しておく必要があり、`--department` で部門を絞り込み、`--skip-if-contacts-exist` で既存連絡先がある企業をスキップできます。
- `src/export_contact_email_candidates.py`  
  `contacts` と `domains` を突き合わせ、氏名と推定パターンから想定メールアドレスを生成して CSV に出力します。`--skip-if-email-exists` で `emails` 行を持つコンタクトを除外でき、`--max-candidates` で 1 人あたりの候補数を調整できます。
- `src/import_email_hippo_csv.py`  
  EmailHippo GUI からダウンロードした検証 CSV/TSV を読み込み、`emails` テーブルに行を追加します。`status_info` / `domain_country_code` / `mail_server_country_code` を CSV から転記します。

### Company enrichment の中身

`src/enrichers/company/enricher.py` が website を 1 度だけ取得して `WebsiteSnapshot` を共有し、個別の FieldEnricher を順番に呼び出します（失敗したら処理を中断）。

- `logo.py`  
  `<link rel=icon>` を最優先で解決し、到達性は HEAD→GET で 2xx/3xx をチェック。見つからない場合は `/favicon.ico`, `/favicon.png`, `/favicon.svg`, `/apple-touch-icon.png` などの代表的なパスを総当たりします。`recompute_all=False` なら既存ロゴがある行はスキップ。
- `description.py`  
  `meta[name|property]` の `description` / `og:description` / `twitter:description` を上から順に探し、値があれば `companies.description` にセットします。既存 description があればスキップ。
- `industry.py`  
  事業キーワードのルールベース分類。`/`, `/company`, `/about`, `/business` の最大 3 ページを取得し、`title`（3倍）、`meta description`（2倍）、`h1`（2倍）、`事業内容` などのテーブル・見出し周辺（4倍）を強調したテキストを作成。NFKC で正規化し、英数字＋日本語のみ残したうえでキーワードヒット数をスコア化し、`min_confidence`（デフォルト 0.1）を下回る場合は `industry` を空のままにします。

`src/enrich_company.py` では `logo_url` / `industry` / `description` カラムを不足時に `ALTER TABLE` で追加したうえで、`website_url` が空でない行を並列（デフォルト 20）に処理し、`asyncio.Queue` 経由でバッチ更新します。`--recompute-all` で既存値も上書きします。

## Enricher クラス

`src/enrichers/` に各種ロジックがまとまっています（テストは `src/tests/` 配下）。

- `base.py`: `Enricher` プロトコル（`enrich(item) -> Result`）。
- `contact/`: 正規化と部署/役職カテゴリ分類（`contact/enricher.py`、テストは `src/tests/test_contact_enricher.py`）。
- `company/`: website から favicon を引きつつ業種を補完するロジック（`company/enricher.py` orchestrates `company/logo.py` と `company/industry.py`）。
- `domain.py`: メールアドレスのローカル部からパターンを推定するヘルパー。

## 実行方法

```bash
# 例: 部署カテゴリの埋め直し
cd crawler
uv run python -m src.enrich_contact --db ../data/jordan.sqlite
# 既存カテゴリも含めて再計算する場合
uv run python -m src.enrich_contact --db ../data/jordan.sqlite --recompute-all

# 例: favicon と industry を追加
uv run python -m src.enrich_company --db ../data/jordan.sqlite
# 既存 logo/industry も含めて再計算
uv run python -m src.enrich_company --db ../data/jordan.sqlite --recompute-all

# 例: domains.pattern の推定
uv run python -m src.enrich_domain --db ../data/jordan.sqlite
# 既存 pattern も含めて再計算
uv run python -m src.enrich_domain --db ../data/jordan.sqlite --recompute-all

# 例: first_name / last_name を LLM で補完
uv run python -m src.infer_contact_names --db ../data/jordan.sqlite

# 例: CSV から企業/ドメインを追加
uv run python -m src.import_companies --csv ../inputs/companies.csv --db ../data/jordan.sqlite
# ドメイン重複時に上書き
uv run python -m src.import_companies --csv ../inputs/companies.csv --db ../data/jordan.sqlite --on-duplicate update

# 例: OpenAI で担当者を検索
export OPENAI_API_KEY=sk-...
uv run python -m src.search_contacts --db ../data/jordan.sqlite
# 既存コンタクトがある会社をスキップし、特定の部署だけ対象にする
uv run python -m src.search_contacts --db ../data/jordan.sqlite --department "営業" --skip-if-contacts-exist

# 例: Contact ごとの想定メールアドレス候補を CSV 出力
uv run python -m src.export_contact_email_candidates --db ../data/jordan.sqlite --output ../dist/contact_email_candidates.csv
# emails が既に紐づく Contact を除外し、候補数を 3 件に絞る
uv run python -m src.export_contact_email_candidates --db ../data/jordan.sqlite --max-candidates 3 --skip-if-email-exists

# 例: EmailHippo GUI CSV を emails に投入
uv run python -m src.import_email_hippo_csv --csv ../inputs/email_hippo.csv --db ../data/jordan.sqlite
```

## Tests

Run pytest with [uv](https://github.com/astral-sh/uv) (dependencies from `crawler/pyproject.toml`):

```bash
cd crawler
uv sync --extra dev
uv run pytest src/tests
uv run coverage run -m pytest src/tests && uv run coverage report
```

Lint with ruff (uv-managed environment):

```bash
cd crawler
uv sync --extra dev
uv run ruff check .
```
