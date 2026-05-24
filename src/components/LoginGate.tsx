import { LogIn } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError, login, setUnauthorizedHandler } from '@/lib/api'
import { getToken, setToken } from '@/lib/session'
import { Button } from './ui'

// アカウント発行依頼メールの宛先・文面。運用に合わせてここを書き換える。
const REQUEST_ACCOUNT_EMAIL = 'katakuma4625@gmail.com'
const REQUEST_ACCOUNT_SUBJECT = '【よさこいフォーメーション表】アカウント発行依頼'
const REQUEST_ACCOUNT_BODY = [
  'よさこいフォーメーション表のアカウント発行を希望します。',
  '',
  'チーム名：',
  'ご担当者名：',
  'ご連絡先：',
  '備考：',
].join('\n')

const REQUEST_ACCOUNT_MAILTO =
  `mailto:${REQUEST_ACCOUNT_EMAIL}` +
  `?subject=${encodeURIComponent(REQUEST_ACCOUNT_SUBJECT)}` +
  `&body=${encodeURIComponent(REQUEST_ACCOUNT_BODY)}`

// 未ログインならログインフォームを表示し、ログイン済みのときだけ children を表示する。
// どのAPI呼び出しでも 401 を受けたらログイン画面へ戻す。
export function LoginGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(() => !!getToken())

  useEffect(() => {
    setUnauthorizedHandler(() => setAuthed(false))
    return () => setUnauthorizedHandler(() => {})
  }, [])

  if (!authed) return <LoginForm onSuccess={() => setAuthed(true)} />
  return <>{children}</>
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const token = await login(id, password)
      setToken(token)
      onSuccess()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('ID またはパスワードが違います。')
      } else {
        setError('ログインに失敗しました。時間をおいて再度お試しください。')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-center text-lg font-semibold text-slate-800">
          よさこい フォーメーション表
        </h1>
        <p className="mt-1 text-center text-xs text-slate-500">
          チーム共通の ID・パスワードでログイン
        </p>
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          編集にはログインが必要です。ログイン後の変更は自動的に保存されます。ID・パスワードが分からない場合はチームの管理者にご確認ください。
        </p>

        <label className="mt-5 block text-xs font-medium text-slate-600">ID</label>
        <input
          className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          value={id}
          onChange={(e) => setId(e.target.value)}
          autoComplete="username"
          autoFocus
        />

        <label className="mt-3 block text-xs font-medium text-slate-600">
          パスワード
        </label>
        <input
          type="password"
          className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <p className="mt-3 text-center text-[11px] text-slate-500">
          アカウントをお持ちでない場合は{' '}
          <a
            href={REQUEST_ACCOUNT_MAILTO}
            className="font-medium text-indigo-600 underline hover:text-indigo-700"
          >
            アカウント発行を依頼する
          </a>
        </p>

        <Button
          type="submit"
          variant="primary"
          className="mt-5 h-10 w-full"
          disabled={busy || !id || !password}
        >
          <LogIn size={16} /> {busy ? 'ログイン中…' : 'ログイン'}
        </Button>
      </form>
    </div>
  )
}
