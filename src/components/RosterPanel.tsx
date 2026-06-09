import { Eye, EyeOff, Plus, Trash2, Upload, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isPresent } from '@/lib/scene'
import { useApp } from '@/store/ProjectContext'
import { cn } from '@/lib/cn'
import { ImportRosterDialog } from './ImportRosterDialog'
import { Button } from './ui'

const inputCls =
  'h-8 w-full rounded-md border border-slate-300 px-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400'

export function RosterPanel() {
  const { state, dispatch, currentScene } = useApp()
  const [newName, setNewName] = useState('')
  const [newGroupId, setNewGroupId] = useState(state.groups[0]?.id ?? '')
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    if (!state.groups.some((g) => g.id === newGroupId)) {
      setNewGroupId(state.groups[0]?.id ?? '')
    }
  }, [state.groups, newGroupId])

  function addDancer() {
    const name = newName.trim()
    if (!name || !newGroupId) return
    dispatch({ type: 'ADD_DANCER', name, groupId: newGroupId })
    setNewName('')
  }

  return (
    <div className="space-y-5 p-3">
      {/* CSV取り込み */}
      <section>
        <Button
          variant="default"
          className="w-full"
          onClick={() => setImportOpen(true)}
        >
          <Upload size={16} /> CSVで名簿を取り込み
        </Button>
      </section>

      {/* グループ */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            グループ（{state.groups.length}）
          </h3>
          <Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'ADD_GROUP' })}>
            <Plus size={14} /> 追加
          </Button>
        </div>
        <ul className="space-y-1.5">
          {state.groups.map((g) => (
            <li key={g.id} className="flex items-center gap-2">
              <input
                type="color"
                value={g.color}
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_GROUP', id: g.id, patch: { color: e.target.value } })
                }
                className="h-7 w-8 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                aria-label="グループの色"
              />
              <input
                className={inputCls}
                value={g.name}
                onChange={(e) =>
                  dispatch({ type: 'UPDATE_GROUP', id: g.id, patch: { name: e.target.value } })
                }
              />
              <button
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:hover:bg-transparent"
                onClick={() => dispatch({ type: 'REMOVE_GROUP', id: g.id })}
                disabled={state.groups.length <= 1}
                aria-label="グループを削除"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* 踊り子の追加 */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          踊り子を追加
        </h3>
        <div className="space-y-2">
          <input
            className={inputCls}
            placeholder="名前を入力"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDancer()}
          />
          <div className="flex gap-2">
            <select
              className={inputCls}
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
            >
              {state.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <Button variant="primary" onClick={addDancer} disabled={!newName.trim()}>
              <UserPlus size={16} /> 追加
            </Button>
          </div>
        </div>
      </section>

      {/* 踊り子一覧 */}
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          踊り子（{state.dancers.length}）
        </h3>
        <p className="mb-2 text-[11px] leading-snug text-slate-400">
          目のアイコンで「{currentScene.name}」への出演を切り替えます（場面ごとに設定）。
        </p>
        {state.dancers.length === 0 ? (
          <p className="text-sm text-slate-400">まだ踊り子がいません。</p>
        ) : (
          <ul className="space-y-1.5">
            {state.dancers.map((d) => {
              const present = isPresent(currentScene, d.id)
              return (
                <li
                  key={d.id}
                  className={cn('flex items-center gap-2', !present && 'opacity-50')}
                >
                  <input
                    className={inputCls}
                    value={d.name}
                    onChange={(e) =>
                      dispatch({ type: 'UPDATE_DANCER', id: d.id, patch: { name: e.target.value } })
                    }
                  />
                  <select
                    className="h-8 shrink-0 rounded-md border border-slate-300 px-1 text-sm focus:border-indigo-400 focus:outline-none"
                    value={d.groupId}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_DANCER',
                        id: d.id,
                        patch: { groupId: e.target.value },
                      })
                    }
                  >
                    {state.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className={cn(
                      'shrink-0 rounded p-1 hover:bg-slate-100',
                      present ? 'text-slate-500' : 'text-slate-300',
                    )}
                    onClick={() =>
                      dispatch({ type: 'SET_PRESENCE', id: d.id, present: !present })
                    }
                    aria-label={present ? 'この場面で非表示にする' : 'この場面に出演させる'}
                    title={present ? 'この場面で非表示にする' : 'この場面に出演させる'}
                  >
                    {present ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    onClick={() => dispatch({ type: 'REMOVE_DANCER', id: d.id })}
                    aria-label="踊り子を削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ImportRosterDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
