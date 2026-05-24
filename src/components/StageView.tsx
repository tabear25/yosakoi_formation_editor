import { forwardRef, useMemo } from 'react'
import type { Dancer, Group, Scene, StageConfig } from '@/types'
import { gridSteps } from '@/lib/geometry'
import { readableTextColor } from '@/lib/palette'
import { cn } from '@/lib/cn'

type Props = {
  stage: StageConfig
  scene: Scene
  dancers: Dancer[]
  groups: Group[]
  width: number
  height: number
  selectedIds?: string[]
  markerSize?: number
}

// ステージ矩形（枠・グリッド・踊り子マーカー）の描画。
// 座標変換のため、外側の ref はこの矩形 div に割り当てる。
export const StageView = forwardRef<HTMLDivElement, Props>(function StageView(
  { stage, scene, dancers, groups, width, height, selectedIds = [], markerSize = 22 },
  ref,
) {
  const colorOf = useMemo(() => {
    const map = new Map(groups.map((g) => [g.id, g.color]))
    return (groupId: string) => map.get(groupId) ?? '#64748b'
  }, [groups])

  const { sx, sy } = gridSteps(stage)
  const vLines: number[] = []
  for (let x = sx; x < 0.999; x += sx) vLines.push(x * 100)
  const hLines: number[] = []
  for (let y = sy; y < 0.999; y += sy) hLines.push(y * 100)

  const selected = new Set(selectedIds)

  return (
    <div
      ref={ref}
      className="relative border-2 border-slate-400 bg-white"
      style={{ width, height }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {vLines.map((x) => (
          <line
            key={`v${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={100}
            stroke="#e2e8f0"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {hLines.map((y) => (
          <line
            key={`h${y}`}
            x1={0}
            y1={y}
            x2={100}
            y2={y}
            stroke="#e2e8f0"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {dancers.map((d) => {
        const pos = scene.positions[d.id]
        if (!pos) return null
        const color = colorOf(d.groupId)
        const isSel = selected.has(d.id)
        return (
          <div
            key={d.id}
            data-dancer-id={d.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center"
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
          >
            <div
              className={cn(
                'rounded-full border-2 border-white shadow',
                isSel && 'ring-2 ring-indigo-600 ring-offset-1',
              )}
              style={{ width: markerSize, height: markerSize, background: color }}
            />
            <div
              className="mt-0.5 max-w-[72px] truncate rounded bg-white/85 px-1 text-[10px] leading-tight text-slate-700"
              style={{ color: '#334155' }}
            >
              {d.name}
            </div>
          </div>
        )
      })}
    </div>
  )
})

// マーカー単体の凡例用ドット（名簿などで使用）
export function GroupDot({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full border border-white shadow-sm"
      style={{ width: size, height: size, background: color, color: readableTextColor(color) }}
    />
  )
}
