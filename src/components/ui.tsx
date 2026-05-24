import { X } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'default' | 'primary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  default: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50',
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-600',
  ghost: 'text-slate-600 hover:bg-slate-100 border border-transparent',
  danger: 'bg-white border border-red-300 text-red-600 hover:bg-red-50',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'md'
  active?: boolean
}

export function Button({
  variant = 'default',
  size = 'md',
  active = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors select-none',
        'disabled:opacity-40 disabled:pointer-events-none',
        size === 'sm' ? 'h-8 px-2 text-xs' : 'h-9 px-3 text-sm',
        VARIANTS[variant],
        active &&
          'ring-2 ring-indigo-500 bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-50',
        className,
      )}
      {...props}
    />
  )
}

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

type DrawerProps = ModalProps & { side?: 'left' | 'right' }

export function Drawer({ open, onClose, title, children, side = 'left' }: DrawerProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          'absolute bottom-0 top-0 flex w-[85%] max-w-sm flex-col bg-white shadow-xl',
          side === 'left' ? 'left-0' : 'right-0',
        )}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
