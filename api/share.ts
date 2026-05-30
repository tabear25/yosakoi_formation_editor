// /api/share — 合言葉による読み取り専用共有。
//   POST: 現在のドキュメントのスナップショットを保存し合言葉を返す（要トークン）
//   GET ?code=: 合言葉に対応するスナップショットを返す（公開・認証不要）
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateCode, getAuthTeam } from './_lib/auth.js'
import { getShare, putShare, shareExists, type StoredDoc } from './_lib/store.js'

const MAX_CODE_LENGTH = 64

// 空白文字とキー区切りのコロンを禁止（日本語・英数字・記号などは許可）
const FORBIDDEN_IN_CODE = /[\s:]/

// ユーザー指定の合言葉を検証・正規化する（不正なら null）
function normalizeCustomCode(raw: string): string | null {
  const code = raw.trim()
  if (code.length < 3 || code.length > MAX_CODE_LENGTH) return null
  if (FORBIDDEN_IN_CODE.test(code)) return null
  return code
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const code = typeof req.query.code === 'string' ? req.query.code : ''
      if (!code) return res.status(400).json({ error: 'missing_code' })
      const share = await getShare(code)
      if (!share) return res.status(404).json({ error: 'not_found' })
      return res.status(200).json({ doc: share.doc, createdAt: share.createdAt })
    }

    if (req.method === 'POST') {
      if (!getAuthTeam(req)) {
        return res.status(401).json({ error: 'unauthorized' })
      }
      const body = (req.body ?? {}) as { doc?: unknown; code?: unknown }
      const doc = body.doc
      if (!doc || typeof doc !== 'object') {
        return res.status(400).json({ error: 'invalid_doc' })
      }

      // 希望の合言葉が指定された場合
      if (typeof body.code === 'string' && body.code.trim()) {
        const custom = normalizeCustomCode(body.code)
        if (!custom) return res.status(400).json({ error: 'invalid_code' })
        if (await shareExists(custom)) {
          return res.status(409).json({ error: 'code_taken' })
        }
        await putShare(custom, doc as StoredDoc)
        return res.status(200).json({ code: custom })
      }

      // 自動生成（衝突したら数回リトライ）
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode(6)
        if (!(await shareExists(code))) {
          await putShare(code, doc as StoredDoc)
          return res.status(200).json({ code })
        }
      }
      return res.status(500).json({ error: 'code_generation_failed' })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch {
    return res.status(500).json({ error: 'server_error' })
  }
}
