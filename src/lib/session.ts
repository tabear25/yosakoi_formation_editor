// ログインセッショントークンの保存場所（localStorage）。
// 値はサーバーが HMAC 署名したトークンで、有効期限はサーバー側で検証される。
const TOKEN_KEY = 'yf_token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // プライベートモード等で書けない場合は黙って無視（ログインは維持されない）
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // 取得時と同様、失敗は無視
  }
}
