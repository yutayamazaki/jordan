# Jordan

B2B 企業の担当者情報を Web 検索＋LLM（OpenAI Structured Outputs）で収集し、  
メールアドレスのパターン推定・候補生成・EmailHippo による検証結果を SQLite に保存する CLI ツールです。  
加えて、収集したリード情報をブラウザから閲覧・検索するための Next.js 製 Web ダッシュボード（`web/` 配下）も含まれます。

## 機能概要

- 会社名・ドメイン名・ターゲット部署（例: 情シス、マーケなど）を入力すると:
  - Web 検索結果から担当者候補（氏名／役職／部署）を抽出（LLM 利用）
  - 氏名のローマ字（姓・名）を推定
- 会社ドメインに紐づく公開メールアドレスや過去の検証結果から:
  - 一般的なメールアドレス構成パターン（`first.last`, `f_last` など）を推定
- 担当者情報＋推定パターンから複数のメールアドレス候補を生成
- EmailHippo API で deliverability（届くかどうか）やリスクスコアを検証
- すべての結果を SQLite（`data/jordan.sqlite`）のテーブルとして保存

## アーキテクチャ概要

このツールは大きく **collect フェーズ** と **score フェーズ** の 2 段階で動作します。

### 1. collect フェーズ（収集）

- 実装: `collectCompanyScan`（`src/application/runCompanyScan.ts`）
- 主な処理:
  - メールパターン推定
    - LLM（`LlmEmailPatternDetector`）によるドメインごとのパターン推定
    - 過去の学習パターン（`email_patterns` テーブル）を優先的に使用
  - Web 検索＋LLM による担当者候補取得（`LlmContactFinder`）
    - ドメイン × 部署ごとの検索結果は `contact_search_caches` テーブルに最大 90 日間キャッシュし、同じ組み合わせの再検索時は LLM 呼び出しをスキップ
  - 担当者情報などの「生データ」を `CompanyScanRawData` として JSON 化（メール候補はまだ生成しない）
  - JSON を `company_scans` テーブルに保存（`SqliteCompanyScanRawStore`）

collect フェーズは、「あとから再スコアリング可能な生データ」を蓄積する役割です。

### 2. score フェーズ（検証・スコアリング）

- 実装: `scoreCompanyScan` / `scoreCompanyScanFromStored`（`src/application/runCompanyScan.ts`）
- 主な処理:
  - `company_scans` から `CompanyScanRawData` を読み込み
  - 担当者情報からメール候補生成（`createContactAndEmailCandidates`）
  - EmailHippo API（`EmailHippoApiEmailVerifier`）でメールアドレスを検証
  - 検証結果は `email_verifications` テーブルにキャッシュ
  - 検証結果をもとに各メール候補の confidence を補正
  - ドメインオブジェクトをテーブルレコード化し、SQLite に保存（`SqliteLeadExporter`）
    - `companies`
    - `contacts`
    - `email_candidates`
    - `email_patterns`
  - 各ドメインのメールパターンごとに
    - `successCount`（deliverable 件数）
    - `totalCount`（検証件数）
    を集計し、`email_patterns` として保存（メールパターン学習）

score フェーズは、「収集済みの生データに対して後から検証と学習を行う」役割です。

### 3. collect / score / all のオーケストレーション

- `src/application/runCompanyScan.ts`
  - `collectCompanyScan` … collect フェーズ単体
  - `scoreCompanyScan` … 渡された生データに対する score フェーズ
  - `scoreCompanyScanFromStored` … DB に保存済みの生データに対する score フェーズ
  - `runCompanyScan` … `phase: "collect" | "score" | "all"` に応じて上記を組み合わせて実行

## ドメインモデル・スキーマ

[DATBASE.md](./DATBASE.md) に各テーブルのスキーマ定義があります。

### `src/domain/entities/`

アプリケーション内部で扱うドメインエンティティです。

- `Company`, `Contact`, `EmailPattern`, `EmailAddress`, `Department` など
- アプリケーション層はエンティティベースでロジックを書き、  
  インフラ層で `zod` スキーマに変換して SQLite に保存します。

## ディレクトリ構成（主要ファイル）

- `src/collect.ts`
  - **collect 専用** のエントリーポイント
  - 企業リスト CSV を読み込み、collect フェーズ（収集）のみを実行
- `src/score.ts`
  - **score 専用** のエントリーポイント
  - 事前に collect 済みの企業に対して score フェーズ（検証・スコアリング）のみを実行
- `src/bootstrap/deps.ts`
  - アプリケーションで使用する依存（LLM アダプタ、EmailHippo アダプタ、SQLite リポジトリなど）を組み立てる共通モジュール
  - `createRunCompanyScanDeps()` で `RunCompanyScanWithStoreDependencies` を構築

### CLI 周り

- `src/cli/parseCliArgs.ts`
  - 位置引数: `csvPath`
  - オプション:
    - `--phase=collect|score|all`（指定がない場合、呼び出し側が渡すデフォルト値を採用）
    - `--email-verifications-csv=...`（将来的な CSV 出力用）
