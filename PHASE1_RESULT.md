# フェーズ1実装結果：安全な土台

- 実施日: 2026-08-19（JST）
- 基準コミット: `e49cef7`
- 検証Node.js: `v22.23.2`
- 対象: P0-1〜P0-4のみ

## 結論

フェーズ1のコード実装は完了しました。アプリ本体の機能コードは作り直しておらず、変更はDB migration、セキュリティテスト、CI、依存lockfileに限定しています。

ローカルの実PostgreSQLエンジンではtenant A/B分離テストが16件すべて合格し、既存544テストもすべて合格しました。`npm audit` は本番依存・全依存とも脆弱性0件です。

ただし、このPCにはDocker/Podmanがないため、Supabase CLIによる公式ローカル環境の17個のpgTAP assertionだけは未実行です。同じテストを自動実行するGitHub Actions jobは追加済みです。**次のフェーズへ進む前に、このjobがgreenになることを最後の条件とします。**

## 1. 固定したパイロット条件

- 販売国: United States
- 言語: `en-US`
- 対象: 非医療系、単一担当者、単一拠点、単一Google Calendarの予約制サービス業
- 初期顧客: 1〜3社
- 音声入力・音声返信: 無効
- Stripeセルフ課金: 使用せず、手動請求
- Google Calendar同期失敗: 予約確定と伝えず、人へ引き継ぐ
- 複数スタッフ、複数拠点、Agency、white-label、SDI: 対象外
- AIが判断できない場合: 無理に回答せず、人へ引き継ぐ

今回のフェーズでは、これらの英語機能や表示変更にはまだ着手していません。

## 2. 変更した内容

### P0-1 tenant A/Bの実DBテスト基盤

- `@electric-sql/pglite` とpgvector拡張を開発依存へ追加しました。モックDBではなく、組み込みの実PostgreSQLエンジンで空DBから全migrationを適用します。
- tenant A/Bとowner/admin/member相当のJWT claimを作り、tenant所属21テーブル、非tenantの `contact_submissions`、SELECT/INSERT/UPDATE/DELETE、異常role、tenant claim欠落を検証するテストを追加しました。
- DBテストは重いため通常unit testから分離し、`npm run test:db` で明示実行します。CIでは通常テストとDBテストの両方を実行します。
- `supabase/config.toml` と17 assertionのpgTAPテストを追加しました。
- GitHub ActionsへNode 22、PGlite、Supabase CLI 2.115.0、Docker上の実Supabaseを使う `database-integration` jobを追加しました。

主な対象:

- `tests/database/pglite-test-database.ts`
- `tests/database/tenant-isolation.test.ts`
- `vitest.database.config.ts`
- `supabase/config.toml`
- `supabase/tests/tenant_isolation.test.sql`
- `.github/workflows/ci.yml`
- `package.json` / `package-lock.json`

### P0-2 `current_tenant_role()` 修正

- 過去migrationを編集せず、新しいmigrationで関数を再定義しました。
- Supabaseのトップレベル `role=authenticated` をtenant権限として使わず、`app_metadata.role` の `owner` / `admin` / `member` だけを許可します。
- 未知のrole、role欠落は空文字となり、権限なしになります。
- 静的migration lintも、単なる文字列存在確認ではなく、最後に有効になる関数定義を検査するよう強化しました。

主な対象:

- `supabase/migrations/202608190001_fix_current_tenant_role.sql`
- `scripts/check-rls-migration.mjs`

### P0-3 MVPのservice-role越境検証と局所修正

- 予約、会話、FAQ、Google Calendar、WhatsApp、handoff、operator outboxの主要28 repositoryメソッドについて、tenant IDとresource IDの両方がquery/payloadに残ることを自動検査します。
- 既存repository実装を全面置換していません。主要28メソッドの手書きtenant guardには、今回修正が必要な欠落は見つかりませんでした。
- DBでは、RLSを迂回するservice roleが `tenant_id=A` のchild rowへtenant Bのparent IDを混ぜられる問題を確認したため、MVP経路に限って複合外部キーを追加しました。

追加した境界:

