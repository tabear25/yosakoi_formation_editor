import { useEffect, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { RosterPanel } from './components/RosterPanel'
import { SceneList } from './components/SceneList'
import { StageCanvas } from './components/StageCanvas'
import { StageSettings } from './components/StageSettings'
import { Toolbar } from './components/Toolbar'
import { Drawer, Modal } from './components/ui'
import { AppProvider, useApp } from './store/ProjectContext'

function Layout() {
  const { edited } = useApp()
  const [rosterOpen, setRosterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 永続化しないため、編集後の離脱時にブラウザ標準の確認を出す安全策
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!edited) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [edited])

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <AppHeader onOpenRoster={() => setRosterOpen(true)} />

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
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  )
}
