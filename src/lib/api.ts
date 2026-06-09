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

// ===== 複数フォーメーション =====

export type FormationMeta = { id: string; title: string; updatedAt: number }
export type FormationIndex = { items: FormationMeta[]; currentId: string }

// チームのフォーメーション一覧（初回は旧データを自動移行）
export async function listFormations(): Promise<FormationIndex> {
  const res = await request('/api/formations', { method: 'GET', auth: true })
  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res))
  return (await res.json()) as FormationIndex
}

// 指定フォーメーションのドキュメントを読み込む（未保存なら null）。開いたものを「最後に開いた」に記録。
export async function loadFormationDoc(formationId: string): Promise<DocState | null> {
  const res = await request(`/api/doc?formation=${encodeURIComponent(formationId)}`, {
    method: 'GET',
    auth: true,
  })
  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res))
  const data = (await res.json()) as { doc: DocState | null }
  return data.doc
}

// 指定フォーメーションへ保存する（自動保存の送信先）
export async function saveFormationDoc(formationId: string, doc: DocState): Promise<void> {
  const res = await request(`/api/doc?formation=${encodeURIComponent(formationId)}`, {
    method: 'PUT',
    auth: true,
    authFail: 'throw', // 保存中の401で編集画面を即破棄しない（バナーで再ログインを促す）
    body: JSON.stringify({ doc }),
  })
  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res))
}

type CreateResult = { id: string } & FormationIndex

// 新規フォーメーションを作成する（初期 doc を保存）
export async function createFormation(doc: DocState): Promise<CreateResult> {
  const res = await request('/api/formations', {
    method: 'POST',
    auth: true,
    authFail: 'throw',
    body: JSON.stringify({ doc }),
  })
  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res))
  return (await res.json()) as CreateResult
}

// 既存フォーメーションを複製する
export async function duplicateFormation(fromId: string): Promise<CreateResult> {
  const res = await request(`/api/formations?from=${encodeURIComponent(fromId)}`, {
    method: 'POST',
    auth: true,
    authFail: 'throw',
  })
  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res))
  return (await res.json()) as CreateResult
}

// フォーメーションを改名する
export async function renameFormation(
  id: string,
  title: string,
): Promise<{ items: FormationMeta[] }> {
  const res = await request('/api/formations', {
    method: 'PATCH',
    auth: true,
    authFail: 'throw',
    body: JSON.stringify({ id, title }),
  })
  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res))
  return (await res.json()) as { items: FormationMeta[] }
}

// フォーメーションを削除する（最後の1件は削除不可）
export async function deleteFormation(id: string): Promise<FormationIndex> {
  const res = await request(`/api/formations?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    auth: true,
    authFail: 'throw',
  })
  if (!res.ok) throw new ApiError(res.status, await readErrorCode(res))
  return (await res.json()) as FormationIndex
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
