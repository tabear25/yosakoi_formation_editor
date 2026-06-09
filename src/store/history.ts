// ② アンドゥ/リダゥ用の履歴 reducer（純関数・テスト対象）。
// DocState のスナップショットを past / present / future で持つ。
// - DO        : 通常の編集。直前状態を past へ積み、future を捨てる。
//               coalesce=true のときは直前のステップへ統合し、新しい履歴を増やさない
//               （ドラッグ中の連続更新や、文字入力の連打を1ステップにまとめるため）。
// - PASSTHROUGH: 履歴に積まない適用（シーン切替などのナビゲーション）。
// - UNDO/REDO : present を past/future と入れ替える。

import type { DocState } from '@/types'
import { projectReducer, type Action } from './projectReducer'

export type HistoryState = {
  past: DocState[]
  present: DocState
  future: DocState[]
}

export type HistoryAction =
  | { type: 'DO'; action: Action; coalesce: boolean }
  | { type: 'PASSTHROUGH'; action: Action }
  | { type: 'UNDO' }
  | { type: 'REDO' }

// 履歴に保持する最大ステップ数（直近のみ保持）。
export const HISTORY_LIMIT = 50

export function initHistory(present: DocState): HistoryState {
  return { past: [], present, future: [] }
}

export function historyReducer(
  state: HistoryState,
  ha: HistoryAction,
): HistoryState {
  switch (ha.type) {
    case 'DO': {
      const next = projectReducer(state.present, ha.action)
      if (next === state.present) return state // 変化なし（無効操作）は記録しない
      if (ha.coalesce && state.past.length > 0) {
        // 直前ステップへ統合：past は増やさず present だけ進める
        return { past: state.past, present: next, future: [] }
      }
      const past =
        state.past.length >= HISTORY_LIMIT
          ? [...state.past.slice(state.past.length - HISTORY_LIMIT + 1), state.present]
          : [...state.past, state.present]
      return { past, present: next, future: [] }
    }

    case 'PASSTHROUGH': {
      const next = projectReducer(state.present, ha.action)
      if (next === state.present) return state
      return { ...state, present: next }
    }

    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      }
    }
  }
}
