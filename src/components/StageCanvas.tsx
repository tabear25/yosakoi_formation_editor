import {
  AlertTriangle,
  ArrowUp,
  Maximize2,
  Redo2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { Scene, Vec } from '@/types'
import {
  aspectOf,
  clamp01,
  DEFAULT_MIN_SPACING_M,
  findCrowding,
  snapToGrid,
} from '@/lib/geometry'
import { interpolatePositions, isPresent, presentDancers } from '@/lib/scene'
import { useApp } from '@/store/ProjectContext'
import { StageView } from './StageView'

type Drag =
  | { kind: 'dancer'; id: string }
  | { kind: 'group'; anchorId: string; startPointer: Vec; base: Record<string, Vec> }
  | { kind: 'pan'; startX: number; startY: number; panX: number; panY: number }

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function useElementSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect
      setSize({ w: cr.width, h: cr.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

export function StageCanvas() {
  const {
    state,
    currentScene,
    dispatch,
    selectedIds,
    setSelectedIds,
    selectionMode,
    snapEnabled,
    previewT,
    beginTransaction,
    endTransaction,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useApp()

  const [viewportRef, size] = useElementSize()
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Vec>({ x: 0, y: 0 })

  const previewActive = previewT !== null
  const minSpacing = state.stage.minSpacingM ?? DEFAULT_MIN_SPACING_M

  // ③ 接近チェック（編集中の現在シーンの出演者のみ）。プレビュー中は出さない。
  const crowd = useMemo(() => {
    if (previewActive) return { ids: new Set<string>(), pairs: 0 }
    const items = presentDancers(currentScene, state.dancers)
      .map((d) => ({ id: d.id, pos: currentScene.positions[d.id] }))
      .filter((it): it is { id: string; pos: Vec } => !!it.pos)
    return findCrowding(items, state.stage, minSpacing)
  }, [previewActive, currentScene, state.dancers, state.stage, minSpacing])

  // ⑦ プレビュー中は補間した合成シーンを読み取り専用で描く
  const previewScene = useMemo<Scene | null>(() => {
    if (!previewActive) return null
    const items = interpolatePositions(state.scenes, state.dancers, previewT)
    const positions: Record<string, Vec> = {}
    for (const it of items) positions[it.id] = it.pos
    return { id: '__preview', name: '', positions }
  }, [previewActive, previewT, state.scenes, state.dancers])

  const sceneToRender = previewScene ?? currentScene

  const aspect = aspectOf(state.stage)
  const padX = 20
  const padTop = 44 // 客席ラベル用の余白（上）
  const padBottom = 20
  const availW = Math.max(0, size.w - padX * 2)
  const availH = Math.max(0, size.h - padTop - padBottom)
  let boxW = availW
  let boxH = boxW / aspect
  if (boxH > availH) {
    boxH = availH
    boxW = boxH * aspect
  }
  const ready = boxW > 10 && boxH > 10

  function clientToNorm(clientX: number, clientY: number): Vec {
    const r = stageRef.current!.getBoundingClientRect()
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function startPan(e: ReactPointerEvent) {
    dragRef.current = {
      kind: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
  }

  function onPointerDown(e: ReactPointerEvent) {
    viewportRef.current?.setPointerCapture(e.pointerId)
    // プレビュー中は編集不可（パン/ズームのみ許可）
    if (previewActive) {
      startPan(e)
      return
    }
    const markerEl = (e.target as HTMLElement).closest('[data-dancer-id]')
    if (markerEl) {
      const id = markerEl.getAttribute('data-dancer-id')!
      if (selectionMode) {
        toggleSelect(id)
        dragRef.current = null
      } else if (selectedIds.includes(id) && selectedIds.length > 1) {
        // 選択中のマーカーを掴んだら、選択した全員（出演者のみ）を一緒に動かす
        const base: Record<string, Vec> = {}
        for (const sid of selectedIds) {
          const p = currentScene.positions[sid]
          if (p && isPresent(currentScene, sid)) base[sid] = p
        }
        dragRef.current = {
          kind: 'group',
          anchorId: id,
          startPointer: clientToNorm(e.clientX, e.clientY),
          base,
        }
        beginTransaction()
      } else {
        dragRef.current = { kind: 'dancer', id }
        beginTransaction()
      }
    } else {
      startPan(e)
    }
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = dragRef.current
    if (!d) return
    if (d.kind === 'dancer') {
      const raw = clientToNorm(e.clientX, e.clientY)
      const pos = snapEnabled
        ? snapToGrid(raw, state.stage)
        : { x: clamp01(raw.x), y: clamp01(raw.y) }
      dispatch({ type: 'MOVE_DANCER', id: d.id, pos })
    } else if (d.kind === 'group') {
      const cur = clientToNorm(e.clientX, e.clientY)
      const xs = Object.values(d.base).map((p) => p.x)
      const ys = Object.values(d.base).map((p) => p.y)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      // 群れ全体が枠内に収まるよう移動量を制限（形は崩さない）
      let dx = clamp(cur.x - d.startPointer.x, -minX, 1 - maxX)
      let dy = clamp(cur.y - d.startPointer.y, -minY, 1 - maxY)
      const anchor = d.base[d.anchorId]
      if (snapEnabled && anchor) {
        const snapped = snapToGrid({ x: anchor.x + dx, y: anchor.y + dy }, state.stage)
        dx = clamp(snapped.x - anchor.x, -minX, 1 - maxX)
        dy = clamp(snapped.y - anchor.y, -minY, 1 - maxY)
      }
      const positions: Record<string, Vec> = {}
      for (const [sid, p] of Object.entries(d.base)) {
        positions[sid] = { x: p.x + dx, y: p.y + dy }
      }
      dispatch({ type: 'SET_POSITIONS', positions })
    } else {
      setPan({ x: d.panX + (e.clientX - d.startX), y: d.panY + (e.clientY - d.startY) })
    }
  }

  function onPointerUp(e: ReactPointerEvent) {
    // ドラッグ（踊り子/グループ）はここで1履歴ステップを確定する
    if (dragRef.current && dragRef.current.kind !== 'pan') endTransaction()
    dragRef.current = null
    try {
      viewportRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* capture が無い場合は無視 */
    }
  }

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full touch-none overflow-hidden bg-slate-100"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {ready && (
        <div
          className="absolute left-1/2 top-1/2 flex items-center justify-center"
          style={{
            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <div className="relative" style={{ width: boxW, height: boxH }}>
            <StageView
              ref={stageRef}
              stage={state.stage}
              scene={sceneToRender}
              dancers={state.dancers}
              groups={state.groups}
              width={boxW}
              height={boxH}
              selectedIds={previewActive ? [] : selectedIds}
              crowdedIds={previewActive ? undefined : crowd.ids}
            />
            {state.stage.kind === 'stage' ? (
              <div className="absolute inset-x-0 bottom-full mb-1 text-center text-xs font-medium text-slate-500">
                客席（正面）
              </div>
            ) : (
              <div className="absolute bottom-0 right-full top-0 mr-1 flex flex-col items-center justify-center text-xs font-medium text-slate-500">
                <ArrowUp size={16} />
                <span className="[writing-mode:vertical-rl]">進行方向</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ② アンドゥ/リダゥ（PC・タブレット・スマホ共通の常設ボタン）。プレビュー中は隠す。 */}
      {!previewActive && (
        <div
          className="absolute left-3 top-3 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="rounded p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
            onClick={undo}
            disabled={!canUndo}
            aria-label="元に戻す"
            title="元に戻す（Ctrl/⌘+Z）"
          >
            <Undo2 size={18} />
          </button>
          <button
            className="rounded p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
            onClick={redo}
            disabled={!canRedo}
            aria-label="やり直す"
            title="やり直す（Ctrl/⌘+Shift+Z）"
          >
            <Redo2 size={18} />
          </button>
        </div>
      )}

      {/* ③ 接近警告バッジ */}
      {!previewActive && crowd.pairs > 0 && (
        <div
          className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 shadow-sm"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <AlertTriangle size={13} /> 接近 {crowd.pairs} 組
        </div>
      )}

      {/* ズーム操作（ステージ外・拡大に追従しない） */}
      <div
        className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
          onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2)))}
          aria-label="縮小"
        >
          <ZoomOut size={16} />
        </button>
        <span className="w-10 text-center text-xs tabular-nums text-slate-500">
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
          onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}
          aria-label="拡大"
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
          onClick={resetView}
          aria-label="表示をリセット"
        >
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  )
}
