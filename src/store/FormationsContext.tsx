// 複数フォーメーションの一覧と操作（切替・新規・複製・改名・削除）を配布するコンテキスト。
// 実体は EditorApp が組み立て、AppProvider の外側で提供する。
import { createContext, useContext } from 'react'
import type { FormationMeta } from '@/lib/api'

export type FormationsContextValue = {
  items: FormationMeta[]
  currentId: string
  busy: boolean
  error: string | null
  refresh: () => void
  switchTo: (id: string) => void
  createNew: () => void
  duplicate: (id: string) => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
}

export const FormationsContext = createContext<FormationsContextValue | null>(null)

export function useFormations(): FormationsContextValue {
  const ctx = useContext(FormationsContext)
  if (!ctx) {
    throw new Error('useFormations は FormationsContext.Provider の内側で使ってください')
  }
  return ctx
}
