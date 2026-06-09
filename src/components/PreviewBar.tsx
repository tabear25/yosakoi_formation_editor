import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useApp } from '@/store/ProjectContext'
import { Button } from './ui'

// ⑦ 動きプレビュー：全シーンを1本のスライダーで手動スクラブする操作バー。
// previewT が null のときは何も表示しない（プレビュー無効）。
export function PreviewBar() {
  const { state, previewT, setPreviewT } = useApp()
  if (previewT === null) return null

  const scenes = state.scenes
  const last = Math.max(0, scenes.length - 1)
  const t = Math.min(Math.max(previewT, 0), last)
  let i = Math.floor(t)
  if (i > last) i = last
  const f = t - i
  const sceneA = scenes[i]
  const sceneB = scenes[i + 1]
  const pct = Math.round(f * 100)

  // 表示中の状況テキスト
  const readout =
    !sceneB || f === 0
      ? `場面 ${i + 1}「${sceneA?.name ?? ''}」`
      : `「${sceneA.name}」→「${sceneB.name}」（${pct}%）`

  return (
    <div className="border-t border-slate-200 bg-white px-3 py-2">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-semibold text-indigo-600">動きプレビュー</span>
        <span className="min-w-0 truncate text-xs text-slate-600">{readout}</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto shrink-0"
          onClick={() => setPreviewT(null)}
        >
          <X size={14} /> 閉じる
        </Button>
      </div>

      <input
        type="range"
        min={0}
        max={last}
        step={0.01}
        value={t}
        onChange={(e) => setPreviewT(parseFloat(e.target.value))}
        className="w-full accent-indigo-600"
        aria-label="動きプレビューのスクラブ"
      />

      {/* 各場面へジャンプ（最寄りの場面を強調） */}
      <div className="mt-1 flex gap-1 overflow-x-auto pb-0.5">
        {scenes.map((s, idx) => {
          const nearest = Math.round(t) === idx
          return (
            <button
              key={s.id}
              onClick={() => setPreviewT(idx)}
              className={cn(
                'shrink-0 rounded px-2 py-0.5 text-[11px] transition-colors',
                nearest
                  ? 'bg-indigo-100 font-medium text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-100',
              )}
              title={s.name}
            >
              {idx + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
