import { Check, Copy, Link2, Share2 } from 'lucide-react'
import { useState } from 'react'
import { ApiError, createShare } from '@/lib/api'
import { useApp } from '@/store/ProjectContext'
import { Button, Modal } from './ui'

// 現在のドキュメントを読み取り専用スナップショットとして共有し、合言葉を発行するモーダル。
export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useApp()
  const [custom, setCustom] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const shareUrl = code
    ? `${location.origin}${location.pathname}?share=${encodeURIComponent(code)}`
    : ''

  async function create() {
    setBusy(true)
    setError(null)
    setCopied(false)
    try {
      const result = await createShare(state, custom.trim() || undefined)
      setCode(result)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('その合言葉は既に使われています。別の語にしてください。')
      } else if (err instanceof ApiError && err.status === 400) {
        setError('合言葉は3文字以上で、空白とコロン(:)は使えません。')
      } else {
        setError('共有の作成に失敗しました。時間をおいて再度お試しください。')
      }
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
    } catch {
      // クリップボード不可の環境では手動コピーに任せる
    }
  }

  // 閉じるときは次回に備えて結果をリセットする
  function handleClose() {
    setCode(null)
    setCustom('')
    setError(null)
    setCopied(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="フォーメーションを共有">
      {!code ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            現在の内容を<strong>読み取り専用</strong>でチームメイトに共有します。合言葉を入力するか、空欄のまま作成すると自動で割り当てます。
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              合言葉（任意）
            </label>
            <input
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="例: harukamatsuri2026"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button variant="primary" className="w-full" onClick={create} disabled={busy}>
            <Share2 size={16} /> {busy ? '作成中…' : '合言葉を作成'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            合言葉を作成しました。これをチームメイトに伝えてください。
          </p>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center">
            <div className="text-[10px] text-slate-400">合言葉</div>
            <div className="select-all text-xl font-bold tracking-wide text-slate-800">
              {code}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">共有URL</label>
            <div className="mt-1 flex gap-1">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-2 text-xs text-slate-600"
              />
              <Button onClick={copy} title="URLをコピー">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          </div>
          <p className="flex items-center gap-1 text-[11px] text-slate-400">
            <Link2 size={12} /> 受け取った人はログイン不要で閲覧・画像/PDF出力ができます（編集は不可）。
          </p>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setCode(null)
              setError(null)
              setCopied(false)
            }}
          >
            別の合言葉を作成
          </Button>
        </div>
      )}
    </Modal>
  )
}
