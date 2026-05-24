// /api/doc — チーム共通のライブドキュメントの取得(GET)と保存(PUT)。いずれも要トークン。
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAuthTeam } from './_lib/auth'
import { getDoc, putDoc, type StoredDoc } from './_lib/store'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const teamId = getAuthTeam(req)
    if (!teamId) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    if (req.method === 'GET') {
      const doc = await getDoc(teamId)
      return res.status(200).json({ doc }) // 未保存なら doc は null
    }

    if (req.method === 'PUT') {
      const body = (req.body ?? {}) as { doc?: unknown }
      const doc = body.doc
      if (!doc || typeof doc !== 'object') {
        return res.status(400).json({ error: 'invalid_doc' })
      }
      await putDoc(teamId, doc as StoredDoc)
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch {
    return res.status(500).json({ error: 'server_error' })
  }
}
