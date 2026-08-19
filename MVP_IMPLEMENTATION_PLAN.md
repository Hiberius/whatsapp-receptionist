# 英語圏向け管理付き有料パイロット 最小実装計画

- 作成日: 2026-08-19
- 対象リポジトリ: `Hiberius/whatsapp-receptionist`
- 調査時コミット: `e49cef78ea8f370d4406fcb996664a8b83103fe3`
計画の状態: **実装前。コード変更はまだ行わない。**

本計画は、一般公開SaaSではなく、英語圏の非医療系・単一担当者ビジネス1〜3社へ提供する**管理付き有料パイロット**を最短で安全に開始するためのものです。

開発判断は次の順序を守ります。

> Reuse > Modify > Replace > Rewrite

既存の認証、Stripe、WhatsApp、Google Calendar、Supabase、予約処理、outboxは、問題が証明された箇所だけを局所的に修正します。全面的な作り直しは行いません。

---

## 0. 計画の前提と規模の見方

### 現在の確認済みベースライン

- Vitestの既存テスト544件は合格済み。
- TypeScriptの型チェックは合格済み。
- ESLintはエラーなし、既存warning 4件。
- RLSの静的検査では22テーブルがRLS有効。ただし、実Postgresとtenant A/Bを使う越境テストは未実施。
- 本番依存にはHigh脆弱性が1件残っている。`postcss@8.5.23` 経由の `nanoid@3.3.16`。
- `package.json` はNode.js `>=22 <23`を要求し、CIもNode 22を使う。一方、今回の調査環境はNode 25であり、正式なNode 22検証はまだ必要。
- Windowsでは `npm run verify` 内のUnix専用 `rm -f` が失敗する。
- Windowsのproduction buildは最終trace処理で `outputFileTracingRoot` のパス解釈により失敗する。
- 既存の予約作成・変更・取消はGoogle Calendar同期失敗を記録できるが、WhatsApp側が同期失敗時にも成功を断言し得る。

### 変更規模

| 表記 | 目安 |
|---|---|
| XS | 設定・文言・lockfile等の局所変更。半日程度まで |
| S | 1つの機能と関連テスト。0.5〜1.5開発日程度 |
| M | 複数モジュールと統合テスト。2〜4開発日程度 |
| L | 横断変更または実サービス検証を含む。5開発日以上、または外部審査待ちあり |

日数は設計上の概算です。Meta/WhatsAppやGoogleの審査・設定待ちは、開発日数とは別です。

---

## 1. MVPの最終対象範囲

### 提供する機能

1. WhatsAppで受信した英語テキストの受付
2. 登録済みFAQ・ナレッジベースに基づくAI回答
3. 単一担当者・単一Google Calendarの空き確認
4. 予約作成
5. 予約変更
6. 予約キャンセル
7. 明示的な希望、安全上の懸念、判断不能、外部サービス障害時の人への引き継ぎ

### 商品・運用上の制限

- 顧客企業は1〜3社に限定する。
- 1社につきWhatsApp番号1つ、担当者1人、Google Calendar 1つを基本とする。
- 初期設定、外部サービス接続、FAQ登録は運営者が代行する。
- 非医療系に限定し、診断、治療、法律・税務・金融助言、緊急対応を商品機能として約束しない。
- AIであることを明示する。
- 人への引き継ぎは、会話の `escalated` 化、顧客への英語案内、担当者へのメール通知を基本とする。
- Stripeの既存実装は壊さないが、パイロット料金は手動請求でもよい。セルフサービス課金はMVPの成立条件にしない。

### 今回提供しない機能

- 音声入力の文字起こし、音声返信
- Fatture in Cloud / SDI
- Agency、white-label
- 複数スタッフ、複数予約リソース、複数拠点
- 大規模な管理画面再構築
- 完全な多言語基盤
- 大量の英語ブログ、SEOページ、業種別ページ
- 自動セルフオンボーディングの完成
- 将来用機能の先行実装

既存コードは削除せず、パイロット用の導線から隠す、設定を無効化する、実行されないよう小さな境界を置く、のいずれかに留めます。

### 有料パイロット開始の完了条件

次をすべて満たした時点を「P0完了」とします。

- tenant Aの認証済みユーザーからtenant Bのデータを読み書きできないことを実DB自動テストで証明できる。
- MVPのservice-role経路でも、tenant Aの入力でtenant Bの会話・予約・FAQ・連携情報を操作できない。
- `current_tenant_role()` がowner/admin/memberを正しく判定する。
- production依存を含むHigh脆弱性が0件。開発依存も安全な非破壊更新でHigh 0件にする。
- 英語の安全判定、人への引き継ぎ、FAQ回答、フォールバックが自動テストに合格する。
- 英語で空き確認、予約、変更、取消が動き、Google Calendar同期失敗時に成功を断言しない。
- 除外機能とイタリア固有の販売表現がパイロット導線に出ない。
- Node 22のclean環境で、install、audit、型、lint、単体・統合テスト、build、主要ブラウザsmokeが合格する。
- ステージングで実WhatsApp番号から一連の英語シナリオを完走する。
- 担当者への引き継ぎメールを実際に受信し、担当者がダッシュボードから対応できる。

---

## 2. P0作業一覧

