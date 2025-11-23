## 概要

`crawler/` は `data/jordan.sqlite` に入った既存データを補完するための小さな ETL 群です。Pydantic モデル（`src/domains.py`）で型を整えつつ、`src/result.py` の `Result` 型で失敗を明示的に扱う構成になっています。

## 主なスクリプト

- `src/enrich_contact.py`  
  `contacts.department` / `contacts.position` の文字列を正規化し、部署カテゴリ（`department_category`）と役職カテゴリ（`position_category`）を推定して更新します。カラムが無い場合は `ALTER TABLE` で追加し、`tqdm` で進捗を出します。デフォルトでは未設定のレコードだけを更新し、`--recompute-all` を付けると既存カテゴリも再計算して上書きします。
- `src/enrich_company.py`  
  `companies.website_url` から favicon（ロゴ代替）を探索し `logo_url` を埋めつつ、企業名/説明/既存 industry から簡易ルールで業種ラベルを判定して `industry` を補完します。
- `src/enrich_domain.py`  
  既存メール（`emails` と `contacts` を join）からローカル部のパターンを多数決で推定し、`domains.pattern` を更新します。`first.last` や `flast` などの組み合わせを候補として比較します。

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
