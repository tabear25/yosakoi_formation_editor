import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react'
import type { DocState, Scene } from '@/types'
import { useAutoSave, type SaveStatus } from '@/hooks/useAutoSave'
import { createInitialState, type Action } from './projectReducer'
import { historyReducer, initHistory } from './history'

type AppContextValue = {
  state: DocState
  dispatch: Dispatch<Action>
  edited: boolean
  currentScene: Scene
  // クラウド自動保存の状態
  saveStatus: SaveStatus
  dirty: boolean
  saveNow: () => Promise<boolean>
  // ② アンドゥ/リダゥ
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  // ドラッグなど連続操作を1ステップにまとめるための区切り
  beginTransaction: () => void
  endTransaction: () => void
  // ⑦ 動きプレビューのスクラブ位置（null=プレビュー無効 / 0..シーン数-1）
  previewT: number | null
  setPreviewT: Dispatch<SetStateAction<number | null>>
  // UI 状態（ドキュメントには含めない一時的な選択・モード）
  selectedIds: string[]
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  selectionMode: boolean
  setSelectionMode: (v: boolean) => void
  snapEnabled: boolean
  setSnapEnabled: (v: boolean) => void
}

const AppContext = createContext<AppContextValue | null>(null)

// EditorApp（フォーメーション切替側）から呼べる命令的API。
// 切替前の保存フラッシュと、一覧からの現在フォーメーション改名に使う。
export type EditorApi = {
  saveNow: () => Promise<boolean>
  setTitle: (title: string) => void
}

// 文字入力や数値スライダーなど、連打を1つの履歴ステップに統合したい操作のキー。
// 同じキーが連続する間はまとめ、別の操作が挟まると新しいステップになる。
function mergeKeyFor(action: Action): string | null {
  switch (action.type) {
    case 'SET_TITLE':
      return 'title'
    case 'RENAME_SCENE':
      return `rename:${action.id}`
    case 'UPDATE_DANCER':
      return `dancer:${action.id}`
    case 'UPDATE_GROUP':
      return `group:${action.id}`
    case 'SET_STAGE':
      return 'stage'
    default:
      return null
  }
}

export function AppProvider({
  children,
  initialState,
  formationId,
  editorApiRef,
}: {
  children: ReactNode
  initialState?: DocState
  formationId: string
  editorApiRef?: MutableRefObject<EditorApi | null>
}) {
  // initialState があればそれを初期値に、なければサンプルデータを生成する
  const [history, rawDispatch] = useReducer(
    historyReducer,
    initialState,
    (init) => initHistory(init ?? createInitialState()),
  )
  const state = history.present

  const [edited, setEdited] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [snapEnabled, setSnapEnabled] = useState(false)
  const [previewT, setPreviewT] = useState<number | null>(null)

  // 履歴の統合判定に使うキー。直前のキーと一致したら同じステップにまとめる。
  const lastKeyRef = useRef<string | null>(null)
  // ドラッグ中はこのキーを使い、ジェスチャ単位で1ステップにする（連番で別ドラッグと区別）。
  const gestureKeyRef = useRef<string | null>(null)
  const gestureCounter = useRef(0)

  // ユーザー操作（dispatch）が一度でもあれば「編集あり」とみなす
  const dispatch = useCallback((action: Action) => {
    setEdited(true)
    // シーン切替などのナビゲーションは履歴に積まない
    if (action.type === 'SELECT_SCENE') {
      lastKeyRef.current = null
      rawDispatch({ type: 'PASSTHROUGH', action })
      return
    }
    const key = gestureKeyRef.current ?? mergeKeyFor(action)
    const coalesce = key !== null && key === lastKeyRef.current
    lastKeyRef.current = key
    rawDispatch({ type: 'DO', action, coalesce })
  }, [])

  // ドラッグ開始/終了の区切り。1ジェスチャ＝1履歴ステップにまとめる。
  const beginTransaction = useCallback(() => {
    gestureCounter.current += 1
    gestureKeyRef.current = `drag:${gestureCounter.current}`
  }, [])
  const endTransaction = useCallback(() => {
    gestureKeyRef.current = null
    lastKeyRef.current = null // 次の操作はドラッグと統合しない
  }, [])

  const undo = useCallback(() => {
    lastKeyRef.current = null
    rawDispatch({ type: 'UNDO' })
  }, [])
  const redo = useCallback(() => {
    lastKeyRef.current = null
    rawDispatch({ type: 'REDO' })
  }, [])
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  // state の変更を一定間隔でまとめて、現在のフォーメーションへ自動保存する
  const { status: saveStatus, dirty, saveNow } = useAutoSave(state, formationId)

  // EditorApp から保存フラッシュ・改名を呼べるようにブリッジを登録する
  useEffect(() => {
    if (!editorApiRef) return
    editorApiRef.current = {
      saveNow,
      setTitle: (title: string) => dispatch({ type: 'SET_TITLE', title }),
    }
    return () => {
      editorApiRef.current = null
    }
  }, [editorApiRef, saveNow, dispatch])

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
    undo,
    redo,
    canUndo,
    canRedo,
    beginTransaction,
    endTransaction,
    previewT,
    setPreviewT,
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