| 推奨順 | ID | 作業 | 規模 | 主な完了証拠 |
|---:|---|---|---:|---|
| 0 | P0-0 | パイロット仕様と安全条件を固定 | XS | 承認済み設定表・受入シナリオ |
| 1 | P0-1 | 実Supabaseのtenant A/Bテスト基盤を追加 | M | RLS越境テストが自動実行される |
| 2 | P0-2 | `current_tenant_role()` を追加migrationで修正 | S | owner/admin/memberの実DBテスト合格 |
| 3 | P0-3 | MVP内のservice-role越境経路を検証・局所修正 | M | tenant Bへの読書きが全て拒否・無変化 |
| 4 | P0-4 | High脆弱性を非破壊更新で解消 | XS〜S | npm auditのHigh 0件 |
| 5 | P0-5 | 英語AI、FAQ、安全判定、フォールバック、引き継ぎを追加 | M | 英語評価セットとhandoffテスト合格 |
| 6 | P0-6 | 英語の予約解釈とCalendar同期時の成功判定を安全化 | M〜L | 作成・変更・取消・障害シナリオ合格 |
| 7 | P0-7 | イタリア固有・除外機能をパイロット導線から隠す | M | 英語の主要画面とroute/navテスト合格 |
| 8 | P0-8 | Node 22の再現可能なrelease gateを作る | S〜M | Node 22 CIが全てgreen |
| 9 | P0-9 | 実サービス接続のステージング受入試験 | L・外部待ちあり | 実番号・実Calendar・実メールの証跡 |

P0-1〜P0-8は、外部アカウントが揃う前でも大半を進められます。P0-9だけは実アカウントが必要です。

---

## 3. P0各作業の詳細

### P0-0 パイロット仕様と安全条件を固定

- **何を変更するか**: 実装を始める前に、最初の英語variant、各tenantのIANA timezone、日付解釈、担当者メール、営業時間、サービス一覧、AIが回答してよいFAQ、人へ渡す条件を1枚の設定表に固定する。曖昧な数字日付は推測せず聞き返す方針にする。
- **なぜ必要か**: `03/04`、`next Friday`、`3 PM`、夏時間、緊急案内、通貨表記は国により意味が違う。ここを決めずに英語対応を始めると作り直しが発生する。
- **既存機能を壊す可能性**: なし。これは仕様固定であり、まだコードを変えない。
- **主な変更対象**: 実装時の受入シナリオ、tenant設定、将来作るパイロット運用手順。既存DB構造の変更は不要。
- **変更規模**: XS。
- **完了確認**: 最初の国/英語variant、timezone、サービス、FAQ、引き継ぎ先、サポート時間が埋まっている。
- **自動テスト**: 仕様固定自体は不可。後続のfixtureと受入テストへ反映して自動化する。
- **外部サービス実アカウント**: 不要。
- **MVPに必須か**: 必須。
- **後回しにできるか**: できない。ただしブランド名の最終確定や全ページのコピー制作は後回し可能。

推奨初期ルールは、英語variantを1つに絞り、timezoneはtenantごとに必ず設定し、`03/04` のような曖昧な日付は必ず確認する、です。

### P0-1 実Supabaseのtenant A/Bテスト基盤を追加

- **何を変更するか**: Supabase CLIとDockerで全migrationを適用できるローカルDBを用意し、tenant A/B、Aのowner/admin/member、Bのownerを作る。実際のJWT `app_metadata` を使い、RLS経由でSELECT/INSERT/UPDATE/DELETEを試す統合テストを追加する。
- **なぜ必要か**: 現在のテストは主にmock・in-memoryであり、Postgresの実policy、JWT、migrationの組合せを証明していない。RLSが有効という静的確認だけでは顧客データ分離の証明にならない。
- **既存機能を壊す可能性**: 低い。最初はテスト基盤の追加だけ。ただし、テストにより既存policyの不具合が見つかる可能性は高い。
- **主な変更対象**: `supabase/config.toml`、`supabase/migrations/`、新規 `tests/integration/supabase/` または `supabase/tests/`、`package.json` のDBテストscript、`.github/workflows/ci.yml`。正確なテスト配置は実装開始時に1方式へ統一する。
- **変更規模**: M。
- **完了確認**: 全migrationを空DBへ適用でき、AはAを読書きでき、AはBを読書きできず、BもAを読書きできない。失敗した書込み後にDBが無変化であることも確認する。
- **自動テスト**: 可能。ローカルとGitHub Actionsの両方で実行する。
- **外部サービス実アカウント**: 不要。DockerとSupabase CLIは必要だが、Supabaseの有料/実アカウントは不要。
- **MVPに必須か**: 必須。最重要の販売ブロッカー。
- **後回しにできるか**: できない。

テスト対象は、tenantに属する21テーブルをpolicyレベルで網羅します。`contact_submissions` はtenant表ではないため別枠とし、一般の認証済みtenantユーザーから参照・変更できないことを確認します。

特に次を含めます。

- `tenants`、`users` のowner/admin/member権限差
- `tenant_config`、`services`、`business_hours`
- `conversations`、`messages`、`appointments`
- `knowledge_base`、`integrations`、`opt_outs`
- `usage_metrics`、`invoices`、`ai_prompts`
- `webhook_events`、outbox、templates、audit、billing等の運用テーブル
- tenant IDのないJWT、不正UUID、期限切れ相当、`authenticated` というシステムroleだけのJWT

### P0-2 `current_tenant_role()` を追加migrationで修正

- **何を変更するか**: 過去の初期migrationは編集せず、新しいmigrationで `public.current_tenant_role()` を再定義する。Supabaseのトップレベル `role=authenticated` をアプリ権限として扱わず、`app_metadata.role` の `owner` / `admin` / `member` だけを許可する。未知の値は空文字として権限なしにする。
- **なぜ必要か**: 現在の `coalesce(auth.jwt()->>'role', auth.jwt()->'app_metadata'->>'role', '')` は通常トップレベルの `authenticated` で止まり、owner/admin policyが正しく動かない。
- **既存機能を壊す可能性**: 中。現在service roleで隠れている権限エラーが表面化する可能性がある。過去ユーザーのclaimが `app_metadata` に入っていることは既存onboardingコードで確認済みだが、ステージング既存ユーザーも確認する。
- **主な変更対象**: 新規 `supabase/migrations/<timestamp>_fix_current_tenant_role.sql`、P0-1のrole/RLS統合テスト、必要に応じて `src/server/onboarding/tenant-onboarding.ts` のclaim同期テスト。
- **変更規模**: S。
- **完了確認**: ownerだけの操作、owner/adminの操作、memberの読取り、禁止操作がpolicyどおりになる。トップレベル `authenticated` がapp roleを上書きしない。
- **自動テスト**: 可能。実Postgres/JWTテストを必須にする。
- **外部サービス実アカウント**: 不要。
- **MVPに必須か**: 必須。
- **後回しにできるか**: できない。

