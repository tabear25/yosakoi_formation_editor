import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocState } from '@/types'
import { saveDoc } from '@/lib/api'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 1500

// DocState の変更を一定時間まとめてクラウドへ自動保存する。
// マウント時の状態（ハイドレート直後）からは保存せず、最初の編集から保存を始める。
export function useAutoSave(state: DocState) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [dirty, setDirty] = useState(false)

  const initialRef = useRef(state) // マウント時の状態。ここから変化したら保存対象
  const latest = useRef(state)
  latest.current = state
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 常に最新の state/状態更新を参照できるよう、保存処理は ref 経由で保持する
  const saveRef = useRef(async (): Promise<boolean> => true)
  saveRef.current = async () => {
    setStatus('saving')
    try {
      await saveDoc(latest.current)
      setDirty(false)
      setStatus('saved')
      return true
    } catch {
      setStatus('error')
      return false
    }
  }

  useEffect(() => {
    if (state === initialRef.current) return // 未編集（初期状態のまま）は保存しない
    setDirty(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void saveRef.current()
    }, DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [state])

  // 即時保存（ログアウト前などに使用）。成功可否を返す。
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current)
    return saveRef.current()
  }, [])

  return { status, dirty, saveNow }
}
