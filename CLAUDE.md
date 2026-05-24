# yosakoi_formation

よさこいのフォーメーション表を作成・編集し、画像/PDFに書き出すWebアプリ。バックエンドなしの静的フロントエンド（Vite + React 18 + TypeScript + Tailwind CSS）。

## コマンド

| コマンド | 用途 |
|---|---|
| `npm install` | 依存関係のインストール |
| `npm run dev` | 開発サーバ起動（Vite, 既定 http://localhost:5173 ） |
| `npm run build` | 本番ビルド（`tsc --noEmit` 型チェック後に `vite build` → `dist/`） |
| `npm run preview` | ビルド成果物のプレビュー配信 |
| `npm run check` | 型チェックのみ（`tsc --noEmit`） |
| `npm run test` | 幾何ロジックの単体テスト（vitest, `src/lib/geometry.test.ts`） |

> 実行には Node.js（推奨 v20.19+ / v22.12+）が必要。

## アーキテクチャ

- **状態**: `src/store/projectReducer.ts`（ドキュメント = タイトル/ステージ/グループ/踊り子/シーン）を `useReducer` で管理し、`src/store/ProjectContext.tsx` の `AppProvider` / `useApp` で配布。選択・グリッド吸着・選択モードなどのUI状態も同コンテキストで保持。**永続化は行わない**（要件: 画像/PDF出力のみ。編集後の離脱時だけブラウザ標準の確認を表示する安全策あり）。
- **座標**: すべて「ステージ矩形に対する正規化座標 (x, y) ∈ [0, 1]」で保持（`src/types.ts`）。画面サイズ・ステージ寸法・縦横比を変えても相対配置が保たれる。ピクセル変換は描画側で行う。
- **画面描画**: `src/components/StageView.tsx`（枠・グリッド・踊り子マーカーをDOMで描画）。`src/components/StageCanvas.tsx` が表示領域の採寸・ズーム/パン・Pointer Events によるドラッグ/選択/パンを担当（マウス/タッチ共通、`touch-action: none`）。
- **書き出し**: `src/lib/export.ts` が **Canvas 2D で直接描画**して PNG / PDF（jsPDF, 1場面=1ページ）を生成。日本語は canvas でラスタライズするため jsPDF のフォント制約を回避している。
- **幾何**: `src/lib/geometry.ts`（正規化変換・グリッド吸着・整列〔横/縦/円/格子〕・既定配置）。純関数でテスト対象。
- **UI部品**: `src/components/ui.tsx`（Button / Modal / Drawer）。shadcn/Radix は使わず Tailwind + ネイティブフォーム部品で軽量・タッチ対応。アイコンは lucide-react。

## レスポンシブ

- `lg` 以上: 名簿は左サイドバー固定。未満: ヘッダーの「名簿」ボタンからドロワー表示。シーン一覧は下部に横スクロール。ステージ設定はモーダル。

## デプロイ（Vercel）

このアプリは**バックエンドなしの静的 Vite SPA**。Vercel では Vite フレームワークとして配信する（DB・サーバ関数・環境変数は不要）。

- 設定は `vercel.json`（`framework=vite` / `buildCommand=npm run build` / `outputDirectory=dist`）。CLI デプロイ時のアップロード除外は `.vercelignore`（`.tooling`〔ポータブルNode〕・`node_modules`・`dist` を除外）。
- このリポジトリは多プロジェクト構成のため、Vercel 側の **Root Directory を `yosakoi_formation` に設定**する（Git 連携時）。
- **本番（Production）デプロイは必ず事前に確認を取る。** まず Preview で内容を確認してから本番へ。
- 実行には Node.js が必要（この環境ではポータブル Node を `.tooling/` に配置済み。日常運用は公式 Node の導入を推奨）。

## スコープ外（将来拡張の余地）

- 永続化（localStorage / JSON / サーバ）、シーン間アニメ再生、踊り子の番号・向き表示。データモデルは正規化済みのため、いずれもそのまま拡張できる。

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