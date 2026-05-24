import { jsPDF } from 'jspdf'
import type { DocState, Scene } from '@/types'
import { aspectOf, gridSteps } from './geometry'

const EXPORT_WIDTH = 1600

// 1シーンを <canvas> に描画する。日本語ラベルもここでラスタライズされるため、
// 生成画像をそのまま PNG / PDF に使える（jsPDF の欧文フォント制約を回避できる）。
function drawSceneToCanvas(state: DocState, scene: Scene): HTMLCanvasElement {
  const aspect = aspectOf(state.stage)
  const marginX = Math.round(EXPORT_WIDTH * 0.07)
  const marginTop = Math.round(EXPORT_WIDTH * 0.11) // タイトル・場面名・客席ラベル用
  const marginBottom = Math.round(EXPORT_WIDTH * 0.05)
  const stageW = EXPORT_WIDTH - marginX * 2
  const stageH = Math.round(stageW / aspect)

  const canvas = document.createElement('canvas')
  canvas.width = EXPORT_WIDTH
  canvas.height = stageH + marginTop + marginBottom
  const ctx = canvas.getContext('2d')!
  const ox = marginX
  const oy = marginTop

  // 背景
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // タイトル・場面名（上余白）
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#94a3b8'
  ctx.font = `${Math.round(EXPORT_WIDTH * 0.013)}px sans-serif`
  ctx.fillText(state.title, ox, Math.round(marginTop * 0.1))
  ctx.textAlign = 'center'
  ctx.fillStyle = '#1f2937'
  ctx.font = `bold ${Math.round(EXPORT_WIDTH * 0.022)}px sans-serif`
  ctx.fillText(scene.name, EXPORT_WIDTH / 2, Math.round(marginTop * 0.34))

  // グリッド
  const { sx, sy } = gridSteps(state.stage)
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  for (let gx = sx; gx < 0.999; gx += sx) {
    const x = ox + gx * stageW
    drawLine(ctx, x, oy, x, oy + stageH)
  }
  for (let gy = sy; gy < 0.999; gy += sy) {
    const y = oy + gy * stageH
    drawLine(ctx, ox, y, ox + stageW, y)
  }

  // ステージ枠
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 3
  ctx.strokeRect(ox, oy, stageW, stageH)

  // 向きラベル
  ctx.fillStyle = '#64748b'
  ctx.font = `${Math.round(EXPORT_WIDTH * 0.017)}px sans-serif`
  ctx.textBaseline = 'middle'
  if (state.stage.kind === 'stage') {
    // 客席（正面）はステージ上辺の上に表示
    ctx.textAlign = 'center'
    ctx.fillText('客席（正面）', ox + stageW / 2, oy - Math.round(marginTop * 0.14))
  } else {
    ctx.save()
    ctx.translate(marginX * 0.5, oy + stageH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.fillText('↑ 進行方向', 0, 0)
    ctx.restore()
  }

  // 踊り子マーカー
  const colorOf = new Map(state.groups.map((g) => [g.id, g.color]))
  const r = Math.max(9, EXPORT_WIDTH * 0.009)
  const fontSize = Math.max(13, Math.round(EXPORT_WIDTH * 0.013))
  state.dancers.forEach((d) => {
    const pos = scene.positions[d.id]
    if (!pos) return
    const cx = ox + pos.x * stageW
    const cy = oy + pos.y * stageH
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = colorOf.get(d.groupId) ?? '#64748b'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    // 名前（白フチ付きで可読性を確保）
    ctx.font = `${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.strokeText(d.name, cx, cy + r + 2)
    ctx.fillStyle = '#334155'
    ctx.fillText(d.name, cx, cy + r + 2)
  })

  return canvas
}

function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'formation'
}

function triggerDownload(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// 表示中の1シーンを PNG で書き出す
export function exportScenePng(state: DocState, scene: Scene) {
  const canvas = drawSceneToCanvas(state, scene)
  triggerDownload(
    canvas.toDataURL('image/png'),
    `${sanitizeFilename(state.title)}_${sanitizeFilename(scene.name)}.png`,
  )
}

// 全シーンを1ページ1場面の PDF にまとめて書き出す
export function exportPdf(state: DocState) {
  const aspect = aspectOf(state.stage)
  const orientation: 'landscape' | 'portrait' = aspect >= 1 ? 'landscape' : 'portrait'
  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 28

  state.scenes.forEach((scene, i) => {
    if (i > 0) pdf.addPage('a4', orientation)
    const canvas = drawSceneToCanvas(state, scene)
    const imgData = canvas.toDataURL('image/png')
    const imgAspect = canvas.width / canvas.height
    const availW = pageW - margin * 2
    const availH = pageH - margin * 2
    let w = availW
    let h = w / imgAspect
    if (h > availH) {
      h = availH
      w = h * imgAspect
    }
    pdf.addImage(imgData, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h)
  })

  pdf.save(`${sanitizeFilename(state.title)}.pdf`)
}
