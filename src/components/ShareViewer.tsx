import { FileDown, Image as ImageIcon, Lock } from 'lucide-react'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Dancer, DocState, Group, Scene, StageConfig } from '@/types'
import { getShare } from '@/lib/api'
import { exportPdf, exportScenePng } from '@/lib/export'
import { aspectOf } from '@/lib/geometry'
import { cn } from '@/lib/cn'
import { StageView } from './StageView'
import { Button } from './ui'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'error' }
  | { kind: 'ready'; doc: DocState }

// ?share=CODE で開かれる読み取り専用ビュー。ログイン不要。
// 閲覧と画像/PDF 出力のみ可能で、編集はできない。
export function ShareViewer({ code }: { code: string }) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [sceneIndex, setSceneIndex] = useState(0)

  useEffect(() => {
    let active = true
    getShare(code)
      .then((doc) => {
        if (!active) return
        setLoad(doc ? { kind: 'ready', doc } : { kind: 'notfound' })
      })
      .catch(() => {
        if (active) setLoad({ kind: 'error' })
      })
    return () => {
      active = false
    }
  }, [code])

  if (load.kind === 'loading') return <Centered>読み込み中…</Centered>
  if (load.kind === 'notfound')
    return (
      <Centered>
        合言葉「{code}」のフォーメーションが見つかりませんでした。
        <HomeLink />
      </Centered>
    )
  if (load.kind === 'error')
    return (
      <Centered>
        読み込みに失敗しました。時間をおいて再度お試しください。
        <HomeLink />
      </Centered>
    )

  const doc = load.doc
  const scene = doc.scenes[Math.min(sceneIndex, doc.scenes.length - 1)] ?? doc.scenes[0]

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-slate-800">
            {doc.title}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Lock size={11} /> 読み取り専用の共有ビュー
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button onClick={() => exportScenePng(doc, scene)} title="表示中の場面を画像で保存">
            <ImageIcon size={16} /> <span className="hidden sm:inline">画像</span>
          </Button>
          <Button variant="primary" onClick={() => exportPdf(doc)} title="全場面をPDFで保存">
            <FileDown size={16} /> PDF
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <StageBox
          stage={doc.stage}
          scene={scene}
          dancers={doc.dancers}
          groups={doc.groups}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto border-t border-slate-200 bg-white p-2">
        {doc.scenes.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setSceneIndex(i)}
            className={cn(
              'shrink-0 rounded-lg border px-3 py-2 text-left',
              i === sceneIndex
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
          >
            <div className="text-[10px] text-slate-400">場面 {i + 1}</div>
            <div className="max-w-[140px] truncate text-sm font-medium">{s.name}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// コンテナ幅を採寸し、ステージの縦横比に合わせて StageView を表示する
function StageBox({
  stage,
  scene,
  dancers,
  groups,
}: {
  stage: StageConfig
  scene: Scene
  dancers: Dancer[]
  groups: Group[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const aspect = aspectOf(stage)
  const stageWidth = Math.max(0, width)
  const stageHeight = stageWidth > 0 ? Math.round(stageWidth / aspect) : 0
  const topLabel = stage.kind === 'stage' ? '客席（正面）' : '↑ 進行方向'

  return (
    <div ref={ref} className="mx-auto w-full max-w-3xl">
      {stageWidth > 0 && (
        <div className="mx-auto" style={{ width: stageWidth }}>
          <div className="mb-1 text-center text-xs text-slate-500">{topLabel}</div>
          <StageView
            stage={stage}
            scene={scene}
            dancers={dancers}
            groups={groups}
            width={stageWidth}
            height={stageHeight}
          />
          <div className="mt-1 text-center text-sm font-medium text-slate-700">
            {scene.name}
          </div>
        </div>
      )}
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center text-sm text-slate-600">
      {children}
    </div>
  )
}

function HomeLink() {
  return (
    <a href={location.pathname} className="text-indigo-600 underline">
      エディタを開く
    </a>
  )
}