- `src/cli/loadCompaniesFromCsv.ts`
  - 企業リスト CSV から `{ company, department }` の配列に変換

### アプリケーション層

- `src/application/runCompanyScan.ts`
  - collect / score / all フェーズのオーケストレーション
  - `CompanyScanRawStore` 経由で生データ (`CompanyScanRawData`) の保存・読み込み
- `src/application/companyScanDomain.ts`
  - メールパターン決定ロジック（`decideEmailPattern`）
  - 担当者＋メールアドレス候補生成（`createContactAndEmailCandidates`）
  - メール検証結果から confidence を調整（`adjustEmailConfidence`）
  - ドメインエンティティから DB レコード（`CompanyRecord` など）を構築（`buildCompanyDomainEntities`）
- `src/application/emailFinderService.ts`
  - 名前とパターンから複数のメール候補を生成
- `src/application/ports.ts`
  - アプリケーション層が利用するポート（インターフェース）定義
  - `ContactFinder`, `EmailPatternDetector`, `EmailVerifier`,  
    `LeadExporter`, `EmailVerificationRepository`, `EmailPatternRepository`, `ContactSearchCachesRepository`, `IdGenerator` など

### アダプタ層

- `src/adapters/openai.ts`
  - OpenAI SDK を使った Structured Outputs 用ラッパ
  - `OPENAI_API_KEY` を利用
- `src/adapters/llmEmailPatternDetector.ts`
  - ドメインからメールパターンを推定する LLM アダプタ
- `src/adapters/llmContactFinder.ts`
  - Web 検索＋LLM で担当者情報を取得するアダプタ
- `src/adapters/emailHippoApiEmailVerifier.ts`
  - EmailHippo API を呼び出し、`EmailVerificationResult` にマッピング
  - `EMAIL_HIPPO_API_KEY` を利用

### インフラ層

- `src/infrastructure/sqliteClient.ts`
  - `better-sqlite3` を用いた SQLite クライアント
  - 初回アクセス時に `data/jordan.sqlite` を開き、必要なテーブルを `CREATE TABLE IF NOT EXISTS` で作成
- `src/infrastructure/sqliteLeadExporter.ts`
  - スコアリング済みのレコードを SQLite の `companies` / `contacts` / `email_candidates` / `email_patterns` に保存
- `src/infrastructure/sqliteCompanyScanRawStore.ts`
  - collect フェーズの生データ (`CompanyScanRawData`) を `company_scans` テーブルに保存・読み込み
- `src/infrastructure/sqliteEmailVerificationRepository.ts`
  - EmailHippo の検証結果を `email_verifications` テーブルに保存し、一定期間内の結果を再利用
- `src/infrastructure/sqliteEmailPatternRepository.ts`
  - メールパターン学習結果を `email_patterns` テーブルに保存・取得
- `src/infrastructure/sqliteContactSearchCachesRepository.ts`
  - Web 検索＋LLM で取得した担当者情報を `contact_search_caches` テーブルに保存し、同じドメイン × 部署の再検索時にキャッシュを優先的に利用
- `src/infrastructure/idGenerator.ts`
  - UUID ベースの ID 生成

- `web/`
  - Next.js 製の社内向け Web ダッシュボード
  - `web/lib/db.ts` から `../data/jordan.sqlite` を参照し、CLI が保存した `companies` / `contacts` / `email_candidates` などを読み取ります

## セットアップ

### 前提

- Node.js（推奨: 18 以降）
- Web ダッシュボードを利用する場合も同様に Node.js 18 以降を推奨

### インストール

```bash
npm install
cd web
npm install
```

### 環境変数

`.env` などで以下を設定します。

```bash
OPENAI_API_KEY=sk-...
EMAIL_HIPPO_API_KEY=your_email_hippo_key
COLLECT_CONCURRENCY=20
```

SQLite の DB パスはデフォルトで `data/jordan.sqlite` が使われます（`getDb()` の引数で上書き可能）。

collect フェーズの並列実行数は、以下の環境変数で制御できます（デフォルト: 10）。

```bash
COLLECT_CONCURRENCY=20
```

### ローカル開発（テスト・Lint）

開発中の型チェックやテスト、Lint 用のスクリプトです。

```bash
# TypeScript ビルド（型エラー検出）
npm run build

# 単体テスト（Vitest）
npm test

# ESLint による静的解析
npm run lint

# ESLint + 自動修正
npm run lint:fix
```

Web ダッシュボード配下には、Next.js 用のスクリプトがあります。

```bash
cd web

# 開発サーバー
npm run dev

# 本番ビルド
npm run build

# Lint / 型チェック
npm run lint
npm run typecheck
```

## 使い方

CLI と Web ダッシュボードそれぞれの使い方を説明します。

### ビルド

```bash
npm run build
```

### 1. collect フェーズだけ実行

