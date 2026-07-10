// POST /api/login — チーム共通 ID/PW を照合し、一致すれば署名トークンを返す。
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { signToken, verifyCredentials } from './_lib/auth.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' })
    }
    const body = (req.body ?? {}) as { id?: unknown; password?: unknown }
    const id = typeof body.id === 'string' ? body.id : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const teamId = id && password ? verifyCredentials(id, password) : null
    if (!teamId) {
      return res.status(401).json({ error: 'invalid_credentials' })
    }
    return res.status(200).json({ token: signToken(teamId) })
  } catch (err) {
    console.error('[api/login]', err)
    return res.status(500).json({ error: 'server_error' })
  }
}
