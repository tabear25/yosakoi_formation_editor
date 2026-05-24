import type { StageKind } from '@/types'
import { useApp } from '@/store/ProjectContext'
import { Button } from './ui'

const inputCls =
  'h-9 w-full rounded-md border border-slate-300 px-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400'

export function StageSettings() {
  const { state, dispatch } = useApp()
  const { stage } = state

  function setKind(kind: StageKind) {
    dispatch({ type: 'SET_STAGE', patch: { kind } })
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-600">演舞エリアの種別</span>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            active={stage.kind === 'stage'}
            onClick={() => setKind('stage')}
          >
            長方形ステージ
          </Button>
          <Button
            className="flex-1"
            active={stage.kind === 'parade'}
            onClick={() => setKind('parade')}
          >
            流し（パレード）
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="横幅（m）"
          value={stage.widthM}
          min={1}
          step={0.5}
          onChange={(widthM) => dispatch({ type: 'SET_STAGE', patch: { widthM } })}
        />
        <NumberField
          label={stage.kind === 'parade' ? '進行方向の長さ（m）' : '奥行（客席方向, m）'}
          value={stage.depthM}
          min={1}
          step={0.5}
          onChange={(depthM) => dispatch({ type: 'SET_STAGE', patch: { depthM } })}
        />
      </div>

      <NumberField
        label="グリッド間隔（m）"
        value={stage.gridM}
        min={0.5}
        step={0.5}
        hint="グリッド吸着や目安の格子線の間隔です。"
        onChange={(gridM) => dispatch({ type: 'SET_STAGE', patch: { gridM } })}
      />

      <p className="text-[11px] leading-relaxed text-slate-400">
        寸法を変えても踊り子の相対的な配置（割合）は保たれます。縦横比はこの寸法から自動計算されます。
      </p>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  step,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  step: number
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type="number"
        className={inputCls}
        value={value}
        min={min}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (!Number.isNaN(v)) onChange(Math.max(min, v))
        }}
      />
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  )
}
