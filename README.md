# jordan-ai

B2B 企業の担当者情報を Web 検索＋LLM（OpenAI Structured Outputs）で収集し、  
メールアドレスのパターン推定とアドレス候補生成までを自動化し、CSV で出力する CLI ツールです。

---

## 機能概要

- 会社名・ドメイン名・ターゲット部署を入力すると、  
  - Web 検索結果から担当者候補（氏名／役職／部署）を抽出
  - 氏名のローマ字（姓・名）を推定
- 会社ドメインから、実際に公開されているメールアドレス例をもとに  
  - 一般的なメールアドレス構成パターン（例: `first.last`, `f_last` など）を推定
- 担当者情報とメールパターンから、複数のメールアドレス候補を生成
- 上記の情報を CSV（疑似 DB テーブル形式）として `outputs/` 以下に保存

---

## ディレクトリ構成

- `src/index.ts`
  - メイン処理エントリーポイント
  - 処理フロー:
    1. 対象会社情報・部署・デバッグフラグの設定
    2. メールドメインからメールパターン推定（`detectEmailPattern`）
    3. Web 検索による担当者情報収集（`searchContacts`）
    4. 担当者ごとのメールアドレス候補生成（`generateEmailCandidates`）
    5. DB テーブル相当のレコードに変換
    6. `outputs/<domain>/` 以下に CSV 出力（`saveAsCsvFiles`）
- `src/adapters/openai.ts`
  - OpenAI SDK ラッパー
  - `createStructuredOutputsCompletions`
    - `chat.completions.parse`（`gpt-4o-search-preview`）を利用
    - `web_search` オプションを使った Web 検索 ＋ Structured Outputs
  - `createStructuredOutputs`
    - `responses.parse`（`gpt-5-mini-2025-08-07`）を利用
    - `zod` スキーマに基づいたパースを行い、`neverthrow` で `Result` 型を返却
- `src/domain/index.ts`
  - CSV 出力用の「DB テーブル」スキーマ定義（`zod`）
    - `CompanySchema` / `ContactSchema` / `EmailCandidateSchema` / `EmailPatternRecordSchema`
- `src/domain/entities/company.ts`
  - アプリケーション内で利用する会社エンティティ `Company`
- `src/domain/entities/contact.ts`
  - Web 検索で取得する担当者情報のスキーマ（`ContactResponseSchema`／`ContactListResponseSchema`）

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

### 開発モード（ts-node）

```bash
npm run dev -- "<会社名>" "<ドメイン>" "<部署>" [--debug]
```

例

```bash
npm run dev -- "株式会社さくらケーシーエス" "kcs.co.jp" "情報システム部"
```

- 引数:
  - `<会社名>`: 例 `株式会社さくらケーシーエス`
  - `<ドメイン>`: 例 `kcs.co.jp`
  - `<部署>`: 例 `情報システム部`
- オプション:
  - `--debug`: Web 検索を行わず、ハードコードされたサンプル担当者を返すデバッグモード

### ビルド＆実行

```bash
# TypeScript をビルド
npm run build

# ビルド済み JavaScript を実行
npm start -- "<会社名>" "<ドメイン>" "<部署>" [--debug]
```

---

## 出力される CSV

`saveAsCsvFiles` により、ドメインの `.` を `_` に置換したディレクトリ配下に CSV が生成されます。

例: ドメインが `kcs.co.jp` の場合

- 出力先ディレクトリ: `outputs/kcs_co_jp/`

生成されるファイル:

- `outputs/<domain_置換>/companies.csv`
  - 会社テーブル
  - カラム: `ID`, `Name`, `Domain`
- `outputs/<domain_置換>/contacts.csv`
  - 担当者テーブル
  - カラム: `ID`, `Company ID`, `Name`, `Position`, `Department`, `First Name`, `Last Name`
- `outputs/<domain_置換>/email_candidates.csv`
  - メールアドレス候補テーブル
  - カラム: `ID`, `Contact ID`, `Email`
- `outputs/<domain_置換>/email_patterns.csv`
  - 推定されたメールアドレスパターンテーブル
  - カラム: `ID`, `Company ID`, `Pattern`, `Reason`

---

## メールパターンと候補生成ロジック

- メールパターン推定（`detectEmailPattern`）
  - `EmailPatternSchema` に定義されたパターン（例: `first.last`, `last_first`, `f.last`, `flast` など）から 1 つを選択
  - Web 上の公開メールアドレスをもとに、どのパターンが主に使われているかを LLM で推定
- メール候補生成（`generateEmailCandidates`）
  - `firstName`, `lastName`, `domain` と推定パターンをもとに、複数のメール候補を生成
  - 推定されたパターンがある場合は、そのパターンに合致する候補を優先的に先頭に並べる

---

## 注意事項

- OpenAI API と Web 検索を利用するため、実行時に API 利用料金が発生します。
- Web 上の情報に依存するため、取得される担当者情報は不完全・誤りを含む可能性があります。
- 現状、API キーがコードに直書きされているため、リポジトリを公開する場合は必ず環境変数管理＋キーのローテーションを行ってください。

---

## 今後の拡張アイデア

- 取得結果の重複排除やスコアリング（役職・部署・出典ページなどに基づく）  
- 既存 CRM / MA ツールへのインポート用フォーマット拡張
