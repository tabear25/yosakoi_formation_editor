// シーンに関する純関数：出演判定（④）と、シーン間の位置補間（⑦）。
// ドメイン状態に依存しない計算だけを置き、UI/状態管理から再利用する。

import type { Dancer, Scene, Vec } from '@/types'

// 指定シーンにその踊り子が出演しているか（absent に含まれていなければ出演）。
export function isPresent(scene: Scene, dancerId: string): boolean {
  return !scene.absent?.includes(dancerId)
}

// シーンに出演している踊り子だけを返す（並び順は維持）。
export function presentDancers(scene: Scene, dancers: Dancer[]): Dancer[] {
  if (!scene.absent || scene.absent.length === 0) return dancers
  const absent = new Set(scene.absent)
  return dancers.filter((d) => !absent.has(d.id))
}

// 2点の線形補間（f=0でa, f=1でb）。
export function lerp(a: Vec, b: Vec, f: number): Vec {
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

// ⑦ 動きプレビュー用：通しタイムライン値 t（0..シーン数-1）における各踊り子の表示位置。
// 整数 t はそのシーンちょうど。小数なら i=floor(t) と i+1 の間を補間する。
// 出入りする踊り子（片側シーンにしかいない人）は「瞬間で出現/消滅」：
//   - 両シーンに出演 → 線形補間
//   - 出発シーンのみ出演 → 出発位置に留まり、次シーン到達(整数t)で消える
//   - 到着シーンのみ出演 → 到着位置に表示（区間に入った瞬間から現れる）
export function interpolatePositions(
  scenes: Scene[],
  dancers: Dancer[],
  t: number,
): { id: string; pos: Vec }[] {
  const total = scenes.length
  if (total === 0) return []
  let i = Math.floor(t)
  if (i < 0) i = 0
  if (i > total - 1) i = total - 1
  const f = clamp(t - i, 0, 1)
  const a = scenes[i]
  const b = i + 1 < total ? scenes[i + 1] : undefined

  const out: { id: string; pos: Vec }[] = []
  for (const d of dancers) {
    const pa = a.positions[d.id]
    const inA = !!pa && isPresent(a, d.id)
    const pb = b?.positions[d.id]
    const inB = !!pb && !!b && isPresent(b, d.id)

    if (f === 0 || !b) {
      if (inA) out.push({ id: d.id, pos: pa! })
    } else if (inA && inB) {
      out.push({ id: d.id, pos: lerp(pa!, pb!, f) })
    } else if (inA) {
      out.push({ id: d.id, pos: pa! })
    } else if (inB) {
      out.push({ id: d.id, pos: pb! })
    }
  }
  return out
}
