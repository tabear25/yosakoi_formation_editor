import {
  Circle,
  LayoutGrid,
  Magnet,
  MousePointer2,
  MoveHorizontal,
  MoveVertical,
  Settings2,
  Triangle,
  XCircle,
} from 'lucide-react'
import type { AlignKind } from '@/types'
import { useApp } from '@/store/ProjectContext'
import { Button } from './ui'

export function Toolbar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const {
    dispatch,
    selectedIds,
    setSelectedIds,
    selectionMode,
    setSelectionMode,
    snapEnabled,
    setSnapEnabled,
  } = useApp()

  const count = selectedIds.length
  const canAlign = count >= 2

  function align(kind: AlignKind) {
    dispatch({ type: 'ALIGN', kind, ids: selectedIds })
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-t border-slate-200 bg-white px-2 py-1.5">
      <Button
        size="sm"
        active={snapEnabled}
        onClick={() => setSnapEnabled(!snapEnabled)}
        title="グリッドに吸着して配置"
      >
        <Magnet size={14} /> グリッド吸着
      </Button>

      <span className="mx-0.5 h-6 w-px shrink-0 bg-slate-200" />

      <Button
        size="sm"
        active={selectionMode}
        onClick={() => setSelectionMode(!selectionMode)}
        title="マーカーをタップして整列対象を選ぶ"
      >
        <MousePointer2 size={14} /> 選択{count > 0 ? `（${count}）` : ''}
      </Button>

      <Button size="sm" disabled={!canAlign} onClick={() => align('row')} title="横一列に整列">
        <MoveHorizontal size={14} /> 横
      </Button>
      <Button size="sm" disabled={!canAlign} onClick={() => align('column')} title="縦一列に整列">
        <MoveVertical size={14} /> 縦
      </Button>
      <Button size="sm" disabled={!canAlign} onClick={() => align('circle')} title="円形に整列">
        <Circle size={14} /> 円
      </Button>
      <Button size="sm" disabled={!canAlign} onClick={() => align('grid')} title="格子状に整列">
        <LayoutGrid size={14} /> 格子
      </Button>
      <Button
        size="sm"
        disabled={!canAlign}
        onClick={() => align('triangle')}
        title="客席正面を頂点に三角形（ピラミッド）に整列"
      >
        <Triangle size={14} /> 三角
      </Button>

      {count > 0 && (
        <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} title="選択を解除">
          <XCircle size={14} /> 解除
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        className="ml-auto shrink-0"
        onClick={onOpenSettings}
        title="ステージの種別・寸法を設定"
      >
        <Settings2 size={14} /> ステージ設定
      </Button>
    </div>
  )
}
