// /api/formations — フォーメーションの一覧・作成・複製・改名・削除（すべて要トークン）。
//   GET                    : 一覧 { items, currentId } を返す（必要なら旧データを移行）
//   POST   (body: { doc }) : 新規作成（doc を1件目として保存）
//   POST   ?from=<id>      : 既存フォーメーションを複製
//   PATCH  (body: { id, title }) : 改名（索引と本体の title を更新）
//   DELETE ?id=<id>        : 削除（最後の1件は削除不可）
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthTeam } from './_lib/auth.js'
import {
  deleteFormationDoc,
  ensureFormationIndex,
  getFormationDoc,
  isValidFormationId,
  MAX_FORMATIONS,
  newFormationId,
  putFormationDoc,
  putFormationIndex,
  touchFormationMeta,
  type FormationIndex,
  type StoredDoc,
} from './_lib/store.js'

const MAX_TITLE_LENGTH = 100

function queryString(v: VercelRequest['query'][string]): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function titleOf(doc: StoredDoc | null, fallback = '無題のフォーメーション'): string {
  const t = doc && typeof doc.title === 'string' ? doc.title.trim() : ''
  return t || fallback
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const teamId = getAuthTeam(req)
    if (!teamId) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const index = await ensureFormationIndex(teamId)
    const isMember = (id: string | undefined): id is string =>
      !!id && isValidFormationId(id) && index.items.some((m) => m.id === id)

    if (req.method === 'GET') {
      return res.status(200).json({ items: index.items, currentId: index.currentId })
    }

    if (req.method === 'POST') {
      if (index.items.length >= MAX_FORMATIONS) {
        return res.status(409).json({ error: 'limit_reached' })
      }
      const fromId = queryString(req.query.from)

      let doc: StoredDoc
      let title: string
      if (fromId !== undefined) {
        // 複製：元の本体をクローンし、タイトルに「 のコピー」を付ける
        if (!isMember(fromId)) return res.status(404).json({ error: 'formation_not_found' })
        const source = (await getFormationDoc(teamId, fromId)) ?? {}
        doc = JSON.parse(JSON.stringify(source)) as StoredDoc
        title = `${titleOf(source)} のコピー`.slice(0, MAX_TITLE_LENGTH)
        doc.title = title
      } else {
        // 新規作成：フロントが組み立てた初期 doc を保存
        const body = (req.body ?? {}) as { doc?: unknown }
        if (!body.doc || typeof body.doc !== 'object') {
          return res.status(400).json({ error: 'invalid_doc' })
        }
        doc = body.doc as StoredDoc
        title = titleOf(doc)
      }

      const id = newFormationId()
      await putFormationDoc(teamId, id, doc)
      const next: FormationIndex = {
        items: [...index.items, { id, title, updatedAt: Date.now() }],
        currentId: id,
      }
      await putFormationIndex(teamId, next)
      return res.status(200).json({ id, items: next.items, currentId: next.currentId })
    }

    if (req.method === 'PATCH') {
      const body = (req.body ?? {}) as { id?: unknown; title?: unknown }
      if (!isMember(typeof body.id === 'string' ? body.id : undefined)) {
        return res.status(404).json({ error: 'formation_not_found' })
      }
      const id = body.id as string
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!title || title.length > MAX_TITLE_LENGTH) {
        return res.status(400).json({ error: 'invalid_title' })
      }
      // 本体の title も合わせて更新し、一覧と中身を一致させる
      const doc = (await getFormationDoc(teamId, id)) ?? {}
      doc.title = title
      await putFormationDoc(teamId, id, doc)
      const next = touchFormationMeta(index, id, title, Date.now())
      await putFormationIndex(teamId, next)
      return res.status(200).json({ items: next.items })
    }

    if (req.method === 'DELETE') {
      const id = queryString(req.query.id)
      if (!isMember(id)) return res.status(404).json({ error: 'formation_not_found' })
      if (index.items.length <= 1) {
        return res.status(409).json({ error: 'cannot_delete_last' })
      }
      await deleteFormationDoc(teamId, id)
      const items = index.items.filter((m) => m.id !== id)
      const currentId = index.currentId === id ? items[0].id : index.currentId
      const next: FormationIndex = { items, currentId }
      await putFormationIndex(teamId, next)
      return res.status(200).json({ items: next.items, currentId: next.currentId })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch {
    return res.status(500).json({ error: 'server_error' })
  }
}
