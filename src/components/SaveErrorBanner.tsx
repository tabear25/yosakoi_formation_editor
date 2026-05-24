import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '@/store/ProjectContext'
import { Button } from './ui'

// 保存に失敗しているときだけ、ヘッダー直下に目立つ警告を出す。
// 「作ったのに保存されていなかった」を見逃さないための安全策。
export function SaveErrorBanner() {
  const { saveStatus, saveNow } = useApp()
  const [retrying, setRetrying] = useState(false)

  if (saveStatus !== 'error') return null

  async function retry() {
    setRetrying(true)
    try {
      await saveNow()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertTriangle size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">
        保存に失敗しました。変更はまだ保存されていません（通信状況の確認、または再ログインが必要な場合があります）。
      </span>
      <Button size="sm" variant="danger" className="shrink-0" onClick={retry} disabled={retrying}>
        <RefreshCw size={14} /> {retrying ? '再試行中…' : '再試行'}
      </Button>
    </div>
  )
}
