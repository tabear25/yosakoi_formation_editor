# yosakoi_formation — 開発サマリー（引き継ぎ用）

作成: 2026-05-24 / 対象: `C:\Users\str06\private_workplace\yosakoi_formation`

よさこいのフォーメーション表を作成・編集し、画像/PDF に書き出す Web アプリ。**バックエンドなしの静的 Vite SPA**。このファイルは、初回構築セッションの要件・設計判断・状態をまとめた引き継ぎメモ（恒久ガイドは `../CLAUDE.md`）。

## 確定要件（初回ヒアリング結果）

| 項目 | 決定 |
|---|---|
| シーン管理 | 複数シーンをタイムラインで切替。アニメ再生は無し |
| 演舞エリア | 長方形ステージ／流し(パレード)を切替。寸法・縦横比を調整可 |
| 保存・共有 | **画像(PNG)/PDF 出力のみ。永続化はしない**（2度警告の上で本人が選択） |
| 踊り子表示 | 名前 + 色・グループ（番号・向きは対象外） |
| 人数規模 | 最大 〜60 人 |
| 利用端末 | PC / タブレット / スマホ（タッチ・レスポンシブ必須） |
| 編集補助 | グリッド吸着・前シーン複製・整列・ステージ寸法調整 |

## 実装した機能

- **シーン**: 追加 / 現在を複製（前シーンの配置を引き継ぐ）/ 並べ替え / 改名 / 削除 / 切替（下部タイムライン）
- **演舞エリア**: ステージ⇔流し切替、横幅・奥行(m)・グリッド間隔の調整。**「客席（正面）」はステージ上辺の上**に表示（=画像でも上が正面）。流しは左に「↑ 進行方向」
- **踊り子/グループ**: 名簿で追加・改名・グループ変更・削除。グループは色（ネイティブカラーピッカー）で管理。マーカーは色＋名前
- **配置操作**: Pointer Events でマウス/タッチ共通ドラッグ。ズーム/パン。**グリッド吸着**
- **整列（フォーメーション成型）**: 横一列 / 縦一列 / 円 / 格子 / **三角（客席側=上を頂点にしたピラミッド）**。選択は「選択」モードでタップ
- **グループドラッグ**: 複数選択中、掴んだ人を基準に**選択全員を形のまま一緒に移動**（枠内に制限、吸着時は掴んだ人が格子に合う）
- **書き出し**: 表示中シーンを PNG、全シーンを PDF（1場面=1ページ）
- **誤消失ガード**: 編集後の離脱時にブラウザ標準の確認（保存はしない）

## 主要な設計判断（コードだけでは分かりにくい点）

- **永続化なしは“仕様”**。localStorage/JSON は未実装。リロード/タブ閉じでデータは消える。→ **頼まれない限り保存機能を足さない**（足す場合の第一候補は「localStorage 自動保存 + JSON 入出力」）
- **座標は正規化 (x,y)∈[0,1]** で保持（`src/types.ts`）。画面サイズ・ステージ寸法・縦横比を変えても相対配置が保たれる
- **書き出しは Canvas 2D 直描画**（`src/lib/export.ts`）。html-to-image は使わず、日本語を canvas でラスタライズ→PNG/PDF 化（jsPDF のフォント制約回避）。jspdf 同梱の html2canvas/dompurify は分割チャンクで実行時は読み込まれない
- **UI は shadcn/Radix 不使用**。Tailwind + ネイティブフォーム部品 + 自作の最小 Button/Modal/Drawer（`src/components/ui.tsx`）で軽量・タッチ対応
- 状態は `useReducer`（`src/store/projectReducer.ts`）+ Context（`ProjectContext.tsx`）。選択・吸着・選択モードは UI 状態として同 Context 保持

## 技術スタック / 主要ファイル

- Vite 7 + React 18 + TypeScript 5.6 + Tailwind 3.4、アイコン lucide-react、PDF は jspdf
- `src/types.ts` モデル / `src/lib/geometry.ts` 幾何（吸着・整列・正規化、テスト対象）/ `src/lib/export.ts` 出力
- `src/components/`: `StageView`(描画) `StageCanvas`(操作・ズーム/パン・グループドラッグ) `RosterPanel` `SceneList` `Toolbar` `StageSettings` `AppHeader` `ui`
- 単体テスト: `src/lib/geometry.test.ts`（vitest）

## 検証結果（ポータブル Node v24.16.0 で実行）

- `npm run check`（tsc --noEmit）… OK
- `npm run test`（vitest）… 7/7 passed
- `npm run build`（vite build）… OK（`dist/` 生成。500kB超の警告は jspdf 由来で実害なし）
- 開発サーバ `npm run dev`（:5178）… HTTP 200
- ※ ブラウザでの実描画・操作の目視確認は未実施（ナビゲーション許可が出なかったため）

## 環境メモ（重要）

- この PC に **システム Node/npm が無い**（winget/choco/scoop も無し）。公式 Node v24 LTS を **`.tooling/node-v24.16.0-win-x64`**（gitignore 済み）に展開して使用。実行時は PATH に前置き:
  `$env:Path = "C:\Users\str06\private_workplace\yosakoi_formation\.tooling\node-v24.16.0-win-x64;$env:Path"`
- **git リポジトリのルートは `C:\Users\str06`（ホームフォルダ全体）**でリモート未設定。個人情報を含むため**絶対に push しない**。プロジェクト単体を公開する場合は、そのフォルダを独立 git リポジトリにしてから。

## デプロイ（Vercel）— 設定済み・未デプロイ

- 追加済み: `vercel.json`（framework=vite / build=`npm run build` / output=`dist`）、`.vercelignore`（`.tooling`・`node_modules`・`dist` 除外）
- 方針: 静的 SPA として配信。Git 連携時は Root Directory=`yosakoi_formation`。本番デプロイは事前確認。
- 推奨手順（GitHub 不要・クラウドビルド）: `yosakoi_formation` で `vercel login` → `vercel`(Preview) → `vercel --prod`(本番)
- ユーザー判断で**今回はデプロイ実行せず（設定のみ）**

## 未対応 / 今後の拡張余地

- 永続化（localStorage / JSON / サーバ）、シーン間アニメ再生、踊り子の番号・向き表示。データモデルは正規化済みでそのまま拡張可能。
- 注: Vercel プラグイン / agent-skills は主に Next.js+DB 向けで本アプリ（静的SPA）には不要。
