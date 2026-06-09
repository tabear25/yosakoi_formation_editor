import { AlertTriangle, FileDown, FileUp, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import {
  buildRosterCsv,
  DEFAULT_GROUP_NAME,
  parseRosterCsv,
  SAMPLE_ROSTER_ROWS,
  type RosterParseResult,
} from '@/lib/roster'
import { useApp } from '@/store/ProjectContext'
import { Button, Modal } from './ui'

const PREVIEW_LIMIT = 8

// CSV（名前・グループ）から名簿を取り込むモーダル。
// ファイル選択または貼り付けで読み込み、プレビューを確認してから取り込む。
export function ImportRosterDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { state, dispatch } = useApp()
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [mode, setMode] = useState<'replace' | 'append'>('replace')
  const fileRef = useRef<HTMLInputElement>(null)

  const result: RosterParseResult | null = useMemo(
    () => (text.trim() ? parseRosterCsv(text) : null),
    [text],
  )

  // 取り込み後に増えるグループ名の一覧（出現順・重複排除）
  const groupNames = useMemo(() => {
    if (!result) return [] as string[]
    const seen = new Set<string>()
    const names: string[] = []
    for (const r of result.rows) {
      const name = r.group.trim() || DEFAULT_GROUP_NAME
      if (!seen.has(name)) {
        seen.add(name)
        names.push(name)
      }
    }
    return names
  }, [result])

  function setContent(value: string, name: string | null) {
    setText(value)
    setFileName(name)
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setContent(content, file.name)
    // 同じファイルを選び直しても change が発火するようにリセット
    e.target.value = ''
  }

  function downloadTemplate() {
    // Excel での文字化けを避けるため UTF-8 BOM 付きで書き出す
    const csv = buildRosterCsv(SAMPLE_ROSTER_ROWS)
    const bom = String.fromCharCode(0xfeff)
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'roster_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleClose() {
    setText('')
    setFileName(null)
    setMode('replace')
    onClose()
  }

  function doImport() {
    if (!result || result.rows.length === 0) return
    dispatch({ type: 'IMPORT_ROSTER', rows: result.rows, mode })
    handleClose()
  }

  const willReplaceExisting = mode === 'replace' && state.dancers.length > 0

  return (
    <Modal open={open} onClose={handleClose} title="CSVで名簿を取り込み">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          <strong>名前</strong>と<strong>グループ</strong>の2列のCSVから、踊り子とグループの振り分けをまとめて読み込みます。先頭の見出し行（「名前,グループ」）は自動で読み飛ばします。
        </p>

        {/* 記入マニュアル（クリックで開閉） */}
        <details className="rounded-md border border-slate-200 bg-slate-50 text-sm">
          <summary className="cursor-pointer select-none px-3 py-2 font-medium text-slate-700">
            CSVの書き方（記入マニュアル）
          </summary>
          <div className="space-y-2 border-t border-slate-200 px-3 py-2.5 text-slate-600">
            <ol className="list-decimal space-y-1 pl-4 text-[13px] leading-relaxed">
              <li>
                1行に1人。<strong>1列目に名前</strong>、<strong>2列目にグループ</strong>
                （班・パートなど）を書きます。
              </li>
              <li>
                1行目の見出し「名前,グループ」は付けても付けなくてもOK（付いていれば自動で読み飛ばします）。
              </li>
              <li>
                同じグループ名の人は同じグループにまとまります。グループ欄が空の人は
                「<strong>{DEFAULT_GROUP_NAME}</strong>」にまとめられます。
              </li>
              <li>
                名前にカンマ（,）を含むときは <code>"山田, 太郎"</code> のように引用符で囲みます。
              </li>
              <li>
                文字コードは <strong>UTF-8</strong>。Excel では「
                <strong>CSV UTF-8（コンマ区切り）</strong>」で保存すると文字化けしません。
              </li>
              <li>
                取り込み方法は「<strong>入れ替え</strong>」（名簿を総入れ替え）か
                「<strong>追加</strong>」（今の名簿に追加）から選べます。
              </li>
              <li>下の「サンプルCSV」ボタンから雛形をダウンロードできます。</li>
            </ol>
            <div className="rounded border border-slate-200 bg-white p-2 font-mono text-[12px] leading-relaxed text-slate-600">
              名前,グループ
              <br />
              さくら,赤組
              <br />
              れん,赤組
              <br />
              みお,青組
            </div>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFileChange}
            className="hidden"
          />
          <Button variant="primary" onClick={() => fileRef.current?.click()}>
            <FileUp size={16} /> CSVファイルを選択
          </Button>
          <Button variant="ghost" onClick={downloadTemplate}>
            <FileDown size={16} /> サンプルCSV
          </Button>
          {fileName && (
            <span className="self-center text-xs text-slate-500">{fileName}</span>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600">
            またはCSVを貼り付け
          </label>
          <textarea
            value={text}
            onChange={(e) => setContent(e.target.value, fileName)}
            placeholder={'名前,グループ\nさくら,赤組\nれん,青組'}
            rows={4}
            className="mt-1 w-full resize-y rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        {result && (
          <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            {result.rows.length === 0 ? (
              <p className="text-sm text-red-600">
                取り込める行がありません。1列目に名前が入っているか確認してください。
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-700">
                  踊り子 <strong>{result.rows.length}</strong> 名 ／ グループ{' '}
                  <strong>{groupNames.length}</strong> 種類を取り込みます。
                  {result.skipped > 0 && (
                    <span className="text-amber-600">
                      （名前が空の {result.skipped} 行はスキップ）
                    </span>
                  )}
                </p>

                <div className="overflow-hidden rounded border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-500">
                      <tr>
                        <th className="px-2 py-1 font-medium">名前</th>
                        <th className="px-2 py-1 font-medium">グループ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, PREVIEW_LIMIT).map((r, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-2 py-1 text-slate-700">{r.name}</td>
                          <td className="px-2 py-1 text-slate-500">
                            {r.group.trim() || DEFAULT_GROUP_NAME}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.rows.length > PREVIEW_LIMIT && (
                    <div className="border-t border-slate-100 px-2 py-1 text-[11px] text-slate-400">
                      ほか {result.rows.length - PREVIEW_LIMIT} 名…
                    </div>
                  )}
                </div>

                <fieldset className="space-y-1.5">
                  <legend className="text-xs font-medium text-slate-600">
                    取り込み方法
                  </legend>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="import-mode"
                      checked={mode === 'replace'}
                      onChange={() => setMode('replace')}
                      className="mt-1"
                    />
                    <span>
                      入れ替え
                      <span className="block text-[11px] text-slate-400">
                        今の名簿を消して、CSVの内容に置き換えます。
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="import-mode"
                      checked={mode === 'append'}
                      onChange={() => setMode('append')}
                      className="mt-1"
                    />
                    <span>
                      追加
                      <span className="block text-[11px] text-slate-400">
                        今の名簿を残したまま、CSVの踊り子を追加します。
                      </span>
                    </span>
                  </label>
                </fieldset>

                {willReplaceExisting && (
                  <p className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-700">
                    <AlertTriangle size={14} className="mt-px shrink-0" />
                    現在の踊り子 {state.dancers.length} 名と全シーンの配置は破棄され、元に戻せません。
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <Button
          variant="primary"
          className="w-full"
          onClick={doImport}
          disabled={!result || result.rows.length === 0}
        >
          <Upload size={16} /> 取り込む
        </Button>
      </div>
    </Modal>
  )
}