ロール修正後は、claim変更が既存セッションへ反映されるよう、再ログインまたはtoken refreshもステージング手順に含めます。

### P0-3 MVP内のservice-role越境経路を検証し、見つかった箇所だけ修正

- **何を変更するか**: `createSupabaseAdminClient()` を使う約30モジュールを全面置換せず、MVPの実行経路に限定してtenant A/B統合テストを追加する。tenant条件の欠落や、Aのtenant IDとBのresource IDを組み合わせたときに操作できる箇所だけを修正する。
- **なぜ必要か**: service roleはRLSを迂回する。P0-1のRLSテストが合格しても、WhatsApp webhookやworkerの手書き `.eq('tenant_id', ...)` が欠ければ越境できる。
- **既存機能を壊す可能性**: 中。repository queryに条件を加えると、暗黙にtenant IDなしで呼んでいた古い経路が失敗する可能性がある。そのため先にテストを置き、MVP経路だけ変更する。
- **主な変更対象**: `src/server/whatsapp/`、`src/server/ai/context.ts`、`src/server/ai/booking-bridge.ts`、`src/server/appointments/booking.ts`、`src/server/calendar/google.ts`、`src/server/conversations/`、`src/server/knowledge-base/`、各repositoryテストと新規実DB統合テスト。
- **変更規模**: M。実際に越境欠陥が見つかった場合のみ増える。
- **完了確認**: tenant AのWhatsApp番号・会話・予約・FAQ・Google連携・outbox入力にtenant BのIDを混ぜても、Bの情報が返らず、Bの行が変化しない。
- **自動テスト**: 可能。実DBでのrepository/API統合テストを中心にし、既存mockテストも残す。
- **外部サービス実アカウント**: 不要。Google/WhatsAppはこの段階ではfake clientを使用する。
- **MVPに必須か**: 必須。
- **後回しにできるか**: MVP外のbilling、SDI、voice、mock admin経路の全面的なservice-role削減は後回し可能。MVP経路の越境修正は後回し不可。

最小の重点シナリオは次です。

1. WhatsAppの `phone_number_id` が正しいtenantへだけ解決される。
2. Aのconversation IDを使ってBのmessageを取得・更新できない。
3. Aの予約操作にBのappointment/service IDを渡しても変更できない。
4. AのFAQ検索へBのknowledge entryが混ざらない。
5. AのGoogle credential/calendar情報へBから到達できない。
6. handoff、outbox、opt-outが別tenantへ書かれない。

### P0-4 High脆弱性を非破壊更新で解消

- **何を変更するか**: まずlockfileだけで `nanoid` を修正版の3.xへ更新する。依存範囲で解決できない場合のみ `postcss` の互換patch/minorへ上げる。開発依存のHighも `npm audit fix --force` を使わず、lockfile更新または安全なoverrideで解消する。
- **なぜ必要か**: 現在 `npm audit --omit=dev --audit-level=high` が失敗し、CIのsecurity gateも赤になる状態。販売前に既知Highを残さない。
- **既存機能を壊す可能性**: 低〜中。lockfileだけなら低い。PostCSSやlint関連packageを上げる場合はbuild/CSS/lintへの影響がある。
- **主な変更対象**: `package-lock.json`。必要な場合だけ `package.json` の `postcss` / `overrides`。アプリコードは原則変更しない。
- **変更規模**: XS〜S。
- **完了確認**: production auditと全依存auditでHigh 0件、型、lint、全テスト、buildが合格する。
- **自動テスト**: 可能。CIの `dependency-audit` を維持し、full auditのHigh gateも追加する。
- **外部サービス実アカウント**: 不要。npm registryへの接続のみ必要。
- **MVPに必須か**: 必須。
- **後回しにできるか**: Highは後回し不可。Moderate/Lowは到達可能性を記録してP1判断にできる。

### P0-5 英語AI、FAQ、安全判定、フォールバック、人への引き継ぎを追加

- **何を変更するか**: 既存の `locale` を利用して英語ルールと英語文言を選ぶ小さなcatalogを追加する。英語intent、FAQ回答、AI失敗時fallback、明示的なhuman request、危険・緊急・自傷・脅迫等の決定的guardrail、opt-out、人への引き継ぎ通知を英語対応する。イタリア語処理は残す。
- **なぜ必要か**: 現在のrule-based fallback、安全語、標準返信、operator emailはイタリア語中心。Anthropic障害時や誤分類時に英語ユーザーを安全に扱えない。
- **既存機能を壊す可能性**: 中。intent判定順序や短い単語の正規表現は誤検出を増やし得る。locale別に分け、イタリア語回帰テストを残して防ぐ。
- **主な変更対象**: `src/server/ai/intent-router.ts`、`src/server/ai/llm-intent-classifier.ts`、`src/server/ai/domain-reply.ts`、`src/server/ai/reply-orchestrator.ts`、`src/server/whatsapp/auto-reply.ts`、`src/server/whatsapp/service.ts`、`src/server/conversations/escalation.ts`、`src/server/notifications/`、英語用の小さなmessage catalog、対応する `tests/server/` と `tests/fixtures/ai/`。
- **変更規模**: M。
- **完了確認**: Anthropic成功・失敗の両方で英語を返し、FAQにない情報を捏造せず、必要時に会話を `escalated` にして英語案内と担当者通知を作る。
- **自動テスト**: 大部分が可能。LLMはfake response、メールはfake sender、WhatsAppはfake outboxで決定的にテストする。
- **外部サービス実アカウント**: 自動テストには不要。P0-9でAnthropic、WhatsApp、Resendの実アカウントが必要。
- **MVPに必須か**: 必須。
- **後回しにできるか**: 英語以外の言語、詳細な感情分析、高度な分類器は後回し可能。英語の安全網とfallbackは後回し不可。

