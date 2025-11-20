# データベース定義（SQLite, `data/jordan.sqlite`）

## companies

| カラム名      | 型    | 制約                     | 説明                          |
|--------------|-------|--------------------------|-------------------------------|
| id           | TEXT  | PRIMARY KEY              | 企業 ID（UUID）               |
| name         | TEXT  | NOT NULL                 | 企業名                        |
| domain       | TEXT  | NOT NULL                 | 企業ドメイン                  |
| website_url  | TEXT  |                          | Web サイト URL                |
| favicon_url  | TEXT  |                          | ファビコン URL                |

## contacts

| カラム名           | 型   | 制約                                | 説明                           |
|--------------------|------|-------------------------------------|--------------------------------|
| id                 | TEXT | PRIMARY KEY                         | 担当者 ID（UUID）             |
| company_id         | TEXT | NOT NULL, FOREIGN KEY → companies   | 企業 ID                        |
| name               | TEXT | NOT NULL                            | 氏名（フルネーム）            |
| position           | TEXT | NOT NULL                            | 役職                           |
| department         | TEXT | NOT NULL                            | 部署名                         |
| department_category| TEXT | NOT NULL                            | 部署カテゴリ                   |
| first_name         | TEXT | NOT NULL                            | 名                             |
| last_name          | TEXT | NOT NULL                            | 姓                             |

## email_candidates

| カラム名           | 型    | 制約                              | 説明                                   |
|--------------------|-------|-----------------------------------|----------------------------------------|
| id                 | TEXT  | PRIMARY KEY                       | メール候補 ID（UUID）                 |
| contact_id         | TEXT  | NOT NULL, FOREIGN KEY → contacts  | 担当者 ID                              |
| email              | TEXT  | NOT NULL                          | メールアドレス候補                     |
| is_primary         | INTEGER | NOT NULL                        | プライマリ候補か（0/1）                |
| confidence         | REAL  | NOT NULL                          | 信頼度スコア                           |
| type               | TEXT  | NOT NULL                          | メール種別                             |
| pattern            | TEXT  |                                   | 使用したパターン文字列                 |
| is_deliverable     | INTEGER |                                   | 到達可能フラグ（0/1, null 可）        |
| has_mx_records     | INTEGER |                                   | MX レコード有無（0/1, null 可）       |
| verification_reason| TEXT  |                                   | 検証結果の補足                        |

## email_patterns

| カラム名       | 型    | 制約                              | 説明                                    |
|----------------|-------|-----------------------------------|-----------------------------------------|
| id             | TEXT  | PRIMARY KEY                       | パターン ID（UUID）                    |
| company_id     | TEXT  | NOT NULL, FOREIGN KEY → companies | 企業 ID                                 |
| pattern        | TEXT  | NOT NULL                          | メールアドレスパターン                  |
| reason         | TEXT  | NOT NULL                          | パターン採用理由                        |
| domain         | TEXT  |                                   | 対象ドメイン                            |
| source         | TEXT  |                                   | 由来（llm / email_hippo など）          |
| sample_email   | TEXT  |                                   | サンプルメールアドレス                  |
| verified_at    | TEXT  |                                   | 最終検証日時（ISO 文字列）              |
| success_count  | INTEGER |                                  | 成功回数（null 可）                    |
| total_count    | INTEGER |                                  | 総試行回数（null 可）                  |

## email_verifications

| カラム名                   | 型     | 制約        | 説明                                           |
|----------------------------|--------|-------------|------------------------------------------------|
| id                         | TEXT   | PRIMARY KEY | 検証結果 ID（UUID）                           |
| email                      | TEXT   | NOT NULL    | 検証対象メールアドレス                        |
| is_deliverable             | INTEGER| NOT NULL    | 到達可能か（0/1）                              |
| has_mx_records             | INTEGER| NOT NULL    | MX レコード有無（0/1）                         |
| reason                     | TEXT   |             | 検証結果の概要                                 |
| verified_at                | TEXT   | NOT NULL    | 検証日時（ISO 文字列）                         |
| source                     | TEXT   |             | 検証元（dns_mx / email_hippo 等）             |
| mailbox_result             | TEXT   |             | メールボックス状態                             |
| mailbox_reason             | TEXT   |             | メールボックス状態の理由                       |
| syntax_is_valid            | INTEGER|             | 構文が有効か（0/1, null 可）                   |
| syntax_reason              | TEXT   |             | 構文判定の理由                                 |
| domain_has_dns_record      | INTEGER|             | DNS レコード有無（0/1, null 可）               |
| domain_has_mx_records      | INTEGER|             | MX レコード有無（0/1, null 可）                |
| inbox_quality_score        | REAL   |             | インボックス品質スコア                         |
| send_recommendation        | TEXT   |             | 送信推奨度                                     |
| is_disposable_email_address| INTEGER|             | 使い捨てアドレスか（0/1, null 可）             |
| is_spam_trap               | INTEGER|             | スパムトラップか（0/1, null 可）               |
| overall_risk_score         | REAL   |             | 総合リスクスコア                               |
| hippo_trust_score          | REAL   |             | Hippo Trust スコア                             |
| hippo_trust_level          | TEXT   |             | Hippo Trust レベル                             |
| mail_server_location       | TEXT   |             | メールサーバーのロケーション                   |
| mail_service_type_id       | TEXT   |             | メールサービス種別 ID                          |
| status                     | TEXT   |             | ステータス                                     |
| additional_status_info     | TEXT   |             | ステータスに関する追加情報                     |
| domain_country_code        | TEXT   |             | ドメインの国コード                             |
| mail_server_country_code   | TEXT   |             | メールサーバーの国コード                       |
| raw_response_snippet       | TEXT   |             | 元レスポンスの一部                             |

## company_scans

| カラム名       | 型     | 制約        | 説明                                |
|----------------|--------|-------------|-------------------------------------|
| id             | TEXT   | PRIMARY KEY | スキャン ID（UUID）                |
| company_id     | TEXT   | NOT NULL    | 企業 ID                            |
| company_name   | TEXT   | NOT NULL    | 企業名                             |
| company_domain | TEXT   | NOT NULL    | 企業ドメイン                       |
| department     | TEXT   | NOT NULL    | 対象部署                           |
| debug          | INTEGER| NOT NULL    | デバッグフラグ（0/1）              |
| raw_json       | TEXT   | NOT NULL    | 生データ（JSON 文字列）           |
| created_at     | TEXT   | NOT NULL    | 作成日時（ISO 文字列）             |
