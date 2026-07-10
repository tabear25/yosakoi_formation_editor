// GET /api/health — デプロイ設定の診断（認証不要）。
// 「本番でセッションデータを保存できる状態か」を一目で確認するためのエンドポイント。
// 返すのは真偽値・件数・エラーメッセージのみで、秘密値や認証情報は一切含めない。
//   - appTeams     : APP_TEAMS が設定・パースできるか（チーム件数）
//   - sessionSecret: SESSION_SECRET が設定されているか
//   - kv           : KV に実際に読み書きできるか（往復テスト）
// すべて ok なら 200、1つでも失敗なら 503 を返す。
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { teamsConfigured } from './_lib/auth.js'
import { checkKvHealth } from './_lib/store.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  const appTeams = teamsConfigured()
  const sessionSecret = { ok: !!process.env.SESSION_SECRET }
  const kv = await checkKvHealth()

  const ok = appTeams.ok && sessionSecret.ok && kv.ok
  return res.status(ok ? 200 : 503).json({
    ok,
    checks: { appTeams, sessionSecret, kv },
  })
}
