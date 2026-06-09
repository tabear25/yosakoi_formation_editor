import type { AlignKind, StageConfig, Vec } from '@/types'

// ③ 接近チェックの既定しきい値（中心間の実寸距離, m）
export const DEFAULT_MIN_SPACING_M = 0.5

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

// 2点（正規化座標）間の実寸距離(m)。x方向は横幅、y方向は奥行でスケールする。
export function distanceM(a: Vec, b: Vec, stage: StageConfig): number {
  const dx = (a.x - b.x) * stage.widthM
  const dy = (a.y - b.y) * stage.depthM
  return Math.hypot(dx, dy)
}

// minSpacingM より近い（重なり含む）ペアを総当たりで検出する。
// 返り値: ids=近すぎるペアに含まれる踊り子ID集合 / pairs=近すぎるペア数。
// minSpacingM <= 0 のときは無効（常に空）。最大60人想定でO(n^2)でも十分軽い。
export function findCrowding(
  items: { id: string; pos: Vec }[],
  stage: StageConfig,
  minSpacingM: number,
): { ids: Set<string>; pairs: number } {
  const ids = new Set<string>()
  let pairs = 0
  if (minSpacingM <= 0) return { ids, pairs }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (distanceM(items[i].pos, items[j].pos, stage) < minSpacingM) {
        ids.add(items[i].id)
        ids.add(items[j].id)
        pairs += 1
      }
    }
  }
  return { ids, pairs }
}

// ステージの縦横比（横幅 / 奥行）。画面描画もこの比率を保つ。
export function aspectOf(stage: { widthM: number; depthM: number }): number {
  return stage.widthM / stage.depthM
}

// グリッドの正規化ステップ（x方向・y方向）
export function gridSteps(stage: StageConfig): { sx: number; sy: number } {
  return {
    sx: stage.gridM / stage.widthM,
    sy: stage.gridM / stage.depthM,
  }
}

// 最寄りのグリッド交点へ吸着
export function snapToGrid(p: Vec, stage: StageConfig): Vec {
  const { sx, sy } = gridSteps(stage)
  return {
    x: clamp01(sx > 0 ? Math.round(p.x / sx) * sx : p.x),
    y: clamp01(sy > 0 ? Math.round(p.y / sy) * sy : p.y),
  }
}

export function centroid(points: Vec[]): Vec {
  if (points.length === 0) return { x: 0.5, y: 0.5 }
  const sum = points.reduce(
    (a, p) => ({ x: a.x + p.x, y: a.y + p.y }),
    { x: 0, y: 0 },
  )
  return { x: sum.x / points.length, y: sum.y / points.length }
}

// 踊り子を追加したときの既定配置（左上から格子状に並べる）
export function defaultPosition(index: number): Vec {
  const cols = 6
  const x = 0.12 + (index % cols) * 0.14
  const y = 0.16 + Math.floor(index / cols) * 0.16
  return { x: clamp01(x), y: clamp01(y) }
}

type Item = { id: string; pos: Vec }

// n 個の点を [min, max] 区間に等間隔で並べた座標列を返す。
// 区間が狭すぎる場合は中心を基準に最小間隔へ広げる。
function evenLine(min: number, max: number, n: number): number[] {
  if (n === 1) return [(min + max) / 2]
  const minGap = 0.06
  let lo = min
  let hi = max
  if (hi - lo < minGap * (n - 1)) {
    const center = (lo + hi) / 2
    const half = (minGap * (n - 1)) / 2
    lo = center - half
    hi = center + half
  }
  return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1))
}

function boundsOf(points: Vec[]) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

// 横一列：同じ y（平均）に揃え、x を等間隔に整列
export function alignRow(items: Item[]): Record<string, Vec> {
  const n = items.length
  const y = items.reduce((a, it) => a + it.pos.y, 0) / n
  const { minX, maxX } = boundsOf(items.map((i) => i.pos))
  const xs = evenLine(minX, maxX, n)
  const sorted = [...items].sort((a, b) => a.pos.x - b.pos.x)
  const out: Record<string, Vec> = {}
  sorted.forEach((it, i) => {
    out[it.id] = { x: clamp01(xs[i]), y: clamp01(y) }
  })
  return out
}

