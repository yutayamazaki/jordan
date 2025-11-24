# データベース定義（SQLite, `data/jordan.sqlite`）

タイムスタンプは `INTEGER`（Unix time）で保存されます。`INTEGER` のブール値は 0/1 です。

## companies

| カラム名           | 型      | 制約            | 説明                                |
|--------------------|---------|-----------------|-------------------------------------|
| id                 | TEXT    | PRIMARY KEY     | 企業 ID（UUID）                    |
| name               | TEXT    | NOT NULL        | 企業名                               |
| website_url        | TEXT    |                 | 代表サイト URL                       |
| description        | TEXT    |                 | 企業説明                             |
| industry           | TEXT    |                 | 業種                                 |
| city               | TEXT    |                 | 市区町村                             |
| employee_range     | TEXT    |                 | 従業員規模（例: "1-10", "11-50"）    |
| primary_domain_id  | INTEGER |                 | プライマリドメインの ID（任意）      |
| created_at         | INTEGER | NOT NULL        | 作成日時                             |
| updated_at         | INTEGER | NOT NULL        | 更新日時                             |

索引: `idx_companies_name (name)`

## domains

| カラム名       | 型      | 制約                                 | 説明                                |
|----------------|---------|--------------------------------------|-------------------------------------|
| id             | TEXT    | PRIMARY KEY                          | ドメイン ID（UUID）                 |
| company_id     | TEXT    | NOT NULL, FOREIGN KEY → companies(id) ON DELETE CASCADE | 紐付く企業 |
| domain         | TEXT    | NOT NULL, UNIQUE                     | ドメイン（例: example.com）         |
| disposable     | INTEGER | NOT NULL DEFAULT 0                   | 使い捨てドメインか                   |
| webmail        | INTEGER | NOT NULL DEFAULT 0                   | Web メールドメインか                |
| accept_all     | INTEGER | NOT NULL DEFAULT 0                   | Accept-All ドメインか               |
| pattern        | TEXT    |                                      | 推定/既知のメールパターン            |
| first_seen_at  | INTEGER |                                      | 初回検出日時                         |
| last_seen_at   | INTEGER |                                      | 最終検出日時                         |
| created_at     | INTEGER | NOT NULL                             | 作成日時                             |
| updated_at     | INTEGER | NOT NULL                             | 更新日時                             |

索引: `idx_domains_domain (domain, UNIQUE)`, `idx_domains_company_id (company_id)`

## contacts

| カラム名      | 型      | 制約                                 | 説明                                   |
|---------------|---------|--------------------------------------|----------------------------------------|
| id            | TEXT    | PRIMARY KEY                          | 担当者 ID（UUID）                     |
| company_id    | TEXT    | NOT NULL, FOREIGN KEY → companies(id) ON DELETE CASCADE | 紐付く企業 |
| full_name     | TEXT    | NOT NULL                             | 氏名（フルネーム）                     |
| first_name    | TEXT    |                                      | 名                                      |
| last_name     | TEXT    |                                      | 姓                                      |
| position      | TEXT    |                                      | 役職                                    |
| department    | TEXT    |                                      | 部署                                    |
| department_category | TEXT |                                    | 部署カテゴリ（正規化）                   |
| seniority     | TEXT    |                                      | シニアリティ（例: C-level, Manager）    |
| city          | TEXT    |                                      | 市区町村                                |
| linkedin_url  | TEXT    |                                      | LinkedIn URL                            |
| twitter_url   | TEXT    |                                      | Twitter/X URL                           |
| phone_number  | TEXT    |                                      | 電話番号                                |
| source_label  | TEXT    |                                      | 取得元のラベル                          |
| source_url    | TEXT    |                                      | その人を見つけた URL                    |
| first_seen_at | INTEGER |                                      | 初回検出日時                            |
| last_seen_at  | INTEGER |                                      | 最終検出日時                            |
| created_at    | INTEGER | NOT NULL                             | 作成日時                                |
| updated_at    | INTEGER | NOT NULL                             | 更新日時                                |

索引: `idx_contacts_company_id (company_id)`, `idx_contacts_position_department (position, department)`, `idx_contacts_created_at (created_at)`

## emails

| カラム名      | 型      | 制約                                         | 説明                                    |
|---------------|---------|----------------------------------------------|-----------------------------------------|
| id            | TEXT    | PRIMARY KEY                                  | メール ID（UUID）                      |
| contact_id    | TEXT    | FOREIGN KEY → contacts(id) ON DELETE SET NULL| 紐付く担当者（任意）                    |
| domain_id     | TEXT    | FOREIGN KEY → domains(id) ON DELETE SET NULL | 紐付くドメイン（任意）                  |
| email         | TEXT    | NOT NULL, UNIQUE                             | メールアドレス                          |
| kind          | TEXT    |                                              | 種別（personal / generic / role 等）    |
| source        | TEXT    |                                              | 生成/取得元（pattern_guess / on_page 等）|
| is_primary    | INTEGER | NOT NULL DEFAULT 0                           | プライマリ判定フラグ                    |
| status        | TEXT    | NOT NULL DEFAULT "pending"                   | 検証ステータス                          |
| confidence    | REAL    |                                              | 信頼度スコア                            |
| first_seen_at | INTEGER |                                              | 初回検出日時                            |
| last_seen_at  | INTEGER |                                              | 最終検出日時                            |
| created_at    | INTEGER | NOT NULL                                     | 作成日時                                |
| updated_at    | INTEGER | NOT NULL                                     | 更新日時                                |

索引: `idx_emails_email (email, UNIQUE)`, `idx_emails_contact_id (contact_id)`, `idx_emails_status (status)`

## email_verifications

| カラム名          | 型      | 制約                                      | 説明                          |
|-------------------|---------|-------------------------------------------|-------------------------------|
| id                | TEXT    | PRIMARY KEY                               | 検証レコード ID（UUID）      |
| email_id          | TEXT    | NOT NULL, FOREIGN KEY → emails(id) ON DELETE CASCADE | 紐付くメール |
| provider          | TEXT    | NOT NULL                                  | 検証プロバイダ（例: emailhippo） |
| result_status     | TEXT    | NOT NULL                                  | 結果ステータス                 |
| score             | REAL    |                                           | プロバイダスコア               |
| regexp_ok         | INTEGER |                                           | 正規表現チェック結果           |
| gibberish         | INTEGER |                                           | 意味のない文字列か             |
| disposable        | INTEGER |                                           | 使い捨てか                     |
| webmail           | INTEGER |                                           | Web メールか                   |
| mx_records_ok     | INTEGER |                                           | MX レコード有無                |
| smtp_check        | INTEGER |                                           | SMTP チェック結果              |
| accept_all        | INTEGER |                                           | Accept-All 判定                |
| block             | INTEGER |                                           | ブロック判定                   |
| reason            | TEXT    |                                           | UI 用の簡易理由                |
| raw_response_json | TEXT    |                                           | 元レスポンス JSON              |
| created_at        | INTEGER | NOT NULL                                  | 作成日時                       |

索引: `idx_email_verifications_email_id (email_id)`, `idx_email_verifications_created_at (created_at)`
