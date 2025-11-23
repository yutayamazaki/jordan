## 概要

`crawler/` は `data/jordan.sqlite` に入った既存データを補完するための小さな ETL 群です。Pydantic モデル（`src/domains.py`）で型を整えつつ、`src/result.py` の `Result` 型で失敗を明示的に扱う構成になっています。

## 主なスクリプト

- `enrich_contact.py`  
  `contacts.department` / `contacts.position` の文字列を正規化し、部署カテゴリ（`department_category`）と役職カテゴリ（`position_category`）を推定して更新します。カラムが無い場合は `ALTER TABLE` で追加し、`tqdm` で進捗を出します。デフォルトでは未設定のレコードだけを更新し、`--recompute-all` を付けると既存カテゴリも再計算して上書きします。
- `enrich_company.py`  
  `companies.website_url` から favicon（ロゴ代替）を探索し、`logo_url` を埋めます。`httpx` で疎通確認しつつ、HTML の `<link rel="icon">` を優先的に解析し、見つからなければ `/favicon.ico` など代表パスを総当たりします。
- `enrich_domain.py`  
  既存メール（`emails` と `contacts` を join）からローカル部のパターンを多数決で推定し、`domains.pattern` を更新します。`first.last` や `flast` などの組み合わせを候補として比較します。

## Enricher クラス

`enrichers/` に各種ロジックがまとまっています。

- `base.py`: `Enricher` プロトコル（`enrich(item) -> Result`）。
- `contact.py`: 部署名の正規化・カテゴリ判定（テストは `tests/test_contact_enricher.py`）。
- `company.py`: website から favicon を引くロジック。
- `domain.py`: メールアドレスのローカル部からパターンを推定するヘルパー。

## 実行方法

```bash
# 例: 部署カテゴリの埋め直し
cd crawler
python enrich_contact.py --db ../data/jordan.sqlite
# 既存カテゴリも含めて再計算する場合
python enrich_contact.py --db ../data/jordan.sqlite --recompute-all

# 例: favicon を logo_url に追加
python enrich_company.py --db ../data/jordan.sqlite

# 例: domains.pattern の推定
python enrich_domain.py --db ../data/jordan.sqlite
```

## Tests

Run pytest from the project root (uses the dependencies defined in `crawler/pyproject.toml`):

```bash
cd crawler
pip install -U pytest  # if not already installed
pytest
```

If you use [uv](https://github.com/astral-sh/uv):

```bash
cd crawler
uv sync --extra dev
uv run pytest
uv run coverage run -m pytest && uv run coverage report
```

Lint with ruff (uv-managed environment):

```bash
cd crawler
uv sync --extra dev
uv run ruff check .
```
