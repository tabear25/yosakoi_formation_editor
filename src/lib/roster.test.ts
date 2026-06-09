import { describe, expect, it } from 'vitest'
import { buildRosterCsv, parseRosterCsv } from './roster'

describe('parseRosterCsv', () => {
  it('名前とグループの2列を取り込む', () => {
    const res = parseRosterCsv('さくら,赤組\nれん,青組')
    expect(res.rows).toEqual([
      { name: 'さくら', group: '赤組' },
      { name: 'れん', group: '青組' },
    ])
    expect(res.hadHeader).toBe(false)
  })

  it('見出し行（名前,グループ）を読み飛ばす', () => {
    const res = parseRosterCsv('名前,グループ\nさくら,赤組')
    expect(res.hadHeader).toBe(true)
    expect(res.rows).toEqual([{ name: 'さくら', group: '赤組' }])
  })

  it('先頭のBOMを除去する', () => {
    const res = parseRosterCsv('﻿名前,グループ\nれん,青組')
    expect(res.hadHeader).toBe(true)
    expect(res.rows).toEqual([{ name: 'れん', group: '青組' }])
  })

  it('CRLF と前後の空白を正規化する', () => {
    const res = parseRosterCsv(' さくら , 赤組 \r\nれん,青組\r\n')
    expect(res.rows).toEqual([
      { name: 'さくら', group: '赤組' },
      { name: 'れん', group: '青組' },
    ])
  })

  it('引用符内のカンマを1フィールドとして扱う', () => {
    const res = parseRosterCsv('"山田, 太郎",赤組')
    expect(res.rows).toEqual([{ name: '山田, 太郎', group: '赤組' }])
  })

  it('グループ列が無ければグループは空文字になる', () => {
    const res = parseRosterCsv('さくら\nれん')
    expect(res.rows).toEqual([
      { name: 'さくら', group: '' },
      { name: 'れん', group: '' },
    ])
  })

  it('名前が空の行はスキップして数える', () => {
    const res = parseRosterCsv('さくら,赤組\n,青組\nれん,黄組')
    expect(res.rows).toHaveLength(2)
    expect(res.skipped).toBe(1)
    expect(res.dataLines).toBe(3)
  })

  it('完全な空行は無視する', () => {
    const res = parseRosterCsv('さくら,赤組\n\n\nれん,青組\n')
    expect(res.rows).toHaveLength(2)
    expect(res.dataLines).toBe(2)
  })
})

describe('buildRosterCsv', () => {
  it('ヘッダー付きで往復できる', () => {
    const rows = [
      { name: 'さくら', group: '赤組' },
      { name: 'れん', group: '青組' },
    ]
    const csv = buildRosterCsv(rows)
    expect(csv.startsWith('名前,グループ\r\n')).toBe(true)
    expect(parseRosterCsv(csv).rows).toEqual(rows)
  })

  it('カンマを含む値を引用符で囲む', () => {
    const csv = buildRosterCsv([{ name: '山田, 太郎', group: '赤組' }])
    expect(csv).toContain('"山田, 太郎",赤組')
  })
})
