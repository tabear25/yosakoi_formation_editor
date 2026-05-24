import { describe, expect, it } from 'vitest'
import {
  alignCircle,
  alignRow,
  alignTriangle,
  applyAlign,
  clamp01,
  defaultPosition,
  snapToGrid,
} from './geometry'
import type { StageConfig } from '@/types'

const stage: StageConfig = { kind: 'stage', widthM: 10, depthM: 10, gridM: 1 }

describe('clamp01', () => {
  it('範囲外を0..1に丸める', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(1.5)).toBe(1)
    expect(clamp01(0.3)).toBeCloseTo(0.3)
  })
})

describe('snapToGrid', () => {
  it('最寄りの格子点に吸着する（10m幅・1m格子→0.1刻み）', () => {
    const p = snapToGrid({ x: 0.23, y: 0.57 }, stage)
    expect(p.x).toBeCloseTo(0.2)
    expect(p.y).toBeCloseTo(0.6)
  })
})

describe('defaultPosition', () => {
  it('常に0..1の範囲に収まる', () => {
    for (let i = 0; i < 60; i++) {
      const p = defaultPosition(i)
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(1)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(1)
    }
  })
})

describe('alignRow', () => {
  it('全員のyが揃う', () => {
    const items = [
      { id: 'a', pos: { x: 0.1, y: 0.2 } },
      { id: 'b', pos: { x: 0.5, y: 0.8 } },
      { id: 'c', pos: { x: 0.9, y: 0.4 } },
    ]
    const out = alignRow(items)
    const ys = Object.values(out).map((p) => p.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0)
  })
})

describe('alignCircle', () => {
  it('入力した全idを返す', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      id: `d${i}`,
      pos: { x: Math.random(), y: Math.random() },
    }))
    const out = alignCircle(items, 1)
    expect(Object.keys(out).sort()).toEqual(items.map((i) => i.id).sort())
  })
})

describe('alignTriangle', () => {
  it('全idを返し、頂点（最上段）は1人だけになる', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      id: `d${i}`,
      pos: { x: 0.3 + i * 0.05, y: 0.5 },
    }))
    const out = alignTriangle(items, 1)
    expect(Object.keys(out)).toHaveLength(6)
    const ys = Object.values(out).map((p) => p.y)
    const minY = Math.min(...ys)
    const topCount = ys.filter((y) => Math.abs(y - minY) < 1e-9).length
    expect(topCount).toBe(1)
  })
})

describe('applyAlign', () => {
  it('選択が1人以下なら何もしない', () => {
    expect(applyAlign('row', [{ id: 'a', pos: { x: 0, y: 0 } }], 1)).toEqual({})
  })
})
