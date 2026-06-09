// よさこい フォーメーション表のドメインモデル
//
// 座標はすべて「ステージ矩形に対する正規化座標」(x, y) ∈ [0, 1] で保持する。
// これにより画面サイズやステージ寸法を変えても相対配置が崩れず、
// レスポンシブ表示・寸法調整・グリッド吸着・整列計算を一貫して扱える。

export type Group = {
  id: string
  name: string
  color: string // 16進カラー (#rrggbb)
}

export type Dancer = {
  id: string
  name: string
  groupId: string
}

export type Vec = {
  x: number // 0..1（ステージ左→右）
  y: number // 0..1（ステージ奥→手前）
}

export type Scene = {
  id: string
  name: string
  positions: Record<string, Vec> // dancerId -> 正規化座標
  // このシーンに「出ない」踊り子のID。未指定/空配列なら全員出演（既存データ互換）。
  // 位置情報(positions)は保持したまま、表示・出力・整列の対象からだけ外す。
  absent?: string[]
}

export type StageKind = 'stage' | 'parade'

export type StageConfig = {
  kind: StageKind
  widthM: number // 横幅(m)
  depthM: number // 奥行(m)  stage:客席方向の奥行 / parade:進行方向の長さ
  gridM: number // グリッド間隔(m)
  // 踊り子同士がこの距離(m)より近いと「接近」として警告する。未指定なら既定値を使う。0で無効。
  minSpacingM?: number
}

// アプリが保持する「フォーメーション表」全体のドキュメント状態
export type DocState = {
  title: string
  stage: StageConfig
  groups: Group[]
  dancers: Dancer[]
  scenes: Scene[]
  currentSceneId: string
}

export type AlignKind = 'row' | 'column' | 'circle' | 'grid' | 'triangle'
