import { ChevronLeft, ChevronRight, Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useApp } from '@/store/ProjectContext'
import { Button } from './ui'

export function SceneList() {
  const { state, dispatch } = useApp()
  const [editingId, setEditingId] = useState<string | null>(null)
  const onlyOne = state.scenes.length <= 1

  return (
    <div className="flex items-stretch gap-2 border-t border-slate-200 bg-white p-2">
      <div className="flex shrink-0 flex-col gap-1">
        <Button size="sm" onClick={() => dispatch({ type: 'ADD_SCENE' })}>
          <Plus size={14} /> 場面
        </Button>
        <Button size="sm" onClick={() => dispatch({ type: 'DUPLICATE_SCENE' })}>
          <Copy size={14} /> 複製
        </Button>
      </div>

      <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
        {state.scenes.map((scene, index) => {
          const isCurrent = scene.id === state.currentSceneId
          return (
            <div
              key={scene.id}
              className={cn(
                'flex w-40 shrink-0 flex-col rounded-lg border p-2 transition-colors',
                isCurrent
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              <button
                className="block min-w-0 text-left"
                onClick={() => dispatch({ type: 'SELECT_SCENE', id: scene.id })}
              >
                <div className="text-[10px] text-slate-400">場面 {index + 1}</div>
                {editingId === scene.id ? (
                  <input
                    autoFocus
                    className="mt-0.5 h-7 w-full rounded border border-indigo-300 px-1 text-sm focus:outline-none"
                    defaultValue={scene.name}
                    onBlur={(e) => {
                      dispatch({
                        type: 'RENAME_SCENE',
                        id: scene.id,
                        name: e.target.value.trim() || scene.name,
                      })
                      setEditingId(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                ) : (
                  <div className="mt-0.5 truncate text-sm font-medium text-slate-800">
                    {scene.name}
                  </div>
                )}
              </button>

              <div className="mt-1.5 flex items-center gap-0.5">
                <IconBtn
                  label="名前を変更"
                  onClick={() => setEditingId(scene.id)}
                >
                  <Pencil size={14} />
                </IconBtn>
                <IconBtn
                  label="左へ移動"
                  disabled={index === 0}
                  onClick={() => dispatch({ type: 'MOVE_SCENE', id: scene.id, dir: -1 })}
                >
                  <ChevronLeft size={16} />
                </IconBtn>
                <IconBtn
                  label="右へ移動"
                  disabled={index === state.scenes.length - 1}
                  onClick={() => dispatch({ type: 'MOVE_SCENE', id: scene.id, dir: 1 })}
                >
                  <ChevronRight size={16} />
                </IconBtn>
                <IconBtn
                  label="この場面を複製"
                  onClick={() => {
                    dispatch({ type: 'SELECT_SCENE', id: scene.id })
                    dispatch({ type: 'DUPLICATE_SCENE' })
                  }}
                >
                  <Copy size={14} />
                </IconBtn>
                <IconBtn
                  label="この場面を削除"
                  disabled={onlyOne}
                  danger
                  onClick={() => dispatch({ type: 'REMOVE_SCENE', id: scene.id })}
                >
                  <Trash2 size={14} />
                </IconBtn>
              </div>
            </div>
          )
        })}
      </div>
    </div>
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
        'rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent',
        danger && 'hover:bg-red-50 hover:text-red-500',
      )}
    >
      {children}
    </button>
  )
}
