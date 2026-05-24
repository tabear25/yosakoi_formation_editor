# yosakoi_formation

よさこいのフォーメーション表を作成・編集し、画像 (PNG) / PDF に書き出す Web アプリです。
フロントは **Vite + React 18 + TypeScript + Tailwind CSS** の SPA、バックエンドは **Vercel Serverless Functions（`/api`）+ KV（Vercel KV / Upstash Redis）**。**ログイン（チーム共通 ID/PW）・クラウド自動保存・合言葉での読み取り専用共有**に対応しています。

> 📘 **AI / 開発者向けの詳細**: 設計判断や状態管理の方針は [`CLAUDE.md`](./CLAUDE.md)、経緯の引き継ぎメモは [`.claude/SESSION_SUMMARY.md`](./.claude/SESSION_SUMMARY.md) を参照してください。

## できること

- 複数シーンをタイムラインで切替（追加 / 複製 / 並べ替え / 改名 / 削除）。アニメ再生はなし
- 長方形ステージ ⇔ 流し (パレード) の切替、横幅・奥行 (m)・グリッド間隔の調整
- 踊り子を名簿で管理（名前 + グループ色）。マーカーは色 + 名前で表示
- マウス / タッチ共通のドラッグ配置、ズーム / パン、グリッド吸着
- 整列（フォーメーション成型）: 横一列 / 縦一列 / 円 / 格子 / 三角（客席側を頂点としたピラミッド）
- 複数選択を「形のまま」一括移動するグループドラッグ
- 表示中シーンを PNG、全シーンを PDF（1 場面 = 1 ページ）に書き出し
- **ログイン**: チーム共通の ID / パスワードで認証（外部サービス連携なし）
- **クラウド自動保存**: 編集すると自動でサーバーに保存され、リロードや別端末でも復元
- **合言葉で共有**: 現在の内容を合言葉付きの URL で配布。受け取った人は**ログイン不要・読み取り専用**で閲覧と PNG / PDF 出力ができる（編集は不可）
- 最大 〜60 人規模、PC / タブレット / スマホ対応（レスポンシブ・タッチ。モバイルの整列ツールバーは横スクロール）

> 💾 **編集にはログインが必要**です（ログインしないと編集画面に入れないため、ログインし忘れて内容が消えることはありません）。ログイン後の変更はクラウド（KV）に自動保存され、ヘッダーに保存状態（保存中… / 保存済み / 未保存 / 保存エラー）を表示します。保存に失敗した場合はヘッダー直下に警告バナーと「再試行」ボタンが出ます。動作には下記の環境変数と KV の設定が必要です。

## セットアップ（バックエンド / Vercel）

ログイン・自動保存・共有はサーバー（`/api`）と KV を使うため、Vercel 側に次の設定が必要です。

1. **KV を作成**: Vercel プロジェクトの **Storage** で KV / Upstash Redis を作成し、プロジェクトに接続（接続用の環境変数が自動で追加されます）。
2. **環境変数を設定**: **Settings → Environment Variables** に以下を追加（値はコード / Git に置かない）。

   | 変数 | 用途 |
   | --- | --- |
   | `APP_LOGIN_ID` / `APP_LOGIN_PASSWORD` | チーム共通のログイン情報 |
   | `SESSION_SECRET` | セッショントークン署名用のランダムな長い文字列 |
   | `KV_REST_API_URL` / `KV_REST_API_TOKEN` | KV 接続情報（Storage 連携が自動注入。Upstash 連携の場合は `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`） |

   雛形は [`.env.example`](./.env.example)。ローカルで `vercel dev` を使う場合はこれを `.env.local` にコピーして値を入れます。

   `SESSION_SECRET` の生成例:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

## コマンド

| コマンド | 用途 |
| --- | --- |
| `npm install` | 依存関係のインストール |
| `npm run dev` | フロントのみ開発サーバ起動（Vite, 既定 http://localhost:5173 ）。`/api` は動かない |
| `vercel dev` | フロント + サーバー関数を同時にローカル起動（要 Vercel CLI・`.env.local`） |
| `npm run build` | 本番ビルド（`tsc --noEmit` で型チェック後に `vite build` → `dist/`） |
| `npm run preview` | ビルド成果物のプレビュー配信 |
| `npm run check` | フロントの型チェック（`tsc --noEmit`） |
| `npm run check:api` | サーバー関数（`/api`）の型チェック（`tsc -p api/tsconfig.json`） |
| `npm run test` | 幾何ロジックの単体テスト（vitest, `src/lib/geometry.test.ts`） |