最低限の英語評価ケース:

- FAQに答えがある質問、ない質問、FAQと矛盾する誘導
- `I want to speak to a person`、`Can someone call me?`
- `I can't breathe`、`I may hurt myself`、脅迫・重大事故の表現
- `urgent appointment` のような通常予約と、本当の緊急信号の区別
- Anthropic timeout、不正JSON、低confidence、context取得失敗
- `STOP`、`unsubscribe`、`remove me`、`don't message me`
- `cancel my appointment` を配信停止と誤認しない

非医療パイロットでも緊急表現が届く可能性はあります。AIは内容へ回答せず、地域を断定した番号を勝手に出さず、「local emergency servicesへ連絡してください」と案内し、同時に人へ引き継ぎます。これは緊急対応サービスを提供するという意味ではありません。

### P0-6 英語の予約解釈とGoogle Calendar同期時の成功判定を安全化

- **何を変更するか**: 既存booking extractor/bridgeを再利用し、英語の曜日、月、相対日、AM/PM、時間帯、予約・変更・取消文を追加する。locale/timezoneを表示と解釈へ渡す。Google Calendar同期結果を確認し、失敗時は「成功」と返さず、会話を人へ引き継いで手動確認対象にする。
- **なぜ必要か**: 現在の解釈規則と返信はイタリア語・`Europe/Rome` 前提。さらに `requireCalendarSync: false` の経路では同期失敗を記録して処理を続けるため、WhatsApp文面だけが成功を断言する可能性がある。
- **既存機能を壊す可能性**: 中〜高。日時、夏時間、既存予約との競合、Calendar部分成功は予約系の中心。locale別の追加と既存イタリア語回帰テストで影響を限定する。
- **主な変更対象**: `src/server/ai/booking-extractor.ts`、`src/server/ai/booking-bridge.ts`、`src/server/appointments/booking.ts`、`src/server/appointments/notifications.ts`、`src/server/calendar/google.ts`、`src/server/conversations/escalation.ts`、予約・Calendar・WhatsApp flowのテストとfixture。
- **変更規模**: M〜L。
- **完了確認**: 空き確認、予約作成、変更、取消が英語会話で完走する。Google Calendar成功時だけ確定を伝え、timeout/401/409/5xx/欠落event ID時は同期失敗を残し、人へ引き継ぐ。二重予約を作らない。
- **自動テスト**: 大部分が可能。Calendar clientをfakeにし、成功・競合・timeout・token失効・部分失敗を再現する。DSTも固定時刻でテストする。
- **外部サービス実アカウント**: 自動テストには不要。P0-9で実Google account/calendarとOAuth設定が必要。
- **MVPに必須か**: 必須。
- **後回しにできるか**: 複数calendar、複数担当者、waitlist、複雑な繰返し予約は後回し可能。単一Calendarの失敗判定は後回し不可。

最低限の予約ケース:

- `tomorrow afternoon`
- `next Friday at 3 PM`
- `Friday morning` と複数候補からの `confirm 2`
- `move my appointment to Friday at 11 AM`
- `cancel my appointment tomorrow`
- 複数予約が一致したときに選択を求める
- `03/04` のような曖昧な数字日付を推測せず確認する
- tenant timezoneでの夏時間開始日・終了日
- 別tenantのservice/appointment IDを混ぜた操作の拒否
- Calendar同期失敗後に成功文を送らず、担当者へ通知する

Calendar同期失敗時の最小運用は「ローカルの `calendar_sync_status=failed` を残す、顧客へ確認待ちと伝える、担当者へ通知する」です。自動再試行基盤の新設はP1へ回し、1〜3社の間は手動復旧を許容します。

### P0-7 イタリア固有・除外機能をパイロット導線から隠す

- **何を変更するか**: 顧客が使う主要導線だけを英語化し、Fatture/SDI、Agency、white-label、voice、複数担当者を示すナビ、価格表、onboarding、help、設定を非表示にする。既存実装は削除しない。voice関連設定をpilot tenantでfalseにし、音声受信時は文字送信を依頼する英語案内だけにするか、少なくとも音声workerを起動しない。
- **なぜ必要か**: 未提供機能やイタリア固有機能を販売画面に出すと、契約内容と実装が一致しない。voice設定は現在存在するだけでなく、受信音声をworkerへ送る経路があるため、表示だけでなく実行境界も必要。
- **既存機能を壊す可能性**: 中。navigation、onboarding default、sitemap、設定項目を変えるため、既存イタリア向け利用者に影響し得る。pilot profile/localeに限定し、基盤コードは残す。
- **主な変更対象**: `src/app/pricing/page.tsx`、`src/components/marketing/`、`src/app/onboarding/page.tsx`、`src/components/onboarding/OnboardingForm.tsx`、`src/app/(dashboard)/` のconversation/calendar/knowledge/settingsとnavigation、`src/app/help/`、`src/app/docs/`、`src/app/sitemap.ts`、`src/app/legal/` のパイロット向け最低表示、`src/server/onboarding/tenant-onboarding.ts`、WhatsApp voice enqueue境界。
- **変更規模**: M。公開サイト全体の翻訳は行わない。
- **完了確認**: 新規pilot tenantのlocale/timezoneが正しく、voice input/replyが無効。顧客導線からSDI、Agency、white-label、voice、複数スタッフの販売表現へ到達しない。主要操作画面は英語で理解できる。
- **自動テスト**: 可能。route shape、navigation、sitemap、onboarding payload、voice-disabled webhookのテストを追加する。最終的な文言確認は手動も必要。
- **外部サービス実アカウント**: 不要。
- **MVPに必須か**: 必須。商品表示の正確性と不要課金防止に必要。
- **後回しにできるか**: 全ブログ、全help、全admin mock、全法務ページの完全翻訳は後回し可能。顧客が実際に通る画面と販売上の虚偽表現は後回し不可。

最小の顧客画面は次に限定します。

