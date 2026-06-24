import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle, Wifi, WifiOff, X, Loader2, Info, XCircle } from 'lucide-react'
import { useStore, useConfirmDialog, useFirestoreConnected, useGlobalError } from '@/store/store'
import { cn } from '@/utils/utils'

// ─── LOADING SPINNER ─────────────────────────────────────────────────────────

export function LoadingSpinner({ size = 'md', className = '', label = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10', xl: 'w-16 h-16' }
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <Loader2 className={cn('animate-spin text-emerald-400', sizes[size])} />
      {label && <p className="text-sm text-slate-400 animate-pulse">{label}</p>}
    </div>
  )
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <LoadingSpinner size="xl" label={label} />
    </div>
  )
}

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────

export class ErrorBoundary extends Error {
  // Standard React error boundary as class component
}

import { Component } from 'react'

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6">
          <div className="bg-surface-card border border-red-800/60 rounded-2xl p-8 max-w-md w-full text-center">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-100 mb-2">Something went wrong</h2>
            <p className="text-slate-400 text-sm mb-6">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── CONNECTION STATUS ────────────────────────────────────────────────────────

export function ConnectionStatus() {
  const connected = useFirestoreConnected()
  const [visible, setVisible] = useState(false)
  const prevConnected = useRef(connected)

  useEffect(() => {
    if (prevConnected.current !== connected) {
      setVisible(true)
      prevConnected.current = connected
      if (connected) {
        const timer = setTimeout(() => setVisible(false), 3000)
        return () => clearTimeout(timer)
      }
    }
  }, [connected])

  if (!visible && connected) return null

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium shadow-lg transition-all duration-300 animate-slide-up',
        connected
          ? 'bg-emerald-900/90 text-emerald-300 border border-emerald-700/50'
          : 'bg-red-900/90 text-red-300 border border-red-700/50'
      )}
    >
      {connected
        ? <><CheckCircle className="w-4 h-4" /> Reconnected</>
        : <><WifiOff className="w-4 h-4" /> Connection lost — retrying…</>
      }
    </div>
  )
}

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────

export function ConfirmDialog() {
  const dialog          = useConfirmDialog()
  const closeDialog     = useStore((s) => s.closeConfirmDialog)
  const [busy, setBusy] = useState(false)

  if (!dialog.open) return null

  const variantStyles = {
    default:     { icon: <Info className="w-6 h-6 text-emerald-400" />,    btn: 'bg-emerald-600 hover:bg-emerald-500' },
    warning:     { icon: <AlertTriangle className="w-6 h-6 text-amber-400" />, btn: 'bg-amber-600 hover:bg-amber-500' },
    destructive: { icon: <XCircle className="w-6 h-6 text-red-400" />,     btn: 'bg-red-600 hover:bg-red-500' },
  }
  const styles = variantStyles[dialog.variant] ?? variantStyles.default

  const handleConfirm = async () => {
    if (!dialog.onConfirm) return
    setBusy(true)
    try { await dialog.onConfirm() } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeDialog} />
      <div className="relative bg-surface-card border border-surface-border rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-up">
        <div className="flex items-start gap-4 mb-5">
          <div className="shrink-0 w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center">
            {styles.icon}
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100 mb-1">{dialog.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{dialog.message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={closeDialog}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-surface-raised hover:bg-surface-border rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className={cn('px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2', styles.btn)}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TOAST NOTIFICATION ───────────────────────────────────────────────────────

let toastListeners = []
let toastId = 0

export function emitToast({ message, type = 'success', duration = 3500 }) {
  const id = ++toastId
  toastListeners.forEach((fn) => fn({ id, message, type, duration }))
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const handler = (toast) => {
      setToasts((prev) => [...prev, toast])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, toast.duration)
    }
    toastListeners.push(handler)
    return () => { toastListeners = toastListeners.filter((l) => l !== handler) }
  }, [])

  const remove = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const typeStyles = {
    success: 'bg-emerald-900/95 border-emerald-700/60 text-emerald-200',
    error:   'bg-red-900/95 border-red-700/60 text-red-200',
    warning: 'bg-amber-900/95 border-amber-700/60 text-amber-200',
    info:    'bg-teal-900/95 border-teal-700/60 text-teal-200',
  }
  const typeIcons = {
    success: <CheckCircle className="w-4 h-4 shrink-0" />,
    error:   <XCircle     className="w-4 h-4 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 shrink-0" />,
    info:    <Info        className="w-4 h-4 shrink-0" />,
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium pointer-events-auto animate-slide-up',
            typeStyles[toast.type] ?? typeStyles.info
          )}
        >
          {typeIcons[toast.type]}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => remove(toast.id)} className="opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────

