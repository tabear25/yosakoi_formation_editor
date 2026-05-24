// グループ（パート/隊）の色パレットと文字色の判定

export const GROUP_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#0ea5e9', // sky
  '#64748b', // slate
] as const

export function colorForIndex(index: number): string {
  return GROUP_COLORS[index % GROUP_COLORS.length]
}

// 背景色に対して読みやすい文字色（濃灰 or 白）を返す
export function readableTextColor(hex: string): string {
  const c = hex.replace('#', '')
  if (c.length < 6) return '#1f2937'
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1f2937' : '#ffffff'
}