- sign-inと管理付きonboarding
- dashboard概要
- conversations一覧・詳細・人による返信
- calendar/appointments
- knowledge base/FAQ
- services、business hours、Google Calendar、WhatsApp、handoff emailに必要なsettings

`billing` は既存Stripeを壊さず、パイロットではnavigationから外すか「managed billing」と明示します。公開pricingは自己契約を促さず、問い合わせ型にします。

### P0-8 Node 22の再現可能なrelease gateを作る

- **何を変更するか**: Node 22 clean環境を正式基準にする。Windowsで壊れる `rm -f` を小さなNode scriptへ置換し、`outputFileTracingRoot` をOS非依存のファイルパス変換にする。CIへ実DBテストとHigh auditを加え、production buildと主要Playwright smokeをrelease gateにする。
- **なぜ必要か**: 現在のローカル調査はNode 25で、Windowsのverify/buildに既知の失敗がある。開発者PCとCIで結果が違う状態では、安全なリリース判定ができない。
- **既存機能を壊す可能性**: 低〜中。clean scriptは低リスク。Next.js trace root変更はDocker standalone出力へ影響し得るため、Linux/Windows両方のbuild確認が必要。
- **主な変更対象**: `.nvmrc`、`package.json`、新規 `scripts/clean-tsbuildinfo.mjs`、`next.config.ts`、`.github/workflows/ci.yml`、必要ならNode型定義のversion整合。
- **変更規模**: S〜M。
- **完了確認**: Node 22でclean checkoutから全commandが成功し、Linux CIとWindowsローカルの両方でproduction buildが完了する。
- **自動テスト**: 可能。GitHub Actionsを正本にし、Windowsはローカル確認またはWindows CI jobを追加する。
- **外部サービス実アカウント**: 不要。buildはplaceholder、テストはmock/local Supabaseを使う。
- **MVPに必須か**: 必須。
- **後回しにできるか**: Node 20/24/25対応や複数ブラウザ対応は後回し可能。Node 22の1本だけは後回し不可。

release gateの推奨command順:

1. `npm ci`
2. `npm audit --omit=dev --audit-level=high`
3. `npm audit --audit-level=high`
4. `npm run typecheck`
5. `npm run lint`
6. `npm run test`
7. `npm run db:lint`
8. 新規の実Supabase tenant isolation test
9. `npm run build`
10. 主要Playwright smoke

既存Playwright suite全体は、Node 22で複数回安定してからblockingへ切り替えます。それまでは、パイロットの主要routeだけを選んだ小さいblocking smokeを用意し、全suiteを非blockingのまま観察しても構いません。

### P0-9 実サービス接続のステージング受入試験

- **何を変更するか**: 本番と分離したステージングを作り、実WhatsApp番号、Anthropic、Google Calendar、Resend、Supabase、Upstashを接続する。英語FAQ、予約、変更、取消、handoff、opt-out、障害時の手動復旧を一連で確認する。これは主に設定・運用作業であり、大きな新機能開発ではない。
- **なぜ必要か**: mockだけではOAuth、provider権限、WhatsApp 24時間window、template承認、実timezone、メール到達性、webhook再送を証明できない。
- **既存機能を壊す可能性**: 本番から分離すれば低い。誤ったwebhook URLやcredentialを本番番号へ設定しないよう環境を分ける。
- **主な変更対象**: staging環境変数、Supabase staging project、360dialog/Meta設定、Google OAuth、Resend domain、Upstash、英語WhatsApp templates、受入チェックリスト。コード変更は試験で見つかったP0不具合だけ。
- **変更規模**: L。作業量より外部設定・承認待ちが支配的。
- **完了確認**: 実端末から英語メッセージを送り、FAQ回答、空き候補、作成、Google event確認、変更、取消、human request、担当者メール受信、担当者返信、STOPを証跡付きで完走する。
- **自動テスト**: 一部のみ。実端末とMeta/Google/メールの最終確認は手動。再現可能なチェックリストと結果記録を残す。
- **外部サービス実アカウント**: 必要。Supabase、hosting、360dialog/Meta WhatsApp、Anthropic、Google、Resend、Upstash。Stripe、OpenAI、ElevenLabs、Fatture in Cloudは不要。
- **MVPに必須か**: 必須。
- **後回しにできるか**: 実アカウント試験は後回し不可。負荷試験や複数国試験は後回し可能。

必須の障害試験:

- Anthropic timeout時にも英語fallbackが返る。
- Google OAuth tokenを無効化したとき、予約成功を断言せずhandoffされる。
- Resend失敗時にもconversationの `escalated` 状態は残り、dashboardで発見できる。
- WhatsApp webhookの同一event再送で二重予約・二重返信が発生しない。
- Upstashが設定された本番相当環境でrate limitが複数instance間でも共有される。
- outboxが失敗・再試行・dead-letterになった場合の確認場所と手動復旧方法が分かる。

---

## 4. P1作業一覧

P1は望ましいですが、1〜3社の管理付きパイロットでは、手動監視・件数制限・運用手順で一時的に代替できます。P0の途中へ混ぜません。

### P1-1 `/api/health/deep` の保護

- **変更内容/理由**: 内部secretまたはadmin認証を要求し、外部から依存サービスprobeを連打できないようにする。
- **破壊リスク**: 低。既存monitorのheader設定変更が必要。
- **対象**: `src/app/api/health/deep/route.ts`、health tests、monitor設定。
- **規模**: S。
- **確認/自動テスト**: 認証なし401/404、認証あり200、rate limitを自動テスト可能。
- **実アカウント**: 不要。staging monitor確認時だけ必要。
- **MVP必須/延期**: 条件付き。URLを非公開にし手動monitorする間は開始直後まで延期可能。

### P1-2 GDPRデータexportのページング・機密列除外

