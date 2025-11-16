# jordan-ai

B2B 企業の担当者情報を Web 検索＋LLM（OpenAI Structured Outputs）で収集し、  
メールアドレスのパターン推定とアドレス候補生成までを自動化し、CSV で出力する CLI ツールです。

---

## 機能概要・全体設計

- 会社名・ドメイン名・ターゲット部署を入力すると、  
  - Web 検索結果から担当者候補（氏名／役職／部署）を抽出
  - 氏名のローマ字（姓・名）を推定
- 会社ドメインから、実際に公開されているメールアドレス例をもとに  
  - 一般的なメールアドレス構成パターン（例: `first.last`, `f_last` など）を推定
- 担当者情報とメールパターンから、複数のメールアドレス候補を生成
- 候補メールアドレスに対して、DNS MX レコードによる deliverability チェックを実施
- さらに、EmailHippo などで手動検証した結果を CSV から読み込み、スコアリングに統合
- 上記の情報を CSV（疑似 DB テーブル形式）として `outputs/` 以下に保存

### アーキテクチャ概要

- 2 フェーズ構成
  - **collect フェーズ**（`collectCompanyScan`）
    - メールパターン推定
    - Web 検索による担当者情報取得
    - メール候補生成
    - DNS MX によるメール検証
    - 以上の「生データ」を JSON として `outputs/company_scans/` に保存
  - **score フェーズ**（`scoreCompanyScan`）
    - 保存済みの生データを読み込み
    - EmailHippo CSV（任意）と DNS 検証結果を統合したスコアリング
    - 「疑似 DB テーブル」形式の CSV を `outputs/` に出力
- メール検証キャッシュ
  - `outputs/email_verifications.json` に検証結果を保存
  - 一定期間（デフォルト 90 日）以内の結果は再利用し、DNS への問い合わせ回数を削減

---

## 必要要件

- Node.js 18 以上（20 以降推奨）
- npm
- OpenAI API キー
  - 環境変数 `OPENAI_API_KEY`（`.env`）から読み込みます

---

## セットアップ

```bash
# 依存パッケージのインストール
npm install
```

リポジトリ直下に `.env` ファイルを作成し、OpenAI API キーを設定します:

```env
OPENAI_API_KEY=your-openai-api-key
```

※ `.env` は Git にコミットしないように注意してください。

---

## 実行方法

このツールは、次の 2 つの実行パターンをサポートします。

- 開発モード（TypeScript のまま実行）: `npm run dev -- ...`
- ビルド済み JavaScript で実行: `npm start -- ...`（事前に `npm run build` が必要）

また、対象企業は「企業リスト CSV ファイル」を指定する想定です。
（CSV に複数企業を記載して一括処理します）

さらに、処理フェーズを `--phase` オプションで制御できます。

- `collect`: 情報収集のみ
- `score`: 既存の収集結果に対するスコアリングのみ
- `all`（デフォルト）: 収集＋スコアリングをまとめて実行

### 開発モード（ts-node）

#### 企業リスト CSV を指定して実行

```bash
npm run dev -- "<企業リストCSVパス>" [--debug] [--phase=collect|score|all] [--email-verifications-csv=<EmailHippo CSVパス>]
```

CSV の例（ヘッダー必須）:

```csv
name,domain,department
株式会社さくらケーシーエス,kcs.co.jp,情報システム部
株式会社ABCホールディングス,abc.co.jp,経営企画部
```

各行について、`name`・`domain`・`department` を読み取り、1 社ずつ順番にスキャンします。

`--debug` や `--phase` を併用できます。

- オプション:
  - `--debug`:
    - Web 検索を行わず、ハードコードされたサンプル担当者を返すデバッグモード
    - OpenAI API / Web 検索を使わずにフローを確認したいときに利用します
  - `--phase=collect|score|all`:
    - `collect`: 情報収集（Web 検索・メールパターン推定・担当者候補抽出・メール検証）だけ実行し、生データを保存します
    - `score`: 既に保存されている生データから CSV 出力だけ行います（新規の Web 検索やメール検証は行いません）
    - `all`: `collect` と `score` を連続実行します（明示しない場合のデフォルト）
  - `--email-verifications-csv=<path>`:
    - EmailHippo などで手動検証したメールアドレスの CSV を指定
    - `score` フェーズで DNS 検証結果より優先してスコアリングに利用されます

### ビルド＆実行

```bash
# TypeScript をビルド
npm run build

# ビルド済み JavaScript を実行（企業リスト CSV）
npm start -- "<企業リストCSVパス>" [--debug] [--phase=collect|score|all] [--email-verifications-csv=<EmailHippo CSVパス>]
```