- `messages(tenant_id, conversation_id)` → 同じtenantの `conversations`
- `appointments(tenant_id, conversation_id)` → 同じtenantの `conversations`
- `appointments(tenant_id, service_id)` → 同じtenantの `services`
- `whatsapp_outbox_jobs(tenant_id, message_id)` → 同じtenantの `messages`

既存データに異tenantリンクがある場合は、migrationの `VALIDATE CONSTRAINT` が意図的に失敗します。問題を黙って信頼済みにしないためです。

主な対象:

- `supabase/migrations/202608190002_enforce_mvp_tenant_relationships.sql`
- `tests/security/mvp-service-role-boundaries.test.ts`

### P0-4 High脆弱性の解消

アプリのmajor upgradeや `npm audit fix --force` は使わず、lockfileの互換更新だけで解消しました。

| package | 修正前 | 修正後 | 用途 |
|---|---:|---:|---|
| `nanoid` | 3.3.16 | 3.3.18 | 本番依存（PostCSS経由） |
| `js-yaml` | 4.3.0 | 4.3.1 | 開発依存 |
| `brace-expansion` | 1.1.16 / 5.0.8 | 1.1.18 / 5.0.9 | 開発依存 |

CIのdependency auditも、本番依存だけでなく全依存をHigh gateの対象にしました。

## 3. 調査中に発見した問題

### 3.1 既存の最初のmigrationが空DBで失敗する

既存の `appointments_no_confirmed_overlap` は、`timestamptz + interval` をGiST index式に直接使っています。PostgreSQLではこの演算が `STABLE` であり、index式に必要な `IMMUTABLE` ではないため、空DBへの初期migrationが停止しました。

過去migrationは変更していません。直前に実行される互換migrationを新規追加し、同じ `appointments` schemaと、`IMMUTABLE` な `appointment_time_range()` を使う有効な重複防止制約を先に作りました。これにより、既存migrationの `IF NOT EXISTS` guardが不正な定義だけをスキップします。

主な対象:

- `supabase/migrations/202604240000_prepare_appointments_overlap.sql`

注意点:

- 新規の空DBではそのまま適用できます。
- すでに後続migration履歴が記録された既存Supabaseへ適用する場合は、古いversion番号の新規migrationを含める手順確認が必要です。最初のパイロットはfresh staging DBを推奨します。

### 3.2 `current_tenant_role()` がowner/adminを返さない

トップレベルの `authenticated` が先に選ばれるため、owner/admin用RLS policyが常にfalseになる問題を実DBテストで再現し、修正しました。

### 3.3 RLSだけでは異tenantの親子リンクを防げない

RLSはchild rowの `tenant_id` だけを見ます。従来の単一ID外部キーでは、service roleまたは許可されたinsertからtenant Aのchildをtenant Bのparentへ関連付けられました。MVPの4経路へ複合外部キーを追加しました。

### 3.4 ローカル環境にDocker/Podmanがない

`supabase start` は次の理由で未実行です。

```text
docker: command not found (podman also not found)
```

テストコードや設定の問題ではなく、このPCの実行環境不足です。GitHub Actions上ではDockerを利用できます。

### 3.5 Windows production buildの既知問題

Node 22でproduction buildはコンパイル、型検査、94ページの静的生成まで成功しました。最後のtrace処理で、既存の `outputFileTracingRoot` のWindowsパス解釈により次で失敗しました。

```text
EPERM: operation not permitted, mkdir 'C:\Users\Users'
```

これは監査時から既知で、計画上はP0-8の対象です。フェーズ1では `next.config.ts` を変更していません。

## 4. tenant A/B分離テスト結果

### ローカル実PostgreSQLエンジン

結果: **16/16合格**

確認内容:

- 空DBから全migrationを順番に適用
- tenant Aからtenant Bを参照不可（21 tenant table）
- tenant Bからtenant Aを参照不可（21 tenant table）
- `ai_prompts` はglobal rowと自tenant rowだけ参照可能
- tenant Aによるtenant B rowのINSERTをRLSが拒否
- tenant Aによるtenant B rowのUPDATE/DELETEは0件で、Bの値は不変
- owner/admin/memberを `app_metadata` から正しく取得
- 未知roleとtenant claim欠落は権限なし
- authenticated tenant userから `contact_submissions` を参照不可
- service roleが両tenantを扱えること自体は維持
- service roleでも異tenantのconversation/service/messageをchildへ関連付け不可
- 同一tenant内の重複予約防止制約が引き続き有効