- **変更内容/理由**: 全件 `select('*')` をやめ、ページングし、`integrations.credentials` 等をexportから除外する。データ増加時の欠落・メモリ不足を防ぐ。
- **破壊リスク**: 中。export形式の互換性が変わる。
- **対象**: `src/server/gdpr/data-export.ts` とtests。
- **規模**: M。
- **確認/自動テスト**: 1,000件超、複数page、credential非出力を自動テスト可能。
- **実アカウント**: 不要。
- **MVP必須/延期**: 1〜3社かつ少量データの期間は延期可能。ただし顧客からexport依頼を受ける前に対応する。

### P1-3 例外監視と通知の集約

- **変更内容/理由**: Sentry等を追加し、release、tenant、request IDをPIIなしで追跡する。個別例外をログだけで見逃さない。
- **破壊リスク**: 低〜中。PII送信設定に注意。
- **対象**: Next.js monitoring設定、logger integration、alert rule、runbook。
- **規模**: M。
- **確認/自動テスト**: test exceptionの受信とPII redactionを確認。一部自動化可能。
- **実アカウント**: 必要。無料枠で開始可能。
- **MVP必須/延期**: 毎日手動監視し、顧客が1〜3社に限られる間は開始直後まで延期可能。

### P1-4 AI処理の非同期化とtenant別費用上限

- **変更内容/理由**: Anthropic呼出しをwebhook応答からjobへ分離し、tenantごとの費用上限、timeout、prompt cachingを追加する。
- **破壊リスク**: 高。順序、再試行、idempotency、応答遅延が変わる。
- **対象**: WhatsApp webhook、outbox/job、AI usage、cron/worker。
- **規模**: L。
- **確認/自動テスト**: webhook即時応答、同一event再送、job retry、費用上限を自動テスト可能。
- **実アカウント**: load/staging確認ではAnthropicとhostingが必要。
- **MVP必須/延期**: 低件数パイロットでは延期可能。timeoutと利用量を手動監視する。

### P1-5 残りのservice-role経路の縮小

- **変更内容/理由**: P0対象外のbilling、admin、GDPR、voice等も、可能な処理はuser-session clientへ移し、service roleをworker/管理処理へ限定する。
- **破壊リスク**: 高。認証境界の横断変更になる。
- **対象**: `createSupabaseAdminClient()` を使う残りのserver modules。
- **規模**: L。
- **確認/自動テスト**: 全repositoryのrole/RLS integration test。自動化可能。
- **実アカウント**: 不要。
- **MVP必須/延期**: MVP外のrouteを非表示・無効にする条件で延期可能。MVP経路はP0-3で対応する。

### P1-6 英語UI・help・法務・E2Eの全面拡充

- **変更内容/理由**: 全画面、全メール、help、blog、SEO、法務、通貨、Meta templateを対象市場へ完全対応し、認証済みbrowser E2Eを拡充する。
- **破壊リスク**: 中。表示範囲が広い。
- **対象**: `src/app/`、`src/components/`、email templates、Playwright specs。
- **規模**: L。
- **確認/自動テスト**: locale scan、route test、visual/manual review、browser E2E。
- **実アカウント**: 法務レビューとMeta templateには外部対応が必要。
- **MVP必須/延期**: 顧客が通る最小画面と最低限の契約・privacy noticeはP0。残りは延期可能。

---

## 5. P2作業一覧

以下は今回のMVPでは実装しません。既存コードを大規模削除する作業も行いません。

P2共通判断:

- **MVPに必須か**: いいえ。
- **後回しにできるか**: はい。実顧客の要望と売上で再評価する。
- **完了確認**: 今回は「パイロット導線に表示されず、実行されない」ことだけをP0-7で確認する。
- **自動テスト**: navigation/feature-disabledテストだけP0で行い、機能自体の追加テストは作らない。

| ID | 作業 | 変更する場合の主対象 | 規模・リスク | 外部サービス |
|---|---|---|---|---|
| P2-1 | 音声入力・音声返信 | `src/server/whatsapp/voice-*`、`src/lib/elevenlabs/`、settings | L。media、STT/TTS、費用、安全性が増える | ElevenLabs、WhatsApp media |
| P2-2 | Fatture in Cloud / SDI | `src/server/billing/sdi-invoicing.ts`、billing UI | L。国別税務・法務リスクが大きい | Fatture in Cloud |
| P2-3 | Agency / white-label | plan、tenant管理、branding、権限 | L〜XL。未完成adminも関係 | Stripe/partner運用等 |
| P2-4 | 複数スタッフ | users、roles、calendar、assignment、UI | XL。予約所有者モデルが変わる | 複数Google account等 |
| P2-5 | 複数予約リソース | services、appointments、availability model | XL。競合制約とslot計算が変わる | Calendar/resource API |
| P2-6 | 複数拠点 | tenants/config/services/hours/timezone | XL。住所・営業時間・routingが変わる | 場合により複数番号/calendar |
| P2-7 | 大規模admin再構築 | `src/app/(admin)/` | L〜XL。現在のmock表示を全面実装する必要 | なし〜監視/課金連携 |
| P2-8 | 完全なi18n framework | 全 `src/app/`、messages、routing | L。今回の英語1variantには過剰 | なし |
| P2-9 | 自動セルフオンボーディング/セルフ課金 | onboarding、Stripe、provisioning | L。失敗時サポートと不正利用対策が必要 | Stripe、Meta onboarding |
| P2-10 | 大量のblog/SEO/業種別ページ | marketing、help、sitemap | L。販売検証前の効果が不明 | なし |
| P2-11 | 複数LLM、RAG高度化 | AI adapter、embedding、vector search | M〜L。小規模FAQには不要 | OpenAI等 |
| P2-12 | 自己host商品化 | Docker、scheduler、Redis、運用文書 | L。顧客環境差が増える | 顧客側infra |

---

## 6. 主な変更対象ファイル・機能のまとめ

実装時に触る可能性が高い範囲です。最終的にはテストで必要性が確認できたファイルだけ変更します。