`--phase` オプションの意味:

- `collect`: 情報収集フェーズのみ（Web 検索・メールパターン推定・担当者候補抽出・メール検証）を実行し、生データを `outputs/company_scans/` に保存します（CSV には書き出しません）。
- `score`: 既に `collect`（または `all`）で保存済みの生データを読み込み、スコアリングと CSV 出力のみを行います（新規の Web 検索やメール検証は行いません）。
- `all`（デフォルト）: `collect` と `score` を連続実行します。

### 典型的な利用パターン

#### 1. 一度だけ収集して、そのまま CSV 出力まで行いたい場合

```bash
npm run dev -- "./companies.csv"
```

`--phase` を指定しない場合は `all` とみなされ、情報収集 → スコアリング → CSV 出力まで一度に実行されます。

#### 2. 情報収集は一度だけ実行し、スコアリングや CSV 出力を何度かやり直したい場合

```bash
# まず collect だけ実行して生データを保存
npm run dev -- "./companies.csv" --phase=collect

# 後から score だけ実行（Web 検索やメール検証は再実行しない）
# EmailHippo 検証結果（任意）がある場合は同時に指定
npm run dev -- "./companies.csv" --phase=score --email-verifications-csv="./emailhippo.csv"
```

`collect` による生データは、各行の `domain` と `department` の組み合わせごとに  
`outputs/company_scans/<domain>__<department>.json` という名前で保存されます。  
`score` フェーズではこれらのファイルを読み込み、現在のロジックに基づいて CSV を再生成します。

---

## 出力される CSV

`saveAsCsvFiles` により、常に `outputs/` 直下に「テーブル単位の CSV ファイル」が 4 つ生成されます（複数社を処理した場合は追記されていきます）。

- 出力先ディレクトリ: `outputs/`

生成されるファイル（いずれも複数社分を追記していきます）:

- 会社テーブル: `outputs/companies.csv`
  - カラム: `ID`, `Name`, `Domain`
- 担当者テーブル: `outputs/contacts.csv`
  - カラム: `ID`, `Company ID`, `Name`, `Position`, `Department`, `First Name`, `Last Name`
- メールアドレス候補テーブル: `outputs/email_candidates.csv`
  - カラム: `ID`, `Contact ID`, `Email`, `Is Primary`, `Confidence`, `Type`, `Pattern`, `Is Deliverable`, `Has MX Records`, `Verification Reason`
- メールパターンテーブル: `outputs/email_patterns.csv`
  - カラム: `ID`, `Company ID`, `Pattern`, `Reason`

内部的には、メール検証結果は `EmailVerificationRecordSchema` に従って  
`outputs/email_verifications.json` にキャッシュされます（CSV には直接出力されません）。

---

## メールパターンと候補生成ロジック

- メールパターン推定（`detectEmailPattern`）
  - `EmailPatternSchema` に定義されたパターン（例: `first.last`, `last_first`, `f.last`, `flast` など）から 1 つを選択
  - Web 上の公開メールアドレスをもとに、どのパターンが主に使われているかを LLM で推定
- メール候補生成（`generateEmailCandidates`）
  - `firstName`, `lastName`, `domain` と推定パターンをもとに、複数のメール候補を生成
  - 推定されたパターンがある場合は、そのパターンに合致する候補を優先的に先頭に並べる

## メール検証とスコアリングロジック

- DNS MX 検証（`DnsMxEmailVerifier`）
  - ドメインの MX レコードを引き、存在すれば `hasMxRecords = true` として `isDeliverable` を真寄りに評価
- EmailHippo の手動検証結果（`emailHippoCsvLoader`）
  - `CheckedEmailAddress`, `Status`, `AdditionalStatusInfo` などの列を読み込み
  - `Status === "Ok"` の場合は高いスコア、`Bad` などの場合は低いスコアとして扱う
- スコア統合（`adjustEmailConfidence`）
  - EmailHippo の結果があるメールアドレスはそちらを優先
    - OK の場合は confidence を最低 0.9 まで引き上げ
    - NG の場合は最大 0.1 まで下げる
  - EmailHippo 結果がない場合は、DNS/MX の有無に応じて confidence を微調整

---

## 注意事項

- OpenAI API と Web 検索を利用するため、実行時に API 利用料金が発生します。
- Web 上の情報に依存するため、取得される担当者情報は不完全・誤りを含む可能性があります。

---

## 今後の拡張アイデア

- 取得結果の重複排除やスコアリング（役職・部署・出典ページなどに基づく）  
- 既存 CRM / MA ツールへのインポート用フォーマット拡張
