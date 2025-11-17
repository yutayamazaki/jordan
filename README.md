# Jordan

B2B 企業の担当者情報を Web 検索＋LLM（OpenAI Structured Outputs）で収集し、  
メールアドレスのパターン推定・候補生成・EmailHippo による検証結果を SQLite に保存する CLI ツールです。

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

### `src/domain/index.ts`

DB に保存するレコード形式を `zod` で定義しています。

- `CompanySchema` / `CompanyRecord`
  - `id`, `name`, `domain`
- `ContactSchema` / `ContactRecord`
  - `id`, `companyId`, `name`, `position`, `department`, `departmentCategory`, `firstName`, `lastName`
- `EmailCandidateSchema` / `EmailCandidateRecord`
  - 1 人の担当者に紐づく複数候補メールアドレス
  - `isPrimary`, `confidence`, `type`, `pattern`, `isDeliverable`, `hasMxRecords`, `verificationReason` など
- `EmailPatternRecordSchema` / `EmailPatternRecord`
  - ドメインごとのメールパターン学習結果
  - `pattern`, `reason`, `domain`, `source`, `sampleEmail`, `verifiedAt`, `successCount`, `totalCount`
- `EmailVerificationRecordSchema` / `EmailVerificationRecord`
  - EmailHippo などの検証結果のキャッシュ
  - さまざまな検証結果フィールド（syntax, DNS, mailbox, risk, trust score など）を保持

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
    `LeadExporter`, `EmailVerificationRepository`, `EmailPatternRepository`, `IdGenerator` など

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
- `src/infrastructure/idGenerator.ts`
  - UUID ベースの ID 生成

## セットアップ

### 前提

- Node.js（推奨: 18 以降）

### インストール

```bash
npm install
```

### 環境変数

`.env` などで以下を設定します。

```bash
OPENAI_API_KEY=sk-...

EMAIL_HIPPO_API_KEY=your_email_hippo_key
```

SQLite の DB パスはデフォルトで `data/jordan.sqlite` が使われます（`getDb()` の引数で上書き可能）。

collect フェーズの並列実行数は、以下の環境変数で制御できます（デフォルト: 5）。

```bash
COLLECT_CONCURRENCY=5
```

## 使い方

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
  - メール候補生成
  が行われ、結果は `company_scans` テーブルに保存されます。
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

### 3. 既存結果の検索（show-domain）

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

必要に応じて、この DB から CSV をエクスポートして既存の CRM / MA ツールにインポートできます。

## 注意事項

- OpenAI API および EmailHippo API の利用に伴い、実行時に API 利用料金が発生します。
- Web 上の情報に依存するため、取得される担当者情報には誤りや古い情報が含まれる可能性があります。
- メール検証はあくまで外部サービスの判断に基づくものであり、実送信の成否を完全に保証するものではありません。

## 今後の拡張アイデア

- 役職・部署・出典ページなどを使ったリードスコアリング
- ドメイン／パターンごとの AB テスト・精度評価
- 既存 CRM / MA ツール用のエクスポートフォーマット拡張
- 取得結果の重複排除や、タイムウィンドウ別の履歴管理
