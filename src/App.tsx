import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppHeader } from './components/AppHeader'
import { FormationsDialog } from './components/FormationsDialog'
import { LoginGate } from './components/LoginGate'
import { PreviewBar } from './components/PreviewBar'
import { RosterPanel } from './components/RosterPanel'
import { SceneList } from './components/SceneList'
import { SaveErrorBanner } from './components/SaveErrorBanner'
import { ShareDialog } from './components/ShareDialog'
import { ShareViewer } from './components/ShareViewer'
import { StageCanvas } from './components/StageCanvas'
import { StageSettings } from './components/StageSettings'
import { Toolbar } from './components/Toolbar'
import { Drawer, Modal } from './components/ui'
import {
  ApiError,
  createFormation,
  deleteFormation,
  duplicateFormation,
  listFormations,
  loadFormationDoc,
  renameFormation,
} from './lib/api'
import { AppProvider, useApp, type EditorApi } from './store/ProjectContext'
import {
  FormationsContext,
  type FormationsContextValue,
} from './store/FormationsContext'
import { createInitialState } from './store/projectReducer'
import type { DocState } from './types'

function Layout() {
  const { dirty, undo, redo, previewT } = useApp()
  const [rosterOpen, setRosterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [formationsOpen, setFormationsOpen] = useState(false)

  // 自動保存はあるが、保存が完了する前の離脱だけブラウザ標準の確認を出す
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // ② キーボードショートカット（Ctrl/⌘+Z で戻す、+Shift+Z または +Y でやり直す）。
  // テキスト入力中とプレビュー中は横取りしない。
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (previewT !== null) return
      if (!(e.ctrlKey || e.metaKey)) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      ) {
        return
      }
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, previewT])

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <AppHeader
        onOpenRoster={() => setRosterOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        onOpenFormations={() => setFormationsOpen(true)}
      />
      <SaveErrorBanner />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block">
          <RosterPanel />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <StageCanvas />
          </div>
          <PreviewBar />
          <Toolbar onOpenSettings={() => setSettingsOpen(true)} />
        </main>
      </div>

      <SceneList />

      <Drawer open={rosterOpen} onClose={() => setRosterOpen(false)} title="名簿・グループ">
        <RosterPanel />
      </Drawer>
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="ステージ設定">
        <StageSettings />
      </Modal>
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
      <FormationsDialog open={formationsOpen} onClose={() => setFormationsOpen(false)} />
    </div>
  )
}

function operationError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'limit_reached') {
      return '保存できるフォーメーション数の上限に達しています。'
    }
    if (e.code === 'cannot_delete_last') {
      return '最後の1件は削除できません。'
    }
    if (e.status === 401) {
      return 'セッションが切れました。ページを再読み込みして再ログインしてください。'
    }
  }
  return '操作に失敗しました。時間をおいて再度お試しください。'
}

// ログイン後、フォーメーション一覧を読み込み、現在のものを開いてエディタを起動する。
function EditorApp() {
  const [current, setCurrent] = useState<{ id: string; doc: DocState } | null>(null)
  const [items, setItems] = useState<FormationsContextValue['items']>([])
  const [busy, setBusy] = useState(false)
  const [opError, setOpError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const editorApiRef = useRef<EditorApi | null>(null)
  const busyRef = useRef(false)

  // 初期ロード：一覧を取得（必要なら旧データ移行）。空なら最初の1件を作成。
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        let index = await listFormations()
        if (index.items.length === 0) {
          const doc = createInitialState()
          const created = await createFormation(doc)
          if (!active) return
          setItems(created.items)
          setCurrent({ id: created.id, doc })
          return
        }
        const id =
          index.currentId && index.items.some((m) => m.id === index.currentId)
            ? index.currentId
            : index.items[0].id
        const doc = await loadFormationDoc(id)
        if (!active) return
        setItems(index.items)
        setCurrent({ id, doc: doc ?? createInitialState() })
      } catch {
        if (active) setLoadFailed(true)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  async function run(fn: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setOpError(null)
    try {
      await fn()
    } catch (e) {
      setOpError(operationError(e))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  // 一覧を最新化する（ヘッダーでの改名や他端末の更新を反映）。背景更新のため busy は使わない。
  function refresh() {
    listFormations()
      .then((index) => setItems(index.items))
      .catch(() => {})
  }

  function switchTo(id: string) {
    if (!current || id === current.id) return
    void run(async () => {
      await editorApiRef.current?.saveNow() // 現在の編集をフラッシュ
      const doc = await loadFormationDoc(id)
      setCurrent({ id, doc: doc ?? createInitialState() })
    })
  }

  function createNew() {
    void run(async () => {
      await editorApiRef.current?.saveNow()
      const doc = createInitialState()
      const created = await createFormation(doc)
      setItems(created.items)
      setCurrent({ id: created.id, doc })
    })
  }

  function duplicate(id: string) {
    void run(async () => {
      await editorApiRef.current?.saveNow() // 元を最新状態で複製するため
      const created = await duplicateFormation(id)
      setItems(created.items)
      const doc = await loadFormationDoc(created.id)
      setCurrent({ id: created.id, doc: doc ?? createInitialState() })
    })
  }

  function rename(id: string, title: string) {
    const trimmed = title.trim()
    if (!trimmed || !current) return
    if (id === current.id) {
      // 開いているものは編集中の状態に反映（自動保存で索引の title も更新される）
      editorApiRef.current?.setTitle(trimmed)
      setItems((prev) => prev.map((m) => (m.id === id ? { ...m, title: trimmed } : m)))
      return
    }
    void run(async () => {
      const { items: next } = await renameFormation(id, trimmed)
      setItems(next)
    })
  }

  function remove(id: string) {
    void run(async () => {
      const index = await deleteFormation(id)
      setItems(index.items)
      if (current && id === current.id) {
        const doc = await loadFormationDoc(index.currentId)
        setCurrent({ id: index.currentId, doc: doc ?? createInitialState() })
      }
    })
  }

  if (loadFailed) {
    return (
      <FullScreenMessage>
        データの読み込みに失敗しました。ページを再読み込みしてください。
      </FullScreenMessage>
    )
  }
  if (!current) {
    return <FullScreenMessage>読み込み中…</FullScreenMessage>
  }

  const formationsValue: FormationsContextValue = {
    items,
    currentId: current.id,
    busy,
    error: opError,
    refresh,
    switchTo,
    createNew,
    duplicate,
    rename,
    remove,
  }

  return (
    <FormationsContext.Provider value={formationsValue}>
      <AppProvider
        key={current.id}
        initialState={current.doc}
        formationId={current.id}
        editorApiRef={editorApiRef}
      >
        <Layout />
      </AppProvider>
    </FormationsContext.Provider>
  )
}

function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-6 text-center text-sm text-slate-600">
      {children}
    </div>
  )
}

export default function App() {
  // ?share=CODE で開かれたら、ログイン不要の読み取り専用ビューを表示する
  const shareCode = useMemo(
    () => new URLSearchParams(location.search).get('share'),
    [],
  )
  if (shareCode) return <ShareViewer code={shareCode} />
  return (
    <LoginGate>
      <EditorApp />
    </LoginGate>
  )
}
