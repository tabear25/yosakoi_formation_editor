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

// 環境変数に設定されたチーム共通の ID/PW と一致するか
export function verifyCredentials(id: string, password: string): boolean {
  const expectedId = process.env.APP_LOGIN_ID
  const expectedPassword = process.env.APP_LOGIN_PASSWORD
  if (!expectedId || !expectedPassword) {
    throw new Error('APP_LOGIN_ID / APP_LOGIN_PASSWORD が未設定です')
  }
  // 片方だけ一致の場合でも両方比較し、応答時間の差を作らない
  const idOk = safeEqual(id, expectedId)
  const passwordOk = safeEqual(password, expectedPassword)
  return idOk && passwordOk
}

function sign(body: string): string {
  return createHmac('sha256', secret()).update(body).digest('base64url')
}

export function signToken(): string {
  const payload = { exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifyToken(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [body, sig] = parts
  if (!safeEqual(sig, sign(body))) return false
  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString(),
    ) as { exp?: number }
    return (
      typeof payload.exp === 'number' &&
      payload.exp > Math.floor(Date.now() / 1000)
    )
  } catch {
    return false
  }
}

// Authorization: Bearer <token> ヘッダを検証する
export function isAuthorized(req: VercelRequest): boolean {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return false
  return verifyToken(header.slice('Bearer '.length).trim())
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
