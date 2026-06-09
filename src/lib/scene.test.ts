import { describe, expect, it } from 'vitest'
import { interpolatePositions, isPresent, lerp, presentDancers } from './scene'
import type { Dancer, Scene } from '@/types'

const dancers: Dancer[] = [
  { id: 'a', name: 'A', groupId: 'g' },
  { id: 'b', name: 'B', groupId: 'g' },
]

function scene(id: string, positions: Scene['positions'], absent?: string[]): Scene {
  return { id, name: id, positions, absent }
}

describe('isPresent / presentDancers', () => {
  it('absent に含まれる踊り子は非出演', () => {
    const s = scene('s', { a: { x: 0, y: 0 }, b: { x: 1, y: 1 } }, ['b'])
    expect(isPresent(s, 'a')).toBe(true)
    expect(isPresent(s, 'b')).toBe(false)
    expect(presentDancers(s, dancers).map((d) => d.id)).toEqual(['a'])
  })
  it('absent 未指定なら全員出演', () => {
    const s = scene('s', { a: { x: 0, y: 0 } })
    expect(presentDancers(s, dancers)).toHaveLength(2)
  })
})

describe('lerp', () => {
  it('中点を返す', () => {
    expect(lerp({ x: 0, y: 0 }, { x: 1, y: 1 }, 0.5)).toEqual({ x: 0.5, y: 0.5 })
  })
})

describe('interpolatePositions', () => {
  const a = scene('A', { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } })
  const b = scene('B', { a: { x: 1, y: 1 }, b: { x: 1, y: 1 } })

  it('整数tはそのシーンちょうど', () => {
    const at0 = interpolatePositions([a, b], dancers, 0)
    expect(at0.find((it) => it.id === 'a')!.pos).toEqual({ x: 0, y: 0 })
    const at1 = interpolatePositions([a, b], dancers, 1)
    expect(at1.find((it) => it.id === 'a')!.pos).toEqual({ x: 1, y: 1 })
  })

  it('中間tは両シーン出演者を線形補間', () => {
    const mid = interpolatePositions([a, b], dancers, 0.5)
    expect(mid.find((it) => it.id === 'a')!.pos).toEqual({ x: 0.5, y: 0.5 })
  })

  it('出発のみ出演（退場）は区間中は出発位置に留まり、到着シーンで消える', () => {
    const bLeaves = scene('B', { a: { x: 1, y: 1 }, b: { x: 1, y: 1 } }, ['b'])
    const mid = interpolatePositions([a, bLeaves], dancers, 0.5)
    expect(mid.find((it) => it.id === 'b')!.pos).toEqual({ x: 0, y: 0 })
    const end = interpolatePositions([a, bLeaves], dancers, 1)
    expect(end.find((it) => it.id === 'b')).toBeUndefined()
  })

  it('到着のみ出演（登場）は区間に入った瞬間から到着位置に出る', () => {
    const aWithout = scene('A', { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } }, ['b'])
    const start = interpolatePositions([aWithout, b], dancers, 0)
    expect(start.find((it) => it.id === 'b')).toBeUndefined()
    const mid = interpolatePositions([aWithout, b], dancers, 0.5)
    expect(mid.find((it) => it.id === 'b')!.pos).toEqual({ x: 1, y: 1 })
  })
})
