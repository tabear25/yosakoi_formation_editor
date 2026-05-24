// バックエンド（/api）への薄い fetch ラッパ。
// 認証が必要な呼び出しはトークンを付与し、401 を受けたらトークンを破棄して
// 登録済みハンドラ（ログイン画面へ戻す等）を呼ぶ。
import type { DocState } from '@/types'
import { clearToken, getToken } from './session'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string) {
    super(`API error ${status}: ${code}`)
    this.status = status
    this.code = code
  }
}

let onUnauthorized: () => void = () => {}
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

// authFail: 401 のときの挙動。
//   'logout' = トークン破棄してログイン画面へ戻す（初期ロード向け）
//   'throw'  = 自動ログアウトせず例外を投げる（編集中の自動保存向け＝編集内容を即破棄しない）
type RequestOptions = RequestInit & {
  auth?: boolean
  authFail?: 'logout' | 'throw'
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const { auth = false, authFail = 'logout', headers, ...rest } = options
  const token = auth ? getToken() : null
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  })
  if (res.status === 401 && auth && authFail === 'logout') {
    clearToken()
    onUnauthorized()
  }
  return res
}

async function readErrorCode(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    return data.error ?? 'error'
  } catch {
    return 'error'
  }
}

// チーム共通 ID/PW でログインし、トークンを取得する
export async function login(id: string, password: string): Promise<string> {
  const res = await request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ id, password }),
  })
  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res))
  const data = (await res.json()) as { token: string }
  return data.token
}

// 保存済みドキュメントを読み込む（未保存なら null）
export async function loadDoc(): Promise<DocState | null> {
  const res = await request('/api/doc', { method: 'GET', auth: true })
  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res))
  const data = (await res.json()) as { doc: DocState | null }
  return data.doc
}

// 現在のドキュメントを保存する（自動保存の送信先）
export async function saveDoc(doc: DocState): Promise<void> {
  const res = await request('/api/doc', {
    method: 'PUT',
    auth: true,
    authFail: 'throw', // 保存中の401で編集画面を即破棄しない（バナーで再ログインを促す）
    body: JSON.stringify({ doc }),
  })
  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res))
}

// 現在のドキュメントのスナップショットを共有し、合言葉を得る
export async function createShare(doc: DocState, code?: string): Promise<string> {
  const res = await request('/api/share', {
    method: 'POST',
    auth: true,
    authFail: 'throw',
    body: JSON.stringify(code ? { doc, code } : { doc }),
  })
  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res))
  const data = (await res.json()) as { code: string }
  return data.code
}

// 合言葉に対応するスナップショットを取得する（認証不要・見つからなければ null）
export async function getShare(code: string): Promise<DocState | null> {
  const res = await request(`/api/share?code=${encodeURIComponent(code)}`, {
    method: 'GET',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res))
  const data = (await res.json()) as { doc: DocState }
  return data.doc
}
