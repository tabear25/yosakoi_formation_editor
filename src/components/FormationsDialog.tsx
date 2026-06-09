import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useFormations } from '@/store/FormationsContext'
import { useApp } from '@/store/ProjectContext'
import { Button, Modal } from './ui'

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

// 複数フォーメーションの一覧・切替・新規・複製・改名・削除を行うモーダル。
export function FormationsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, currentId, busy, error, refresh, switchTo, createNew, duplicate, rename, remove } =
    useFormations()
  // 現在開いているフォーメーションは、編集中（未保存）のタイトルを一覧にも反映する
  const { state } = useApp()
  const [editingId, setEditingId] = useState<string | null>(null)
  const onlyOne = items.length <= 1

  // 開いたタイミングで一覧を最新化（ヘッダー改名や他端末の更新を反映）
  useEffect(() => {
    if (open) refresh()
    // refresh は安定ではないため open のみに依存させる
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function titleOf(id: string, fallback: string): string {
    return id === currentId ? state.title || fallback : fallback
  }

  return (
    <Modal open={open} onClose={onClose} title="フォーメーション">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            保存中のフォーメーション（{items.length}）。タイトルをタップで切り替えます。
          </p>
          <Button size="sm" variant="primary" disabled={busy} onClick={createNew}>
            <Plus size={14} /> 新規
          </Button>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <ul className="max-h-[55vh] space-y-1.5 overflow-y-auto">
          {items.map((m) => {
            const isCurrent = m.id === currentId
            return (
              <li
                key={m.id}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border p-2',
                  isCurrent ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white',
                )}
              >
                <div className="min-w-0 flex-1">
                  {editingId === m.id ? (
                    <input
                      autoFocus
                      defaultValue={titleOf(m.id, m.title)}
                      className="h-8 w-full rounded border border-indigo-300 px-1.5 text-sm focus:outline-none"
                      onBlur={(e) => {
                        rename(m.id, e.target.value)
                        setEditingId(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                  ) : (
                    <button
                      className="block w-full min-w-0 text-left disabled:opacity-60"
                      disabled={busy || isCurrent}
                      onClick={() => switchTo(m.id)}
                      title={isCurrent ? '表示中' : 'このフォーメーションを開く'}
                    >
                      <div className="truncate text-sm font-medium text-slate-800">
                        {titleOf(m.id, m.title)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isCurrent ? '表示中 ・ ' : ''}
                        更新 {formatDate(m.updatedAt)}
                      </div>
                    </button>
                  )}
                </div>

                <IconBtn label="名前を変更" disabled={busy} onClick={() => setEditingId(m.id)}>
                  <Pencil size={14} />
                </IconBtn>
                <IconBtn label="複製" disabled={busy} onClick={() => duplicate(m.id)}>
                  <Copy size={14} />
                </IconBtn>
                <IconBtn
                  label="削除"
                  danger
                  disabled={busy || onlyOne}
                  onClick={() => {
                    if (
                      window.confirm(
                        `「${titleOf(m.id, m.title)}」を削除しますか？元に戻せません。`,
                      )
                    ) {
                      remove(m.id)
                    }
                  }}
                >
                  <Trash2 size={14} />
                </IconBtn>
              </li>
            )
          })}
        </ul>

        <p className="text-[11px] leading-relaxed text-slate-400">
          切り替え・複製の前に、編集中の内容は自動で保存されます。
        </p>
      </div>
    </Modal>
  )
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent',
        danger && 'hover:bg-red-50 hover:text-red-500',
      )}
    >
      {children}
    </button>
  )
}
