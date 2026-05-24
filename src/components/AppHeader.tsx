import { FileDown, Image as ImageIcon, LogOut, Share2, Users } from 'lucide-react'
import type { SaveStatus } from '@/hooks/useAutoSave'
import { exportPdf, exportScenePng } from '@/lib/export'
import { clearToken } from '@/lib/session'
import { cn } from '@/lib/cn'
import { useApp } from '@/store/ProjectContext'
import { Button } from './ui'

export function AppHeader({
  onOpenRoster,
  onOpenShare,
}: {
  onOpenRoster: () => void
  onOpenShare: () => void
}) {
  const { state, currentScene, dispatch, saveStatus, dirty, saveNow } = useApp()

  async function handleLogout() {
    const saved = await saveNow() // 最後の変更を保存してからログアウト
    if (
      !saved &&
      !window.confirm(
        '保存に失敗しています。ログアウトすると未保存の変更が失われる可能性があります。ログアウトしますか？',
      )
    ) {
      return
    }
    clearToken()
    location.reload()
  }

  return (
    <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <input
        className="min-w-0 max-w-[34vw] flex-1 rounded-md px-1 text-base font-semibold text-slate-800 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        value={state.title}
        onChange={(e) => dispatch({ type: 'SET_TITLE', title: e.target.value })}
        aria-label="フォーメーション表のタイトル"
      />

      <SaveIndicator status={saveStatus} dirty={dirty} />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button variant="ghost" className="lg:hidden" onClick={onOpenRoster} title="名簿を開く">
          <Users size={16} /> <span className="hidden sm:inline">名簿</span>
        </Button>
        <Button onClick={onOpenShare} title="合言葉で共有">
          <Share2 size={16} /> <span className="hidden sm:inline">共有</span>
        </Button>
        <Button onClick={() => exportScenePng(state, currentScene)} title="表示中の場面を画像で保存">
          <ImageIcon size={16} /> <span className="hidden sm:inline">画像</span>
        </Button>
        <Button variant="primary" onClick={() => exportPdf(state)} title="全場面をPDFで保存">
          <FileDown size={16} /> PDF
        </Button>
        <Button variant="ghost" onClick={handleLogout} title="ログアウト">
          <LogOut size={16} />
        </Button>
      </div>
    </header>
  )
}

// 自動保存の状態をヘッダーに小さく表示する
function SaveIndicator({ status, dirty }: { status: SaveStatus; dirty: boolean }) {
  let label = ''
  let color = 'text-slate-400'
  if (status === 'saving') {
    label = '保存中…'
  } else if (status === 'error') {
    label = '保存エラー'
    color = 'text-red-500'
  } else if (dirty) {
    label = '未保存'
    color = 'text-amber-500'
  } else if (status === 'saved') {
    label = '保存済み'
    color = 'text-emerald-600'
  }
  if (!label) return null
  // モバイルでも保存状態が見えるよう常時表示（色付きの短いラベル）
  return (
    <span className={cn('shrink-0 whitespace-nowrap text-xs', color)} aria-live="polite">
      {label}
    </span>
  )
}
