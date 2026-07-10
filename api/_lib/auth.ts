// チーム共通 ID/PW の照合と、HMAC 署名によるセッショントークンの発行・検証。
// 暗号は Node 標準の crypto のみを使い、外部依存を増やさない。
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // セッションは7日有効

function secret(): string {
  const value = process.env.SESSION_SECRET
  if (!value) throw new Error('SESSION_SECRET が未設定です')
  return value
}

// 文字列同士を時間一定で比較する（長さが違えば false）
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

// チーム定義。id は KV キーの断片になるため英数・ハイフン・アンダースコアのみ許可。
type Team = { id: string; password: string; name?: string }

// teamId は KV キー（doc:<teamId>）に使うので文字種と長さを厳しく制限する
const TEAM_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
function isValidTeamId(id: unknown): id is string {
  return typeof id === 'string' && TEAM_ID_PATTERN.test(id)
}

let cachedTeams: Team[] | null = null

// APP_TEAMS（JSON 配列）をパース・検証して返す（初回のみ実行しメモ化）
function teams(): Team[] {
  if (cachedTeams) return cachedTeams
  const raw = process.env.APP_TEAMS
  if (!raw) throw new Error('APP_TEAMS が未設定です')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('APP_TEAMS が不正な JSON です')
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('APP_TEAMS は1件以上のチーム定義を含む配列である必要があります')
  }
  const seen = new Set<string>()
  const list: Team[] = parsed.map((entry, index) => {
    const t = entry as { id?: unknown; password?: unknown; name?: unknown }
    if (!isValidTeamId(t.id)) {
      throw new Error(
        `APP_TEAMS[${index}].id が不正です（英数・- ・_ のみ、1〜64文字）`,
      )
    }
    if (typeof t.password !== 'string' || !t.password) {
      throw new Error(`APP_TEAMS[${index}].password が未設定です`)
    }
    if (seen.has(t.id)) {
      throw new Error(`APP_TEAMS の id が重複しています: ${t.id}`)
    }
    seen.add(t.id)
    return {
      id: t.id,
      password: t.password,
      name: typeof t.name === 'string' ? t.name : undefined,
    }
  })
  cachedTeams = list
  return list
}

// APP_TEAMS が設定・パースできる状態かを診断する（値そのものは返さない）。
// 健診エンドポイント用。例外は投げず、失敗時はメッセージを返す。
export function teamsConfigured(): { ok: boolean; count: number; error?: string } {
  try {
    const list = teams()
    return { ok: true, count: list.length }
  } catch (err) {
    return {
      ok: false,
      count: 0,
      error: err instanceof Error ? err.message : 'APP_TEAMS の検証に失敗しました',
    }
  }
}

// 入力された ID/PW に一致するチームの teamId を返す（一致しなければ null）
export function verifyCredentials(id: string, password: string): string | null {
  let matched: string | null = null
  // 早期 return せず全チームを走査し、毎回 ID/PW 両方を比較して応答時間の差を抑える
  for (const team of teams()) {
    const idOk = safeEqual(id, team.id)
    const passwordOk = safeEqual(password, team.password)
    // & で結合し、短絡評価による比較回数の差を作らない
    if (Number(idOk) & Number(passwordOk)) {
      matched = team.id
    }
  }
  return matched
}

function sign(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('base64url')
}

export function signToken(teamId: string): string {
  const payload = {
    team: teamId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

// 署名・有効期限を検証し、正しければ teamId を返す（不正なら null）
export function verifyToken(token: string): { team: string } | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  if (!safeEqual(sig, sign(body))) return null
  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString(),
    ) as { team?: unknown; exp?: unknown }
    const expValid =
      typeof payload.exp === 'number' &&
      payload.exp > Math.floor(Date.now() / 1000)
    // team は KV キーに使うため、署名済みでも改めて文字種を検証する
    if (!expValid || !isValidTeamId(payload.team)) return null
    return { team: payload.team }
  } catch {
    return null
  }
}

// Authorization: Bearer <token> ヘッダを検証し、teamId を返す（不正なら null）
export function getAuthTeam(req: VercelRequest): string | null {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return null
  const result = verifyToken(header.slice('Bearer '.length).trim())
  return result ? result.team : null
}

// 合言葉の自動生成（0/o/1/l など紛らわしい文字を除外）
const CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
export function generateCode(length = 6): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  }
  return out
}
