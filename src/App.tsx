import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppHeader } from './components/AppHeader'
import { LoginGate } from './components/LoginGate'
import { RosterPanel } from './components/RosterPanel'
import { SceneList } from './components/SceneList'
import { SaveErrorBanner } from './components/SaveErrorBanner'
import { ShareDialog } from './components/ShareDialog'
import { ShareViewer } from './components/ShareViewer'
import { StageCanvas } from './components/StageCanvas'
import { StageSettings } from './components/StageSettings'
import { Toolbar } from './components/Toolbar'
import { Drawer, Modal } from './components/ui'
import { loadDoc } from './lib/api'
import { AppProvider, useApp } from './store/ProjectContext'
import { createInitialState } from './store/projectReducer'
import type { DocState } from './types'

function Layout() {
  const { dirty } = useApp()
  const [rosterOpen, setRosterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

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

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <AppHeader
        onOpenRoster={() => setRosterOpen(true)}
        onOpenShare={() => setShareOpen(true)}
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
    </div>
  )
}

// ログイン後、保存済みドキュメントを読み込んでからエディタを起動する
function EditorApp() {
  const [initialState, setInitialState] = useState<DocState | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    loadDoc()
      .then((doc) => {
        if (active) setInitialState(doc ?? createInitialState())
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [])

  if (failed) {
    return (
      <FullScreenMessage>
        データの読み込みに失敗しました。ページを再読み込みしてください。
      </FullScreenMessage>
    )
  }
  if (!initialState) {
    return <FullScreenMessage>読み込み中…</FullScreenMessage>
  }
  return (
    <AppProvider initialState={initialState}>
      <Layout />
    </AppProvider>
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
