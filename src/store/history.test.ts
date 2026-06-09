import { describe, expect, it } from 'vitest'
import { historyReducer, initHistory, type HistoryState } from './history'
import type { DocState } from '@/types'

const base: DocState = {
  title: '',
  stage: { kind: 'stage', widthM: 12, depthM: 8, gridM: 1 },
  groups: [],
  dancers: [],
  scenes: [{ id: 's1', name: '場面1', positions: {} }],
  currentSceneId: 's1',
}

function setTitle(h: HistoryState, title: string, coalesce = false): HistoryState {
  return historyReducer(h, { type: 'DO', action: { type: 'SET_TITLE', title }, coalesce })
}

describe('historyReducer', () => {
  it('DOで履歴を積み、UNDO/REDOで往復する', () => {
    let h = initHistory(base)
    h = setTitle(h, 'a')
    h = setTitle(h, 'b')
    expect(h.present.title).toBe('b')
    h = historyReducer(h, { type: 'UNDO' })
    expect(h.present.title).toBe('a')
    h = historyReducer(h, { type: 'UNDO' })
    expect(h.present.title).toBe('')
    h = historyReducer(h, { type: 'REDO' })
    expect(h.present.title).toBe('a')
  })

  it('coalesce=true は履歴を増やさず1ステップにまとめる', () => {
    let h = initHistory(base)
    h = setTitle(h, 'a', false)
    h = setTitle(h, 'ab', true)
    h = setTitle(h, 'abc', true)
    expect(h.past.length).toBe(1)
    h = historyReducer(h, { type: 'UNDO' })
    expect(h.present.title).toBe('') // 連続入力をまとめて一度で戻る
  })

  it('状態が変わらないDO（無効操作）は記録しない', () => {
    let h = initHistory(base)
    // 場面が1つだけのときの REMOVE_SCENE は state を変えずに返す
    h = historyReducer(h, { type: 'DO', action: { type: 'REMOVE_SCENE', id: 's1' }, coalesce: false })
    expect(h.past.length).toBe(0)
    expect(h.present).toBe(base)
  })

  it('PASSTHROUGH は履歴に積まない（ナビゲーション）', () => {
    let h = initHistory(base)
    h = setTitle(h, 'a')
    const before = h.past.length
    h = historyReducer(h, { type: 'PASSTHROUGH', action: { type: 'SELECT_SCENE', id: 's1' } })
    expect(h.past.length).toBe(before)
    expect(h.present.title).toBe('a')
  })

  it('新しいDOはredo（future）を捨てる', () => {
    let h = initHistory(base)
    h = setTitle(h, 'a')
    h = historyReducer(h, { type: 'UNDO' })
    expect(h.future.length).toBe(1)
    h = setTitle(h, 'c')
    expect(h.future.length).toBe(0)
    expect(h.present.title).toBe('c')
  })
})
