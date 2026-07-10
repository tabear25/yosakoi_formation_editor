// /api/doc — フォーメーション別ライブドキュメントの取得(GET)と保存(PUT)。いずれも要トークン。
//   GET  ?formation=<id>  : そのフォーメーションを取得（指定が無ければ「最後に開いていた」もの）
//   PUT  ?formation=<id>  : そのフォーメーションへ保存
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthTeam } from './_lib/auth.js'
import {
  ensureFormationIndex,
  getFormationDoc,
  isValidFormationId,
  putFormationDoc,
  putFormationIndex,
  touchFormationMeta,
  type StoredDoc,
} from './_lib/store.js'

function queryFormationId(req: VercelRequest): string | undefined {
  const v = req.query.formation
  return typeof v === 'string' ? v : undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const teamId = getAuthTeam(req)
    if (!teamId) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const index = await ensureFormationIndex(teamId)
    const reqId = queryFormationId(req)
    // 指定IDは「索引に存在する」ものだけ許可（任意キーへのアクセスを防ぐ）
    const isMember = (id: string | undefined): id is string =>
      !!id && isValidFormationId(id) && index.items.some((m) => m.id === id)

    if (req.method === 'GET') {
      // 対象: 指定ID → 最後に開いていたID → 先頭 → （無ければ）null
      let targetId: string | null = null
      if (reqId !== undefined) {
        if (!isMember(reqId)) return res.status(404).json({ error: 'formation_not_found' })
        targetId = reqId
      } else if (isMember(index.currentId)) {
        targetId = index.currentId
      } else if (index.items.length > 0) {
        targetId = index.items[0].id
      }

      if (!targetId) {
        // フォーメーションが1つも無い（新規チーム）。フロントが最初の1件を作成する。
        return res.status(200).json({ doc: null, formationId: null })
      }

      const doc = await getFormationDoc(teamId, targetId)
      // 開いたフォーメーションを「最後に開いていたもの」として記録する
      if (index.currentId !== targetId) {
        await putFormationIndex(teamId, { ...index, currentId: targetId })
      }
      return res.status(200).json({ doc, formationId: targetId })
    }

    if (req.method === 'PUT') {
      // 保存先: 指定ID（推奨）。互換のため指定が無ければ currentId にフォールバック。
      const targetId = reqId ?? index.currentId
      if (!isMember(targetId)) {
        return res.status(404).json({ error: 'formation_not_found' })
      }
      const body = (req.body ?? {}) as { doc?: unknown }
      const doc = body.doc
      if (!doc || typeof doc !== 'object') {
        return res.status(400).json({ error: 'invalid_doc' })
      }
      await putFormationDoc(teamId, targetId, doc as StoredDoc)
      // 索引の title / updatedAt / currentId を更新
      const title = typeof (doc as StoredDoc).title === 'string'
        ? ((doc as StoredDoc).title as string)
        : ''
      const next = touchFormationMeta(index, targetId, title, Date.now())
      await putFormationIndex(teamId, { ...next, currentId: targetId })
      return res.status(200).json({ ok: true, formationId: targetId })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (err) {
    console.error('[api/doc]', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
