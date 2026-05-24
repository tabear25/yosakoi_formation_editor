# yosakoi_formation

よさこいのフォーメーション表を作成・編集し、画像/PDFに書き出すWebアプリ。フロントは静的 SPA（Vite + React 18 + TypeScript + Tailwind CSS）、バックエンドは Vercel Serverless Functions（`/api`）+ KV（Vercel KV / Upstash Redis）。ログイン（チーム共通ID/PW）・クラウド自動保存・合言葉での読み取り専用共有に対応。

## コマンド

| コマンド | 用途 |
|---|---|
| `npm install` | 依存関係のインストール |
| `npm run dev` | 開発サーバ起動（Vite, 既定 http://localhost:5173 ） |
| `npm run build` | 本番ビルド（`tsc --noEmit` 型チェック後に `vite build` → `dist/`） |
| `npm run preview` | ビルド成果物のプレビュー配信 |
| `npm run check` | フロントの型チェック（`tsc --noEmit`） |
| `npm run check:api` | サーバー関数（`/api`）の型チェック（`tsc -p api/tsconfig.json`） |
| `npm run test` | 幾何ロジックの単体テスト（vitest, `src/lib/geometry.test.ts`） |

> 実行には Node.js（推奨 v20.19+ / v22.12+）が必要。サーバー関数込みでローカル起動するには Vercel CLI の `vercel dev`（環境変数は `.env.local`）を使う。`npm run dev` はフロントのみで `/api` は動かない。

## アーキテクチャ

- **状態**: `src/store/projectReducer.ts`（ドキュメント = タイトル/ステージ/グループ/踊り子/シーン）を `useReducer` で管理し、`src/store/ProjectContext.tsx` の `AppProvider`（`initialState` で起動時の値を注入）/ `useApp` で配布。選択・グリッド吸着・選択モードなどのUI状態も同コンテキストで保持。**クラウド自動保存**: ログイン後、編集を デバウンスして `PUT /api/doc` で KV に保存し、起動時に `GET /api/doc` で復元（`src/hooks/useAutoSave.ts`）。未保存のまま離脱しようとした時だけブラウザ標準の確認を表示する。
- **座標**: すべて「ステージ矩形に対する正規化座標 (x, y) ∈ [0, 1]」で保持（`src/types.ts`）。画面サイズ・ステージ寸法・縦横比を変えても相対配置が保たれる。ピクセル変換は描画側で行う。
- **画面描画**: `src/components/StageView.tsx`（枠・グリッド・踊り子マーカーをDOMで描画）。`src/components/StageCanvas.tsx` が表示領域の採寸・ズーム/パン・Pointer Events によるドラッグ/選択/パンを担当（マウス/タッチ共通、`touch-action: none`）。
- **書き出し**: `src/lib/export.ts` が **Canvas 2D で直接描画**して PNG / PDF（jsPDF, 1場面=1ページ）を生成。日本語は canvas でラスタライズするため jsPDF のフォント制約を回避している。
- **幾何**: `src/lib/geometry.ts`（正規化変換・グリッド吸着・整列〔横/縦/円/格子〕・既定配置）。純関数でテスト対象。
- **UI部品**: `src/components/ui.tsx`（Button / Modal / Drawer）。shadcn/Radix は使わず Tailwind + ネイティブフォーム部品で軽量・タッチ対応。アイコンは lucide-react。
- **バックエンド/認証**: `api/_lib/auth.ts`（チーム共通ID/PWを環境変数と `timingSafeEqual` で照合し、HMAC署名トークンを発行・検証。Node標準 `crypto` のみ）、`api/login.ts`・`api/doc.ts`（要トークン）・`api/share.ts`（POSTは要トークン / GETは公開）。`api/_lib/store.ts` が KV を操作（`doc:main` と `share:<合言葉>`）。クライアント側は `src/lib/api.ts`（fetchラッパ・401処理）と `src/lib/session.ts`（トークン保存）。`/api` は `api/tsconfig.json` で別途型チェックする（フロントの `tsconfig.json` には含めない）。
- **ログイン/共有UI**: `src/components/LoginGate.tsx`（未ログイン時のゲート）、`src/components/ShareDialog.tsx`（合言葉の作成）、`src/components/ShareViewer.tsx`（`?share=合言葉` で開く読み取り専用ビュー。`StageView` と `export.ts` を再利用。ログイン不要・編集不可・画像/PDF出力可）。

## レスポンシブ

- `lg` 以上: 名簿は左サイドバー固定。未満: ヘッダーの「名簿」ボタンからドロワー表示。シーン一覧は下部に横スクロール。ステージ設定はモーダル。
- 整列ツールバー（`Toolbar.tsx`）はモバイルでも横1行のまま横スクロール。各ボタンは `shrink-0`、`Button` 基底は `whitespace-nowrap` を持たせ、狭幅でもラベルが1文字ずつ縦に折り返らないようにしている（PC では余白があり1行で全表示）。

