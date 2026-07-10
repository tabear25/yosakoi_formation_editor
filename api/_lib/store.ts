// KV（Vercel KV / Upstash Redis）への薄いアクセス層。
// ドキュメントの中身は厳密に型付けせず、JSON としてそのまま保存・取得する。
import { randomUUID } from 'node:crypto'
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

const SHARE_PREFIX = 'share:'
const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90 // 共有スナップショットは90日で自動失効

// 1チームに保持できるフォーメーション数の上限（暴走・肥大化の歯止め）
export const MAX_FORMATIONS = 50

// 旧・単一ドキュメントのキー（doc:<teamId>）。マイグレーション時の読み出し元。
function legacyDocKey(teamId: string): string {
  return `doc:${teamId}`
}
// フォーメーション別ドキュメントのキー（doc:<teamId>:<formationId>）
function formationDocKey(teamId: string, formationId: string): string {
  return `doc:${teamId}:${formationId}`
}
// チームのフォーメーション索引のキー（formations:<teamId>）
function indexKey(teamId: string): string {
  return `formations:${teamId}`
}

export type StoredDoc = Record<string, unknown>
export type StoredShare = { doc: StoredDoc; createdAt: number }

// フォーメーションのメタ情報（一覧表示用に title を非正規化して持つ）
export type FormationMeta = { id: string; title: string; updatedAt: number }
// チームのフォーメーション索引：一覧と「最後に開いていたID」
export type FormationIndex = { items: FormationMeta[]; currentId: string }

// formationId は KV キーの断片になるため文字種・長さを制限する（UUID 想定）
const FORMATION_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/
export function isValidFormationId(id: unknown): id is string {
  return typeof id === 'string' && FORMATION_ID_PATTERN.test(id)
}

// 旧・単一ドキュメント（doc:<teamId>）。マイグレーション専用に残す。
export async function getLegacyDoc(teamId: string): Promise<StoredDoc | null> {
  return (await redis().get<StoredDoc>(legacyDocKey(teamId))) ?? null
}

export async function getFormationIndex(teamId: string): Promise<FormationIndex | null> {
  return (await redis().get<FormationIndex>(indexKey(teamId))) ?? null
}

export async function putFormationIndex(
  teamId: string,
  index: FormationIndex,
): Promise<void> {
  await redis().set(indexKey(teamId), index)
}

export async function getFormationDoc(
  teamId: string,
  formationId: string,
): Promise<StoredDoc | null> {
  return (await redis().get<StoredDoc>(formationDocKey(teamId, formationId))) ?? null
}

export async function putFormationDoc(
  teamId: string,
  formationId: string,
  doc: StoredDoc,
): Promise<void> {
  await redis().set(formationDocKey(teamId, formationId), doc)
}

export async function deleteFormationDoc(
  teamId: string,
  formationId: string,
): Promise<void> {
  await redis().del(formationDocKey(teamId, formationId))
}

function docTitle(doc: StoredDoc | null): string {
  const t = doc && typeof doc.title === 'string' ? doc.title.trim() : ''
  return t || '無題のフォーメーション'
}

// フォーメーション索引を必ず1つ用意する（非破壊マイグレーション）。
// - 既に索引があればそれを返す。
// - 無くて旧 doc:<teamId> があれば、それを1個目のフォーメーションへ移行する（旧キーは残す）。
// - どちらも無ければ空の索引を作る（フロントが最初の1件を作成する）。
export async function ensureFormationIndex(teamId: string): Promise<FormationIndex> {
  const existing = await getFormationIndex(teamId)
  if (existing) return existing

  const legacy = await getLegacyDoc(teamId)
  let index: FormationIndex
  if (legacy) {
    const id = randomUUID()
    // 先に本体を書く（索引の有無を「移行済み」の目印にする）
    await putFormationDoc(teamId, id, legacy)
    index = {
      items: [{ id, title: docTitle(legacy), updatedAt: Date.now() }],
      currentId: id,
    }
  } else {
    index = { items: [], currentId: '' }
  }

  // 同時アクセス時の二重作成を防ぐため、索引は「まだ無いときだけ」原子的に書く（NX）。
  const created = await redis().set(indexKey(teamId), index, { nx: true })
  if (created) return index
  // 他リクエストが先に作成済み → そちらを採用（自分が書いた本体は孤児として残るが無害）。
  return (await getFormationIndex(teamId)) ?? index
}

// 新規フォーメーションIDを払い出す
export function newFormationId(): string {
  return randomUUID()
}

// 索引内の title / updatedAt を更新する（存在しなければ何もしない）
export function touchFormationMeta(
  index: FormationIndex,
  id: string,
  title: string,
  at: number,
): FormationIndex {
  return {
    ...index,
    items: index.items.map((m) =>
      m.id === id ? { ...m, title: docTitle({ title }), updatedAt: at } : m,
    ),
  }
}

// KV の接続診断結果（秘密情報は一切含めない）
export type KvHealth =
  | { ok: true }
  | { ok: false; configured: boolean; error: string }

// KV が実際に読み書きできるかを往復（set→get→del）で確認する。
// 環境変数が無ければ Redis に触れず「未設定」として返す（例外を投げない）。
export async function checkKvHealth(): Promise<KvHealth> {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    return { ok: false, configured: false, error: 'KV の接続情報が未設定です' }
  }
  try {
    const key = 'health:ping'
    await redis().set(key, 'ok', { ex: 60 })
    const value = await redis().get<string>(key)
    await redis().del(key)
    if (String(value) !== 'ok') {
      return { ok: false, configured: true, error: 'KV の往復テストに失敗しました' }
    }
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: err instanceof Error ? err.message : String(err),
    }
  }
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