export function StatCard({ label, value, icon: Icon, trend, color = 'emerald', className = '' }) {
  const colorMap = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    teal:    { bg: 'bg-teal-500/10',    text: 'text-teal-400',    border: 'border-teal-500/20'    },
    mint:    { bg: 'bg-green-500/10',   text: 'text-green-400',   border: 'border-green-500/20'   },
    amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20'   },
    red:     { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20'     },
    slate:   { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/20'   },
  }
  const c = colorMap[color] ?? colorMap.emerald

  return (
    <div className={cn('bg-surface-card border border-surface-border rounded-2xl p-5 flex items-center gap-4', className)}>
      {Icon && (
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center border', c.bg, c.border)}>
          <Icon className={cn('w-5 h-5', c.text)} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-100 mt-0.5">{value ?? '—'}</p>
        {trend && <p className="text-xs text-slate-500 mt-0.5">{trend}</p>}
      </div>
    </div>
  )
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────

export function SectionHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-5', className)}>
      <div>
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ─── BADGE ────────────────────────────────────────────────────────────────────

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default:   'bg-slate-700 text-slate-300',
    emerald:   'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50',
    teal:      'bg-teal-900/60 text-teal-300 border border-teal-700/50',
    amber:     'bg-amber-900/60 text-amber-300 border border-amber-700/50',
    red:       'bg-red-900/60 text-red-300 border border-red-700/50',
    purple:    'bg-purple-900/60 text-purple-300 border border-purple-700/50',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-surface-raised border border-surface-border flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-slate-600" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-300 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ─── INPUT / LABEL PRIMITIVES ─────────────────────────────────────────────────

export function Label({ children, htmlFor, required, className = '' }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('block text-xs font-medium text-slate-400 mb-1.5', className)}
    >
      {children}
      {required && <span className="text-emerald-400 ml-0.5">*</span>}
    </label>
  )
}

export function Input({ className = '', error, ...props }) {
  return (
    <>
      <input
        className={cn(
          'w-full bg-surface-raised border rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all',
          error ? 'border-red-500/60' : 'border-surface-border',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </>
  )
}

export function Select({ className = '', error, children, ...props }) {
  return (
    <>
      <select
        className={cn(
          'w-full bg-surface-raised border rounded-xl px-4 py-2.5 text-sm text-slate-100',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all',
          'appearance-none cursor-pointer',
          error ? 'border-red-500/60' : 'border-surface-border',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </>
  )
}

export function Textarea({ className = '', error, ...props }) {
  return (
    <>
      <textarea
        className={cn(
          'w-full bg-surface-raised border rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 resize-none',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all',
          error ? 'border-red-500/60' : 'border-surface-border',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </>
  )
}

// ─── BUTTON ───────────────────────────────────────────────────────────────────

export function Button({
  children,
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  disabled = false,
  className = '',
  icon: Icon,
  ...props
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface'

  const variants = {
    primary:   'bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-500 shadow-glow-green/20',
    secondary: 'bg-surface-raised hover:bg-surface-border text-slate-200 border border-surface-border focus:ring-slate-500',
    danger:    'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500',
    warning:   'bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-500',
    ghost:     'text-slate-400 hover:text-slate-200 hover:bg-surface-raised focus:ring-slate-500',
    teal:      'bg-teal-600 hover:bg-teal-500 text-white focus:ring-teal-500',
  }

  const sizes = {
    xs: 'text-xs px-2.5 py-1.5',
    sm: 'text-xs px-3.5 py-2',
    md: 'text-sm px-4 py-2.5',
    lg: 'text-sm px-5 py-3',
    xl: 'text-base px-6 py-3.5',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : Icon && <Icon className="w-3.5 h-3.5" />
      }
      {children}
    </button>
  )
}

// ─── GLOBAL ERROR BANNER ──────────────────────────────────────────────────────

export function GlobalErrorBanner() {
  const error      = useGlobalError()
  const clearError = useStore((s) => s.clearGlobalError)

  if (!error) return null

  return (
    <div className="fixed top-0 inset-x-0 z-40 bg-red-900/95 border-b border-red-700/60 px-4 py-3 flex items-center gap-3 animate-fade-in">
      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
      <p className="text-sm text-red-200 flex-1">{error}</p>
      <button onClick={clearError} className="text-red-400 hover:text-red-200 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}