| 領域 | 主対象 |
|---|---|
| DB/RLS | `supabase/config.toml`、新規role修正migration、`supabase/tests/` または `tests/integration/supabase/` |
| CI/Node | `package.json`、`package-lock.json`、`.nvmrc`、`next.config.ts`、`scripts/`、`.github/workflows/ci.yml` |
| AI intent/FAQ | `src/server/ai/intent-router.ts`、`llm-intent-classifier.ts`、`domain-reply.ts`、`reply-orchestrator.ts`、`context.ts` |
| 予約解釈 | `src/server/ai/booking-extractor.ts`、`booking-bridge.ts` |
| 予約/Calendar | `src/server/appointments/booking.ts`、`notifications.ts`、`src/server/calendar/google.ts` |
| WhatsApp | `src/server/whatsapp/service.ts`、`auto-reply.ts`、repository/outbox/opt-out関連 |
| 人への引き継ぎ | `src/server/conversations/escalation.ts`、`src/server/notifications/`、conversation UI |
| pilot表示 | marketing、onboarding、dashboard core、settings、help/docs/legal、sitemap、navigation |
| テストfixture | `tests/fixtures/ai/intent-evals.json`、`booking-extraction-evals.json` と関連Vitest/Playwright specs |

変更しない方針のもの:

- 既存認証方式の全面置換
- Stripe実装の作り直し
- WhatsApp providerの置換
- Supabaseから別DBへの移行
- Google Calendar連携の全面再実装
- 予約データモデルの全面再設計
- 既存イタリア語機能の大規模削除

---

## 7. 主なリスクと抑え方

| リスク | 影響 | 最小の抑え方 |
|---|---|---|
| RLS合格でもservice roleが越境する | 顧客情報漏えい | P0-1とP0-3を別テストにする。tenant IDとresource IDを意図的に混ぜる |
| role修正で既存ユーザーが操作不能 | onboarding/設定が止まる | 新migration、claim確認、owner/admin/member matrix、token refresh手順 |
| 英語regexの誤検出 | 通常予約がhandoff、または危険文を見逃す | locale別rule、positive/negative fixture、決定的guardrailをLLMより前に実行 |
| 日付の誤解釈 | 間違った予約 | timezone必須、曖昧な数字日付は確認、DSTテスト、顧客の明示確認 |
| Calendarだけ同期失敗 | DBとCalendarの不一致 | 成功を断言しない、failed状態保存、handoff、手動復旧runbook |
| 同一webhookの再送 | 二重予約・二重返信 | 既存idempotencyを維持し、実再送テストを追加 |
| 英語化が全サイト改修へ膨張 | 販売開始が遅れる | 顧客が通るrouteだけP0、残りは非表示にしてP1/P2 |
| 非MVP voiceが実行され費用発生 | ElevenLabs費用・範囲外処理 | pilot tenantで無効化し、worker enqueue前後の境界をテスト |
| 外部審査待ち | コード完成後も開始不能 | P0-1〜8と並行してMeta/Google/送信domain準備を開始 |
| 通知メールが届かない | handoff見逃し | 実到達試験、dashboardのescalated queue、運営者の日次確認 |
| 法務表示が対象国と不一致 | 契約・privacy問題 | 公開前に対象国を確定し、最低限の契約・privacy/AI disclosureを専門家確認 |

---

## 8. テスト方法

### A. 自動テスト層

1. **純粋unit test**
   - 英語intent、日付/時刻、文言選択、opt-out、安全signal。
2. **service test with fakes**
   - Anthropic、Google Calendar、WhatsApp、Resendの成功・失敗・timeout。
3. **実Postgres/Supabase integration test**
   - migration、JWT claims、RLS、tenant A/B、service-role repository境界。
4. **backend flow test**
   - 英語テキストでFAQ→予約→変更→取消→handoff。
5. **browser smoke**
   - sign-in guard、主要英語画面、conversationからのhuman reply、設定保存。
6. **security/release gate**
   - dependency audit、secret scan、RLS static lint、production build。

### B. 自動テストでは不十分なもの

- Meta/360dialogの実webhook deliveryと再送
- 英語WhatsApp template承認と送信
- Google OAuth consentと実Calendar event
- Resendの実メール到達性、SPF/DKIM/DMARC
- 対象国の自然な英語表現と日付感覚
- FAQ回答の事業者による事実確認
- privacy、利用規約、AI disclosureの法務確認

### C. リリース判定で記録する数値

- 自動テストの合格件数
- production/full dependency auditのHigh件数
- tenant越境テストの表数・操作数
- 英語評価fixtureの合格数
- 実WhatsApp受入シナリオの合格数
- Calendar sync失敗時のhandoff確認
- 未処理 `escalated` 会話、failed outbox、failed calendar syncの件数

単に「テストが通った」ではなく、実行command、Node version、commit、日時、結果をパイロットrelease記録へ残します。

---

## 9. 外部サービスが必要になるタイミング

| タイミング | 必要なもの | 用途 | 今すぐ有料契約が必要か |
|---|---|---|---|
| P0-1〜P0-8 | Docker、Supabase CLI、npm、GitHub Actions | local DB、依存、CI | 原則不要 |
| P0-5実装 | fake Anthropic/WhatsApp/Resend | 決定的自動テスト | 不要 |
| P0-6実装 | fake Google Calendar | 成功・失敗テスト | 不要 |
| P0-9 staging | Supabase staging | Auth/DB/Storageの実環境 | 無料枠でも開始可。本番はPro推奨 |
| P0-9 staging | hosting/Vercel等 | public webhookとapp | staging構成による |
| P0-9 staging | 360dialog/Meta、test number | 実WhatsApp送受信 | 必要。承認待ちを考慮 |
| P0-9 staging | Anthropic | 実AI回答 | 従量課金が必要 |
| P0-9 staging | Google Cloud/OAuth/Calendar | 実空き確認・event同期 | API自体は通常追加料金なし |
| P0-9 staging | Resendと送信domain | human handoff email | 無料枠候補。domain設定必要 |
| P0-9 production相当 | Upstash Redis | 分散rate limit | 無料枠候補 |
| P1 | Sentry等 | 集約監視 | 無料枠候補 |

