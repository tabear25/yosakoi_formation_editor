import { FileDown, Image as ImageIcon, Users } from 'lucide-react'
import { exportPdf, exportScenePng } from '@/lib/export'
import { useApp } from '@/store/ProjectContext'
import { Button } from './ui'

export function AppHeader({ onOpenRoster }: { onOpenRoster: () => void }) {
  const { state, currentScene, dispatch } = useApp()

  return (
    <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <input
        className="min-w-0 max-w-[40vw] flex-1 rounded-md px-1 text-base font-semibold text-slate-800 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        value={state.title}
        onChange={(e) => dispatch({ type: 'SET_TITLE', title: e.target.value })}
        aria-label="フォーメーション表のタイトル"
      />

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" className="lg:hidden" onClick={onOpenRoster} title="名簿を開く">
          <Users size={16} /> 名簿
        </Button>
        <Button onClick={() => exportScenePng(state, currentScene)} title="表示中の場面を画像で保存">
          <ImageIcon size={16} /> <span className="hidden sm:inline">画像</span>
        </Button>
        <Button variant="primary" onClick={() => exportPdf(state)} title="全場面をPDFで保存">
          <FileDown size={16} /> PDF
        </Button>
      </div>
    </header>
  )
}
