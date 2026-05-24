// KV（Vercel KV / Upstash Redis）への薄いアクセス層。
// ドキュメントの中身は厳密に型付けせず、JSON としてそのまま保存・取得する。
import { Redis } from '@upstash/redis'

// Vercel KV 連携・Upstash 連携のどちらの環境変数名でも動くようにする
function createClient(): Redis {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error(
      'KV の接続情報が未設定です（KV_REST_API_URL / KV_REST_API_TOKEN もしくは UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN）',
    )
  }
  return new Redis({ url, token })
}

let client: Redis | null = null
function redis(): Redis {
  if (!client) client = createClient()
  return client
}

const DOC_KEY = 'doc:main'
const SHARE_PREFIX = 'share:'
const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90 // 共有スナップショットは90日で自動失効

export type StoredDoc = Record<string, unknown>
export type StoredShare = { doc: StoredDoc; createdAt: number }

// チーム共通のライブドキュメント（自動保存先）
export async function getDoc(): Promise<StoredDoc | null> {
  return (await redis().get<StoredDoc>(DOC_KEY)) ?? null
}

export async function putDoc(doc: StoredDoc): Promise<void> {
  await redis().set(DOC_KEY, doc)
}

// 合言葉で配布する読み取り専用スナップショット
export async function getShare(code: string): Promise<StoredShare | null> {
  return (await redis().get<StoredShare>(SHARE_PREFIX + code)) ?? null
}

export async function shareExists(code: string): Promise<boolean> {
  return (await redis().exists(SHARE_PREFIX + code)) === 1
}

export async function putShare(code: string, doc: StoredDoc): Promise<void> {
  const value: StoredShare = { doc, createdAt: Date.now() }
  await redis().set(SHARE_PREFIX + code, value, { ex: SHARE_TTL_SECONDS })
}