今回不要:

- ElevenLabs
- Fatture in Cloud
- OpenAI embeddings
- 360dialog Partner/Agency plan
- Stripeの新商品・本番自動課金。手動請求で開始する場合

英語WhatsApp templateが必要な通知を使う場合は、Meta承認に時間がかかり得るため、コード実装を待たず準備を始めます。ただし、MVP外のreminder機能まで広げません。

---

## 10. 推奨実装順序

### フェーズ1: 安全な土台

1. P0-0で英語variant、timezone、受入条件を確定する。
2. P0-1でtenant A/Bの実DBテストを先に作る。
3. P0-2で `current_tenant_role()` を新migrationで修正し、テストをgreenにする。
4. P0-3でMVPのservice-role経路を越境テストし、見つかった欠陥だけ直す。
5. P0-4でHigh脆弱性を解消する。

この時点で「顧客データを混ぜない」最低条件を先に確立します。

### フェーズ2: 英語の商品機能

6. P0-5で英語intent、FAQ、安全、fallback、handoffを実装する。
7. P0-6で英語予約、変更、取消、timezone、Calendar失敗時handoffを実装する。
8. P0-7で非MVP機能を無効・非表示にし、顧客が通る主要画面だけ英語化する。

### フェーズ3: リリース証明

9. P0-8でNode 22のclean release gateを全てgreenにする。
10. P0-9で実WhatsApp→AI→Google Calendar→通知→human replyをステージングで完走する。
11. 結果を見て、P0の不具合だけ修正し、同じ受入試験を再実行する。
12. 1社目を開始し、問題がなければ2〜3社へ順番に広げる。同日に3社を開始しない。

依存関係の都合で、外部アカウント申請はフェーズ1と並行して開始します。コードの実装順は変えません。

---

## 11. 最短でパイロット開始するために省略できる項目

次は明確に省略できます。

- Stripeセルフ課金。請求書またはpayment linkを手動発行する。
- 顧客セルフオンボーディング。運営者がSupabase/設定画面から代行する。
- 全公開サイトの英訳。問い合わせ用の最小ページだけ使う。
- 全help/blog/SEOページ。navigationとsitemapから外す。
- 大規模admin。Supabase、provider dashboard、既存conversation画面で代替する。
- Sentry有料plan。最初は無料枠または日次ログ確認で代替する。
- AIの非同期job化。低件数の間はtimeout、重複、費用を監視する。
- OpenAI embeddings。少量FAQは既存の単語検索fallbackを活用する。
- 自動Calendar再試行。failed状態とhandoff後の手動復旧で代替する。
- voice、SDI、Agency、white-label、複数スタッフ/拠点/resource。
- 完全なi18n framework。英語1variantの小さなmessage catalogを使う。
- 多数ブラウザ・多数Node version対応。Node 22とChromiumを正本にする。

省略してはいけないもの:

- tenant A/B分離証明
- `current_tenant_role()` 修正
- High脆弱性解消
- 英語の安全・fallback・handoff
- 予約/変更/取消とGoogle Calendarの成功判定
- Node 22 release gate
- 実WhatsApp/Calendar/メールのステージング試験
- 最低限のprivacy、契約、AI disclosure、担当者対応手順

---

## 12. 実装開始前に利用者が判断・準備する必要がある項目

### 先に判断する項目

1. **最初の販売国と英語variant**
   - 例: 米国 `en-US`、英国 `en-GB`。
   - 未決定の間は、曖昧な数字日付を必ず聞き返す。
2. **最初の1業種**
   - 非医療、単一担当者、単一Calendarで成立する業種に限定する。
3. **パイロット料金と請求方法**
   - 手動請求を推奨。WhatsApp/360dialog費用を顧客負担にするか料金へ含めるか決める。
4. **サポート時間とhandoff SLA**
   - 何時間以内に人が返信するか。営業時間外の案内をどうするか。
5. **AIが答えてよい範囲**
   - 事実確認済みFAQ、答えてはいけない質問、必ず人へ渡す条件。
6. **予約ルール**
   - サービス名、時間、価格、営業時間、lead time、buffer、最大先の日数、取消方針。
7. **失敗時の顧客文面**
   - CalendarやAIが失敗した際に「確認して担当者から連絡する」と案内することへの承認。
8. **ブランド表示**
   - 最終ブランド名、AI assistant名、送信メール名。未決定なら仮名でstagingのみ進める。

### P0-9までに準備するアカウント・情報

- staging用Supabase project
- staging/public URLとdomain
- 360dialogまたはMeta WhatsApp Businessのアカウント、番号、承認済み英語template
- Anthropic API keyと利用上限
- Google Cloud project、OAuth client、test user、専用test calendar
- Resend account、送信domain、担当者受信アドレス
- Upstash Redis
- 32byte以上のintegration credential encryption key、OAuth state secret、internal job secret等のsecret管理場所
- パイロット企業ごとのtimezone、営業時間、サービス、FAQ、handoff email
- 最低限の利用契約、privacy notice、AI disclosure、subprocessor一覧
- 障害時連絡先と「AIを止めて人だけで対応する」手順

### 実装開始の承認時に確認したい内容

- このP0順序で進めてよいか。
- 最初の販売国/英語variantは何か。
- 最初の業種は何か。
- voice inputもvoice replyもパイロットでは無効にしてよいか。
- Stripeを使わず手動請求で開始してよいか。
- Calendar同期失敗時は自動確定せずhuman handoffにしてよいか。

---

## 最終判断

全面書き直しは不要です。最短経路は、先にtenant分離とroleを実DBで証明し、次に英語の安全網と予約経路だけを既存実装へ足し、不要機能を隠し、Node 22と実サービスで合格させることです。

この順番なら、一般公開SaaSに必要な大規模改修を避けながら、1〜3社へ提供する管理付き有料パイロットの安全条件を満たせます。