> ℹ️ ログインや自動保存を伴う動作確認には `/api` が必要です。`npm run dev` 単体ではログイン画面から先に進めないため、`vercel dev` か Vercel のデプロイ環境で確認してください。

## 前提条件

- Node.js（推奨 v20.19+ / v22.12+）
- 依存関係のインストール

  ```bash
  npm install
  ```

> この PC にはシステム Node/npm が無いため、ポータブル Node を `.tooling/node-v24.16.0-win-x64`（git 管理外）に展開して使用しています。実行時は PATH に前置きしてください。
>
> ```powershell
> $env:Path = "C:\Users\str06\private_workplace\yosakoi_formation\.tooling\node-v24.16.0-win-x64;$env:Path"
> ```
>
> 日常運用では公式 Node の導入を推奨します。

## アーキテクチャ

- **状態管理**: `src/store/projectReducer.ts`（ドキュメント = タイトル / ステージ / グループ / 踊り子 / シーン）を `useReducer` で管理し、`src/store/ProjectContext.tsx` の `AppProvider`（`initialState` で起動時の値を注入）/ `useApp` で配布。選択・グリッド吸着・選択モードなどの UI 状態も同コンテキストで保持。
- **クラウド自動保存**: `src/hooks/useAutoSave.ts` が編集をデバウンスして `PUT /api/doc` で KV に保存。起動時は `GET /api/doc` で復元。未保存のまま離脱しようとした時だけブラウザ標準の確認を表示。
- **座標系**: すべて「ステージ矩形に対する正規化座標 (x, y) ∈ [0, 1]」で保持（`src/types.ts`）。画面サイズ・ステージ寸法・縦横比を変えても相対配置が保たれる。
- **画面描画**: `src/components/StageView.tsx`（枠・グリッド・踊り子マーカーを DOM で描画）。`src/components/StageCanvas.tsx` が採寸・ズーム / パン・Pointer Events によるドラッグ / 選択 / パンを担当（マウス / タッチ共通、`touch-action: none`）。
- **書き出し**: `src/lib/export.ts` が **Canvas 2D で直接描画**して PNG / PDF（jsPDF, 1 場面 = 1 ページ）を生成。日本語は canvas でラスタライズして jsPDF のフォント制約を回避。
- **幾何**: `src/lib/geometry.ts`（正規化変換・グリッド吸着・整列〔横 / 縦 / 円 / 格子 / 三角〕・既定配置）。純関数でテスト対象。
- **バックエンド / 認証**: `api/_lib/auth.ts`（チーム共通 ID/PW を環境変数と `timingSafeEqual` で照合し、HMAC 署名トークンを発行・検証。Node 標準 `crypto` のみ）。`api/login.ts`・`api/doc.ts`（要トークン）・`api/share.ts`（POST は要トークン / GET は公開）。`api/_lib/store.ts` が KV を操作（`doc:main` と `share:<合言葉>`）。
- **クライアント API / 認証 UI**: `src/lib/api.ts`（fetch ラッパ・401 処理）、`src/lib/session.ts`（トークン保存）、`src/components/LoginGate.tsx`（ログインゲート）、`src/components/ShareDialog.tsx`（合言葉作成）、`src/components/ShareViewer.tsx`（`?share=合言葉` の読み取り専用ビュー。`StageView` と `export.ts` を再利用）。
- **UI 部品**: `src/components/ui.tsx`（Button / Modal / Drawer）。shadcn/Radix は使わず Tailwind + ネイティブフォーム部品で軽量・タッチ対応。アイコンは lucide-react。

### 主要ファイル

