import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import type { DocState, Scene } from '@/types'
import { useAutoSave, type SaveStatus } from '@/hooks/useAutoSave'
import { createInitialState, projectReducer, type Action } from './projectReducer'

type AppContextValue = {
  state: DocState
  dispatch: Dispatch<Action>
  edited: boolean
  currentScene: Scene
  // クラウド自動保存の状態
  saveStatus: SaveStatus
  dirty: boolean
  saveNow: () => Promise<boolean>
  // UI 状態（ドキュメントには含めない一時的な選択・モード）
  selectedIds: string[]
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  selectionMode: boolean
  setSelectionMode: (v: boolean) => void
  snapEnabled: boolean
  setSnapEnabled: (v: boolean) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({
  children,
  initialState,
}: {
  children: ReactNode
  initialState?: DocState
}) {
  // initialState があればそれを初期値に、なければサンプルデータを生成する
  const [state, rawDispatch] = useReducer(
    projectReducer,
    initialState,
    (init) => init ?? createInitialState(),
  )
  const [edited, setEdited] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [snapEnabled, setSnapEnabled] = useState(false)

  // ユーザー操作（dispatch）が一度でもあれば「編集あり」とみなす
  const dispatch = useCallback((action: Action) => {
    setEdited(true)
    rawDispatch(action)
  }, [])

  // state の変更を一定間隔でまとめてクラウドへ自動保存する
  const { status: saveStatus, dirty, saveNow } = useAutoSave(state)

  const currentScene = useMemo(
    () =>
      state.scenes.find((s) => s.id === state.currentSceneId) ?? state.scenes[0],
    [state.scenes, state.currentSceneId],
  )

  // 削除された踊り子が選択に残らないように整理する
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => state.dancers.some((d) => d.id === id))
      return next.length === prev.length ? prev : next
    })
  }, [state.dancers])

  const value: AppContextValue = {
    state,
    dispatch,
    edited,
    currentScene,
    saveStatus,
    dirty,
    saveNow,
    selectedIds,
    setSelectedIds,
    selectionMode,
    setSelectionMode,
    snapEnabled,
    setSnapEnabled,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp は AppProvider の内側で使ってください')
  return ctx
}