## デプロイ（Vercel）

このアプリは **静的 Vite SPA（フロント）+ Vercel Serverless Functions（`/api`）+ KV** の構成。GitHub 連携（独立リポジトリ `tabear25/yosakoi_formation_editor`）で `main` へ push すると自動デプロイされる。

- 設定は `vercel.json`（`framework=vite` / `buildCommand=npm run build` / `outputDirectory=dist`）。`/api/*.ts` は Vercel が自動的にサーバー関数として検出する。
- **必要な環境変数**（Vercel の Settings → Environment Variables で設定。値はコード/Git に置かない）: `APP_LOGIN_ID` / `APP_LOGIN_PASSWORD`（チーム共通ログイン）, `SESSION_SECRET`（トークン署名用のランダム文字列）, KV 接続情報（`KV_REST_API_URL` / `KV_REST_API_TOKEN` 等。Storage 連携が自動注入）。雛形は `.env.example`。
- **KV**: Vercel の Storage（Vercel KV / Upstash Redis）を作成して紐付ける。`doc:main`（ライブドキュメント）と `share:<合言葉>`（共有スナップショット, 90日TTL）を保存。
- ローカルでサーバー関数込み起動は `vercel dev`（`.env.example` を `.env.local` に複製して値を設定）。
- **本番（Production）デプロイは必ず事前に確認を取る。** まず Preview で確認してから本番へ。
- git リポジトリのルートはホームフォルダだが、このプロジェクトは独立リポジトリ。push 先は `yosakoi_formation_editor` のみで、ホームdir には及ばない。

## スコープ外（将来拡張の余地）

- 複数フォーメーションの保管・個人別アカウント・共同編集、シーン間アニメ再生、踊り子の番号・向き表示。データモデルは正規化済みのため、いずれも拡張しやすい。

# Personal rules for Claude Code

## Language
- ユーザーへの説明、確認、要約は常に日本語で行う。
  - ただし、ユーザーが英語でプロンプトを入力してきたときは、英語で行ってもよい。
- 英語のコマンドやエラーメッセージは、実行前または提示時に日本語で意味を短く説明する。

## Safety
- ファイル削除、ディレクトリ削除、大規模置換、依存関係の追加/削除、DBマイグレーション、git commit、git push は無断で実行しない。
- 破壊的または広範囲に影響する操作の前には、必ず日本語で以下を説明して確認する。
  - 何をするか
  - 影響範囲
  - 元に戻す方法
- `.env`、秘密鍵、トークン、認証情報、本番設定ファイルには触れない。必要なら確認する。

## Workflow
- まずコードやファイルを読んで状況を要約し、その後に短い作業方針を示してから変更する。
- 既存の命名規則、コードスタイル、ディレクトリ構成を優先する。
- 指示が曖昧・不明瞭な場合は、クリアになるまでユーザーに質問を繰り返す。

## Skills
- 現在作業しているディレクトリ内に Skill（例: `skills/*/SKILL.md`、`.agents/skills/*/SKILL.md`、`.claude/skills/*/SKILL.md`）があり、その Skill と同種のタスクを依頼された場合は、必ず該当 Skill を先に読み、その手順に従って作業する。
- 複数の Skill が該当しそうな場合は、最も近いものを選び、必要なら使用する Skill 名と理由を日本語で短く説明する。

## Commands
- コマンド実行前に、日本語で目的を1行で説明する。
- 一見して挙動がわかりにくいスクリプト実行時は、主要な引数や処理内容も日本語で短く添える。
- プロジェクト内に定義された正式な test / lint / format コマンドを優先して使う。
- 不明な場合は勝手に新しいツールやコマンド体系を導入しない。

## Testing
- 変更に最も近い範囲のテストから実行する。
- テストやlintが失敗した場合は、失敗内容と考えられる原因を日本語で要約する。
- テストが未実施の場合は、その理由を明示する。

## Editing policy
- 一文字変数や過剰な抽象化を避け、可読性を優先する。
- 既存ファイルの全面書き換えは明示されていない場合を除き、避ける。
- CSVファイルを書き出す場合は、Excelでの文字化けを避けるため、原則としてUTF-8 BOM付き（utf-8-sig）で保存する。
- Skill などの Markdown ファイル（`.md`）は、コピーを作らず、そのファイル自体を直接変更してよい。

## Git
- 明示的に依頼されない限り commit / push / branch作成 は行わない。
- 変更内容は、最後に日本語で要点を簡潔にまとめる。