```bash
npm run collect -- ./inputs/companies.csv
```

- 各企業について
  - メールパターン推定
  - 担当者候補収集
  が行われ、結果は `company_scans` テーブルに保存されます（この段階ではメール候補はまだ生成されません）。
- 既に同じドメイン × 部署の collect 結果が存在する場合はデフォルトでスキップされます。上書きしたい場合は `--on-exists=overwrite` を指定してください。

### 2. score フェーズだけ実行

```bash
npm run score
```

- 事前に collect フェーズで `company_scans` に保存された生データを前提とします。
- `company_scans` に保存されている各企業・部署のうち、最新のスキャンについて
  - primary かつ `isDeliverable = true` で、confidence が一定以上（例: 0.8 以上）のメール候補が存在しないものだけを自動で選択し、
  - それらに対して EmailHippo 検証・スコアリングを実行します。
- 検証結果は
  - `email_verifications`
  - `email_candidates`
  - `email_patterns`
  などのテーブルに反映します。

### 3. 会社 Web サイト・ファビコン URL の推定（任意）

Web ダッシュボードで会社のロゴやサイトへのリンクを表示するために、`companies.website_url` / `companies.favicon_url` を自動推定できます。

```bash
npm run guess-website
```

- `companies` テーブルに `website_url` / `favicon_url` カラムが存在しない場合は自動で追加します。
- 各会社のドメインから `https://example.com` や `https://www.example.com` などを HEAD リクエストで試し、応答がある URL を `website_url` として保存します。
- `website_url` をもとに、`/favicon.ico` など代表的なパスを試して `favicon_url` を保存します。

### 4. 既存結果の検索（show-domain）

collect / score 済みの結果を、ドメインから CLI で検索できます。

```bash
# ドメインで検索
npm run show-domain -- --domain example.com
```

- `companies` テーブルから該当企業を検索し、企業ごとに
  - `[Email Patterns]` として `email_patterns` のパターン・成功件数・サンプルアドレスなど
  - `[Contacts and Email Candidates]` として `contacts` と `email_candidates` を紐付けた一覧
  を標準出力に表示します。
- メール候補は primary / alt、confidence、pattern、deliverable（yes/no/unknown）などが分かる形式で表示されます。

## 出力・データ構造

- SQLite DB: `data/jordan.sqlite`
  - `companies` … 会社マスタ
  - `contacts` … 担当者マスタ
  - `email_candidates` … メール候補（deliverable 情報・confidence 付き）
  - `email_patterns` … ドメインごとのメールパターン学習結果
  - `email_verifications` … メール検証結果キャッシュ
  - `company_scans` … collect フェーズでの生データ JSON
  - `contact_search_caches` … Web 検索＋LLM による担当者情報の検索結果キャッシュ（ドメイン × 部署ごとに保存し、一定期間内の再検索で再利用）

必要に応じて、この DB から CSV をエクスポートして既存の CRM / MA ツールにインポートできます。

## Web ダッシュボードの使い方

CLI で `companies` / `contacts` / `email_candidates` などのテーブルがある程度埋まった状態で利用することを想定しています。

### 起動手順

```bash
cd web
npm run dev
```

- デフォルトでは `http://localhost:3000` で起動します。
- `web/lib/db.ts` に記載の通り、アプリケーションルート（`web/`）から見て `../data/jordan.sqlite` を開きます。
  - そのため、CLI から生成した SQLite ファイルをリポジトリ直下の `data/jordan.sqlite` に配置しておく必要があります。

### 画面構成

- `/` … トップページ。Jordan のリードインテリジェンス概要と、各一覧ページへの導線を表示。
- `/companies` … 会社一覧。ドメイン・会社名などでフィルタし、優先すべきターゲット企業を確認できます。
- `/contacts` … 担当者一覧。`contacts` と `email_candidates` テーブルをもとに、deliverable なメールアドレスを含む担当者を検索できます。
- `/contacts/[id]` … 担当者詳細。1 人の担当者に紐づく送信候補メールアドレス（deliverable のものを優先）を表示します。

### 注意事項

- Web ダッシュボードはあくまで内部メンバー向けの閲覧 UI であり、DB への書き込みは行わず、`data/jordan.sqlite` の読み取りのみを行います。
- DB の更新（collect / score / guess-website など）はすべて CLI から行われる前提です。

## 注意事項

- OpenAI API および EmailHippo API の利用に伴い、実行時に API 利用料金が発生します。
- Web 上の情報に依存するため、取得される担当者情報には誤りや古い情報が含まれる可能性があります。
- メール検証はあくまで外部サービスの判断に基づくものであり、実送信の成否を完全に保証するものではありません。

## 今後の拡張アイデア

- 役職・部署・出典ページなどを使ったリードスコアリング
- ドメイン／パターンごとの AB テスト・精度評価
- 既存 CRM / MA ツール用のエクスポートフォーマット拡張
- 取得結果の重複排除や、タイムウィンドウ別の履歴管理