```
yosakoi_formation/
├── index.html
├── package.json
├── vite.config.ts / tsconfig.json / tailwind.config.js / postcss.config.js
├── vercel.json / .vercelignore           # Vercel 設定
├── .env.example                          # 必要な環境変数の雛形
├── api/                                  # Vercel Serverless Functions
│   ├── tsconfig.json                     # /api 用の型チェック設定
│   ├── login.ts                          # POST: ログイン
│   ├── doc.ts                            # GET/PUT: ドキュメントの読込・保存（要トークン）
│   ├── share.ts                          # POST: 合言葉作成（要トークン） / GET: 取得（公開）
│   └── _lib/
│       ├── auth.ts                       # ID/PW 照合・HMAC トークン
│       └── store.ts                      # KV アクセス
└── src/
    ├── main.tsx                          # エントリポイント
    ├── App.tsx                           # ?share 分岐 / ログインゲート / レイアウト
    ├── types.ts                          # データモデル（正規化座標など）
    ├── store/
    │   ├── projectReducer.ts             # ドキュメント状態の reducer
    │   └── ProjectContext.tsx            # AppProvider / useApp（自動保存統合）
    ├── hooks/
    │   └── useAutoSave.ts                # デバウンス自動保存
    ├── lib/
    │   ├── geometry.ts / geometry.test.ts# 幾何（吸着・整列・正規化）＋テスト
    │   ├── export.ts                     # PNG / PDF 書き出し
    │   ├── api.ts / session.ts           # API 呼び出し・トークン保存
    │   └── palette.ts / cn.ts            # 色・クラス名ユーティリティ
    └── components/
        ├── StageView.tsx                 # 描画
        ├── StageCanvas.tsx               # 操作・ズーム/パン・グループドラッグ
        ├── RosterPanel.tsx               # 名簿
        ├── SceneList.tsx                 # シーンタイムライン
        ├── Toolbar.tsx                   # 整列などの操作（モバイルは横スクロール）
        ├── StageSettings.tsx             # ステージ寸法調整
        ├── AppHeader.tsx                 # 共有 / 保存状態 / ログアウト
        ├── LoginGate.tsx                 # ログイン
        ├── ShareDialog.tsx               # 合言葉の作成
        ├── ShareViewer.tsx               # 読み取り専用の共有ビュー
        └── ui.tsx                        # Button / Modal / Drawer
```

## 実行方法

### フロントのみ（UI 確認用）

```bash
npm install
npm run dev
```

`/api` は動かないため、ログイン画面から先には進めません（UI の見た目確認用）。

### フル機能（ローカル）

```bash
vercel dev
```

`.env.example` を `.env.local` にコピーして値を設定したうえで実行すると、フロントとサーバー関数が同時に起動し、ログイン・自動保存・共有まで確認できます。

### 本番ビルドの確認

```bash
npm run build
npm run preview
```

## レスポンシブ

- `lg` 以上: 名簿は左サイドバー固定
- `lg` 未満: ヘッダーの「名簿」ボタンからドロワー表示。シーン一覧は下部に横スクロール、ステージ設定はモーダル
- 整列ツールバーはモバイルでも横 1 行のまま横スクロール（ラベルは縦に折り返らない）

## デプロイ（Vercel）

**静的 Vite SPA（フロント）+ Serverless Functions（`/api`）+ KV** の構成です。独立した GitHub リポジトリ（`tabear25/yosakoi_formation_editor`）を Vercel に Git 連携し、`main` へ push すると自動デプロイされます。

- 設定ファイル: `vercel.json`（`framework=vite` / `buildCommand=npm run build` / `outputDirectory=dist`）。`/api/*.ts` は Vercel が自動的にサーバー関数として検出します。
- デプロイ前に「セットアップ（バックエンド / Vercel）」の **KV 作成**と**環境変数**を済ませてください。
- **本番（Production）デプロイは必ず事前に確認を取ってください。** まず Preview で内容を確認してから本番へ。

## 動かなかったら

### 1. `npm` コマンドが見つからない / Node が無い

システム Node が未導入の場合、ポータブル Node を PATH に前置きしてください（「前提条件」参照）。日常運用では公式 Node の導入を推奨します。

### 2. ログインできない / 保存されない

`/api` と KV、環境変数が必要です。`npm run dev` 単体では `/api` が動かないため、`vercel dev` かデプロイ環境で確認してください。`APP_LOGIN_ID` / `APP_LOGIN_PASSWORD` / `SESSION_SECRET` と KV の接続情報が設定されているかを確認してください。

### 3. ビルド時に 500kB 超のチャンク警告が出る

jspdf 由来の警告で実害はありません。jspdf 同梱の html2canvas / dompurify は分割チャンクに入り、実行時には読み込まれません。

### 4. タッチ操作でうまくドラッグできない

`StageCanvas` は Pointer Events + `touch-action: none` で実装されています。ブラウザ / 拡張機能が pointer イベントを横取りしていないか確認してください。