### Supabase CLI / pgTAP

- 17 assertionを作成済み
- GitHub Actions jobを作成済み
- ローカル結果: **未実行（Docker/Podmanなし）**
- 完了条件: `Supabase tenant isolation` jobのgreen

## 5. High脆弱性の残件数

| 監査 | High | Critical | 全脆弱性 |
|---|---:|---:|---:|
| `npm audit --omit=dev --audit-level=high` | 0 | 0 | 0 |
| `npm audit --audit-level=high` | 0 | 0 | 0 |

**High残件数: 0件**

## 6. 既存544テストへの影響

- 既存544件: **544/544合格**
- 新規service-role境界テスト: **28/28合格**
- 通常suite合計: **572/572合格**（83 files）
- 新規DB統合テスト: **16/16合格**（別suite）
- 合計: **588件合格**

Windows/OneDrive上では、既存のroute dynamic-importテスト2件が並列時だけ5秒timeoutになるため、影響確認はNode 22で `--fileParallelism=false` を付けて実行しました。テスト内容やアプリコードの回帰ではなく、同じ2件は逐次実行で合格しています。DB suiteは通常suiteから分離したため、CIの通常テストへWASM PostgreSQLの起動負荷を混ぜません。

## 7. その他の検証結果

| 検証 | 結果 |
|---|---|
| Node.js | `v22.23.2` |
| TypeScript | 合格 |
| ESLint | エラー0、既存warning 4 |
| migration静的lint | 22テーブルすべてRLS有効、追加guard合格 |
| production build | compile・型・94ページ生成まで合格。Windows traceのみ既知のP0-8問題で失敗 |
| 外部サービス実アカウント | 不要、使用なし |

## 8. 既存機能への影響とリスク

- 認証、Stripe、WhatsApp、Google Calendar、予約serviceは作り直していません。
- `src/` 配下の本番アプリコードは変更していません。
- 過去migrationは直接変更していません。
- 新しい複合外部キーは、正常な同一tenantデータには影響しません。既存の異tenantリンクがあるDBだけはmigration時に停止します。
- `current_tenant_role()` 修正後、既存ユーザーの古いJWTへ新claimを反映するには再ログインまたはtoken refreshが必要です。
- 互換migrationはversion順の都合で既存初期migrationより前に配置しています。既存remote DBへ適用する場合は、fresh stagingでの検証を先に行います。

## 9. 次のフェーズへ進んで問題ないか

**条件付きで進んで問題ありません。** 次の条件を満たした後に、フェーズ2（P0-5英語AI・安全判定・handoff、P0-6英語予約とCalendar失敗時handoff）へ進むのが安全です。

1. GitHub Actionsの `Supabase tenant isolation` jobを1回greenにする。
2. pilot用Supabaseが既存DBの場合、異tenantリンクが0件であることを確認してからmigrationを適用する。可能ならfresh staging DBを使う。
3. owner/admin/memberの既存ユーザーclaimが `app_metadata` に入っていることをstagingで確認し、必要なら再ログインする。

Windows build traceの修正は計画どおりP0-8で対応可能であり、フェーズ2の英語機能実装を始めるための直接のブロッカーではありません。ただしパイロット公開前には必ず解消します。

## 10. 次に行うこと

この段階で実装を停止します。確認後の推奨順序は次のとおりです。

1. 今回のGitHub Actions DB jobをgreenにする
2. P0-5: `en-US` の英語FAQ、安全判定、fallback、human handoff
3. P0-6: 英語の予約作成・変更・取消とCalendar同期失敗時handoff
4. P0-7: 音声、Stripeセルフ課金、イタリア固有・MVP外機能をpilot導線から非表示
5. P0-8: Node 22のWindows path、cross-platform typecheck、clean release gate

ユーザーの確認があるまで、フェーズ2のコード変更は開始しません。
