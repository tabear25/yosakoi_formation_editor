// CSV による名簿（踊り子＋グループ振り分け）の取り込み／書き出しユーティリティ。
//
// 取り込みCSVは「名前, グループ名」の2列を基本とする。
//   - 1列目: 踊り子の名前（必須。空の行はスキップ）
//   - 2列目: 所属グループ名（任意。空ならグループ「未分類」に振り分ける）
// 先頭行がヘッダー（"名前"/"グループ" 等）なら自動的に読み飛ばす。
// ここはドメイン状態に依存しない純関数のみを置き、状態へのマージは reducer 側が担う。

export type RosterRow = {
  name: string
  group: string
}

export type RosterParseResult = {
  rows: RosterRow[] // 取り込み対象（名前が空でない行）
  dataLines: number // ヘッダー・完全な空行を除いたデータ行数
  skipped: number // 名前が空でスキップした行数
  hadHeader: boolean // 先頭行をヘッダーとして読み飛ばしたか
}

// グループ名が空の踊り子をまとめる既定グループ名。reducer / UI と共有する。
export const DEFAULT_GROUP_NAME = '未分類'

// ヘッダー行の判定に使う列名（小文字化して比較）。
const HEADER_NAME_KEYS = ['name', '名前', 'なまえ', '氏名', 'メンバー', '踊り子']
const HEADER_GROUP_KEYS = ['group', 'グループ', 'ぐるーぷ', '班', '組', 'チーム', 'パート']

// RFC4180 風の最小CSVパーサ。
// ダブルクォートで囲まれたフィールド内のカンマ・改行・"" のエスケープに対応する。
function parseCsvRecords(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input // 先頭のBOMを除去
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"' // "" は1個の " として扱う
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\r') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += text[i + 1] === '\n' ? 2 : 1 // CRLF と CR の両対応
      continue
    }
    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    field += ch
    i += 1
  }

  // 末尾のフィールド・行を確定する
  row.push(field)
  rows.push(row)
  return rows
}

function looksLikeHeader(cells: string[]): boolean {
  const normalized = cells.map((c) => c.trim().toLowerCase())
  return (
    normalized.some((c) => HEADER_NAME_KEYS.includes(c)) ||
    normalized.some((c) => HEADER_GROUP_KEYS.includes(c))
  )
}

export function parseRosterCsv(text: string): RosterParseResult {
  const records = parseCsvRecords(text)

  let hadHeader = false
  let start = 0
  if (records.length > 0 && looksLikeHeader(records[0])) {
    hadHeader = true
    start = 1
  }

  const rows: RosterRow[] = []
  let dataLines = 0
  let skipped = 0

  for (let i = start; i < records.length; i++) {
    const cells = records[i]
    // 完全な空行（全セル空）は数えずにスキップする
    if (cells.every((c) => c.trim() === '')) continue
    dataLines += 1

    const name = (cells[0] ?? '').trim()
    const group = (cells[1] ?? '').trim()
    if (!name) {
      skipped += 1
      continue
    }
    rows.push({ name, group })
  }

  return { rows, dataLines, skipped, hadHeader }
}

// CSVセルとして安全な文字列にエスケープする（カンマ・引用符・改行を含む場合のみ引用符で囲む）。
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// 名前・グループの並びを CSV テキスト（ヘッダー付き・CRLF区切り）に整形する。
export function buildRosterCsv(rows: { name: string; group: string }[]): string {
  const header = '名前,グループ'
  const body = rows.map((r) => `${csvCell(r.name)},${csvCell(r.group)}`)
  return [header, ...body].join('\r\n') + '\r\n'
}

// 取り込み形式を伝えるための見本データ。
export const SAMPLE_ROSTER_ROWS: RosterRow[] = [
  { name: 'さくら', group: '赤組' },
  { name: 'れん', group: '赤組' },
  { name: 'みお', group: '青組' },
  { name: 'はると', group: '青組' },
  { name: 'ゆうと', group: '黄組' },
]
