import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocState } from '@/types'
import { saveFormationDoc } from '@/lib/api'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 1500

// DocState の変更を一定時間まとめて、指定フォーメーションへ自動保存する。
// マウント時の状態（ハイドレート直後）からは保存せず、最初の編集から保存を始める。
// formationId は AppProvider が key で再マウントされるたびに固定（=フォーメーション単位）。
export function useAutoSave(state: DocState, formationId: string) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [dirty, setDirty] = useState(false)

  const initialRef = useRef(state) // マウント時の状態。ここから変化したら保存対象
  const everEdited = useRef(false) // 一度でも編集したか（アンドゥで初期状態に戻した時も保存するため）
  const latest = useRef(state)
  latest.current = state
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 常に最新の state/状態更新を参照できるよう、保存処理は ref 経由で保持する
  const saveRef = useRef(async (): Promise<boolean> => true)
  saveRef.current = async () => {
    setStatus('saving')
    try {
      await saveFormationDoc(formationId, latest.current)
      setDirty(false)
      setStatus('saved')
      return true
    } catch {
      setStatus('error')
      return false
    }
  }

  useEffect(() => {
    // マウント直後（未編集で初期状態のまま）は保存しない。
    // 一度でも編集していれば、アンドゥで初期状態に戻った場合もその復帰を保存する。
    if (!everEdited.current && state === initialRef.current) return
    everEdited.current = true
    setDirty(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void saveRef.current()
    }, DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  // アンマウント時に保存待ちが残っていれば最後に一度だけ保存する。
  // （フォーメーション切替で AppProvider が再マウントされる際の取りこぼし防止のバックストップ。
  //   通常は切替前に saveNow() を待つため発火しない。setState は避けて直接送信する。）
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current)
        void saveFormationDoc(formationId, latest.current).catch(() => {})
      }
    }
  }, [formationId])

  // 即時保存（ログアウト前・フォーメーション切替前などに使用）。成功可否を返す。
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current)
    return saveRef.current()
  }, [])

  return { status, dirty, saveNow }
}