// 縦一列：同じ x（平均）に揃え、y を等間隔に整列
export function alignColumn(items: Item[]): Record<string, Vec> {
  const n = items.length
  const x = items.reduce((a, it) => a + it.pos.x, 0) / n
  const { minY, maxY } = boundsOf(items.map((i) => i.pos))
  const ys = evenLine(minY, maxY, n)
  const sorted = [...items].sort((a, b) => a.pos.y - b.pos.y)
  const out: Record<string, Vec> = {}
  sorted.forEach((it, i) => {
    out[it.id] = { x: clamp01(x), y: clamp01(ys[i]) }
  })
  return out
}

// 円形：重心を中心に円周上へ等間隔配置（aspect で画面上も丸くなるよう補正）
export function alignCircle(items: Item[], aspect: number): Record<string, Vec> {
  const n = items.length
  const c = centroid(items.map((i) => i.pos))
  const rx = Math.min(0.34, Math.max(0.14, 0.05 * n))
  const ry = Math.min(0.4, rx * aspect)
  // 現在の角度順に並べ替えてから配置（線が交差しにくい）
  const sorted = [...items].sort(
    (a, b) =>
      Math.atan2(a.pos.y - c.y, a.pos.x - c.x) -
      Math.atan2(b.pos.y - c.y, b.pos.x - c.x),
  )
  const out: Record<string, Vec> = {}
  sorted.forEach((it, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
    out[it.id] = {
      x: clamp01(c.x + rx * Math.cos(angle)),
      y: clamp01(c.y + ry * Math.sin(angle)),
    }
  })
  return out
}

// 格子整列：重心を中心に、選択した踊り子を等間隔の格子へ並べる
export function gridArrange(items: Item[], aspect: number): Record<string, Vec> {
  const n = items.length
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  const gapX = 0.12
  const gapY = gapX * aspect // 画面上の間隔が均等になるよう補正
  const c = centroid(items.map((i) => i.pos))
  const startX = c.x - ((cols - 1) * gapX) / 2
  const startY = c.y - ((rows - 1) * gapY) / 2
  // 読み順（上→下、左→右）に並べてから格子へ割り当て
  const sorted = [...items].sort(
    (a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x,
  )
  const out: Record<string, Vec> = {}
  sorted.forEach((it, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    out[it.id] = {
      x: clamp01(startX + col * gapX),
      y: clamp01(startY + row * gapY),
    }
  })
  return out
}

// 三角形（ピラミッド）：客席正面側（上）を頂点に、後方へ広がる段組みで並べる。
// 各段の人数は 1, 2, 3, ... と増え、最後の段だけ端数になる。
export function alignTriangle(items: Item[], aspect: number): Record<string, Vec> {
  const n = items.length
  const c = centroid(items.map((i) => i.pos))
  let rows = 1
  while ((rows * (rows + 1)) / 2 < n) rows++
  const sX = 0.1 // 段内の横間隔（正規化）
  const sY = sX * aspect // 段の縦間隔（画面上の間隔を横とそろえる）
  const startY = c.y - ((rows - 1) * sY) / 2 // 頂点（上＝客席正面）から下へ
  const sorted = [...items].sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)
  const out: Record<string, Vec> = {}
  let idx = 0
  for (let r = 0; r < rows && idx < n; r++) {
    const m = Math.min(r + 1, n - idx) // この段の人数
    const y = startY + r * sY
    for (let i = 0; i < m; i++) {
      const x = c.x + (i - (m - 1) / 2) * sX
      out[sorted[idx++].id] = { x: clamp01(x), y: clamp01(y) }
    }
  }
  return out
}

export function applyAlign(
  kind: AlignKind,
  items: Item[],
  aspect: number,
): Record<string, Vec> {
  if (items.length < 2) return {}
  switch (kind) {
    case 'row':
      return alignRow(items)
    case 'column':
      return alignColumn(items)
    case 'circle':
      return alignCircle(items, aspect)
    case 'grid':
      return gridArrange(items, aspect)
    case 'triangle':
      return alignTriangle(items, aspect)
  }
}
