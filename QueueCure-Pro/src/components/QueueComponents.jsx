import { useState } from 'react'
import {
  Clock, User, Zap, Users, AlertTriangle,
  ChevronRight, SkipForward, UserX, RotateCcw,
  Phone, FileText, ArrowRight, Stethoscope,
} from 'lucide-react'
import {
  TOKEN_STATUS, TOKEN_STATUS_LABELS,
  PRIORITY, PRIORITY_LABELS, STATUS_COLORS,
} from '@/config/constants'
import {
  cn, formatTime, formatRelativeTime,
  formatEstimatedWait, estimateWaitMinutes,
} from '@/utils/utils'
import { Badge, Button, EmptyState } from '@/components/Shared'

// ─── PRIORITY BADGE ───────────────────────────────────────────────────────────

export function PriorityBadge({ priority, className = '' }) {
  if (!priority || priority === PRIORITY.NORMAL) return null

  const styles = {
    [PRIORITY.SENIOR]:    { variant: 'purple', icon: Users,        label: 'Senior' },
    [PRIORITY.EMERGENCY]: { variant: 'red',    icon: AlertTriangle, label: 'Emergency' },
  }
  const config = styles[priority]
  if (!config) return null

  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={cn('gap-1', className)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  )
}

// ─── TOKEN BADGE ─────────────────────────────────────────────────────────────

export function TokenBadge({ displayToken, status, size = 'md', className = '' }) {
  const colors = STATUS_COLORS.token[status] ?? STATUS_COLORS.token[TOKEN_STATUS.WAITING]

  const sizes = {
    sm:  'text-xs px-2 py-0.5 font-bold tracking-wider',
    md:  'text-sm px-3 py-1 font-bold tracking-wider',
    lg:  'text-base px-4 py-1.5 font-extrabold tracking-widest',
    xl:  'text-2xl px-5 py-2 font-extrabold tracking-widest',
    '2xl':'text-4xl px-6 py-3 font-black tracking-widest',
  }

  return (
    <span className={cn(
      'inline-flex items-center rounded-xl border font-mono',
      colors.bg, colors.text, colors.border,
      sizes[size],
      className
    )}>
      {displayToken}
    </span>
  )
}

// ─── STATUS DOT ──────────────────────────────────────────────────────────────

export function StatusDot({ status, pulse = false, className = '' }) {
  const colors = STATUS_COLORS.token[status] ?? STATUS_COLORS.token[TOKEN_STATUS.WAITING]
  return (
    <span className={cn('relative inline-flex items-center justify-center w-2.5 h-2.5', className)}>
      <span className={cn('w-2 h-2 rounded-full', colors.dot)} />
      {pulse && status === TOKEN_STATUS.IN_CONSULTATION && (
        <span className={cn('absolute inset-0 rounded-full animate-ping opacity-60', colors.dot)} />
      )}
    </span>
  )
}

// ─── TOKEN CARD ───────────────────────────────────────────────────────────────

export function TokenCard({
  token,
  doctorName,
  avgConsultMinutes,
  showActions     = false,
  onSkip,
  onNoShow,
  onReEnter,
  className       = '',
}) {
  const [expanded, setExpanded] = useState(false)
  const colors    = STATUS_COLORS.token[token.status] ?? STATUS_COLORS.token[TOKEN_STATUS.WAITING]
  const isActive  = [TOKEN_STATUS.WAITING, TOKEN_STATUS.CALLED, TOKEN_STATUS.IN_CONSULTATION].includes(token.status)
  const isInactive = [TOKEN_STATUS.SKIPPED, TOKEN_STATUS.NO_SHOW].includes(token.status)

  const waitMins  = token.status === TOKEN_STATUS.WAITING && avgConsultMinutes
    ? estimateWaitMinutes(avgConsultMinutes, token.queuePosition ?? 1)
    : null

  return (
    <div className={cn(
      'group relative bg-surface-card border rounded-2xl transition-all duration-200',
      isActive
        ? 'border-surface-border hover:border-emerald-700/50 hover:shadow-glow'
        : 'border-surface-border/50 opacity-70',
      token.status === TOKEN_STATUS.IN_CONSULTATION && 'border-emerald-700/60 shadow-glow',
      className
    )}>
      {/* Priority accent line */}
      {token.priority === PRIORITY.EMERGENCY && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-l-2xl" />
      )}
      {token.priority === PRIORITY.SENIOR && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 rounded-l-2xl" />
      )}

      <div className="p-4 pl-5">
        {/* Top row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <StatusDot status={token.status} pulse={true} />
            <TokenBadge displayToken={token.displayToken} status={token.status} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">
                {token.patientName ?? 'Walk-in Patient'}
              </p>
              {doctorName && (
                <p className="text-xs text-slate-500 truncate">{doctorName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PriorityBadge priority={token.priority} />
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-lg', colors.bg, colors.text)}>
              {TOKEN_STATUS_LABELS[token.status]}
            </span>
            {showActions && isActive && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-surface-raised transition-colors"
              >
                <ChevronRight className={cn('w-4 h-4 transition-transform', expanded && 'rotate-90')} />
              </button>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 mt-2.5 pl-5">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(token.createdAt)}
          </span>
          {token.patientPhone && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Phone className="w-3 h-3" />
              {token.patientPhone}
            </span>
          )}
          {waitMins !== null && (
            <span className="flex items-center gap-1 text-xs text-teal-400">
              <Clock className="w-3 h-3" />
              Est. {formatEstimatedWait(waitMins)}
            </span>
          )}
          {token.status === TOKEN_STATUS.IN_CONSULTATION && token.consultationStartAt && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Stethoscope className="w-3 h-3" />
              In since {formatTime(token.consultationStartAt)}
            </span>
          )}
          {token.notes && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <FileText className="w-3 h-3" />
              Note
            </span>
          )}
        </div>

        {/* Notes preview */}
        {token.notes && expanded && (
          <div className="mt-3 ml-5 px-3 py-2 bg-surface-raised rounded-lg border border-surface-border">
            <p className="text-xs text-slate-400">{token.notes}</p>
          </div>
        )}

        {/* Action row */}
        {showActions && expanded && isActive && (
          <div className="flex items-center gap-2 mt-3 ml-5">
            {token.status === TOKEN_STATUS.WAITING && onSkip && (
              <Button
                size="xs"
                variant="warning"
                icon={SkipForward}
                onClick={() => onSkip(token)}
              >
                Skip
              </Button>
            )}
            {token.status === TOKEN_STATUS.WAITING && onNoShow && (
              <Button
                size="xs"
                variant="danger"
                icon={UserX}
                onClick={() => onNoShow(token)}
              >
                No-Show
              </Button>
            )}
          </div>
        )}

        {/* Re-entry action for inactive tokens */}
        {showActions && isInactive && onReEnter && (
          <div className="mt-3 ml-5">
            <Button
              size="xs"
              variant="secondary"
              icon={RotateCcw}
              onClick={() => onReEnter(token)}
            >
              Re-enter Queue
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── QUEUE LIST ───────────────────────────────────────────────────────────────

export function QueueList({
  tokens,
  doctors,
  showActions  = false,
  onSkip,
  onNoShow,
  onReEnter,
  emptyTitle   = 'No patients in queue',
  emptyDesc    = 'Add a patient to get started.',
  className    = '',
}) {
  if (!tokens || tokens.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={emptyTitle}
        description={emptyDesc}
        className={className}
      />
    )
  }

  const getDoctorAvg = (doctorId) =>
    doctors?.find((d) => d.id === doctorId)?.avgConsultationMinutes ?? 10

  const getDoctorName = (doctorId) =>
    doctors?.find((d) => d.id === doctorId)?.name ?? ''

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {tokens.map((token) => (
        <TokenCard
          key={token.id}
          token={token}
          doctorName={getDoctorName(token.doctorId)}
          avgConsultMinutes={getDoctorAvg(token.doctorId)}
          showActions={showActions}
          onSkip={onSkip}
          onNoShow={onNoShow}
          onReEnter={onReEnter}
        />
      ))}
    </div>
  )
}

// ─── CALL NEXT BUTTON ─────────────────────────────────────────────────────────

export function CallNextButton({ onCallNext, loading, disabled, waitingCount, className = '' }) {
  const [confirming, setConfirming] = useState(false)
  const timerRef = useState(null)

  const handleClick = () => {
    if (disabled || loading) return
    if (!confirming) {
      setConfirming(true)
      timerRef[1](setTimeout(() => setConfirming(false), 3000))
      return
    }
    clearTimeout(timerRef[0])
    setConfirming(false)
    onCallNext()
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading || waitingCount === 0}
      className={cn(
        'relative w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-bold text-base transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface',
        confirming
          ? 'bg-emerald-500 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-surface scale-[1.02] shadow-glow-green focus:ring-emerald-400'
          : 'bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-500 shadow-glow-green/30',
        (disabled || waitingCount === 0) && 'opacity-40 cursor-not-allowed',
        loading && 'opacity-70 cursor-wait',
        className
      )}
    >
      {loading ? (
        <>
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Calling…
        </>
      ) : confirming ? (
        <>
          <ArrowRight className="w-5 h-5 animate-pulse" />
          Tap again to confirm
        </>
      ) : (
        <>
          <ArrowRight className="w-5 h-5" />
          Call Next Patient
          {waitingCount > 0 && (
            <span className="absolute right-4 bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {waitingCount} waiting
            </span>
          )}
        </>
      )}
    </button>
  )
}

// ─── NOW SERVING BANNER ───────────────────────────────────────────────────────

export function NowServingBanner({ token, doctorName, className = '' }) {
  if (!token) {
    return (
      <div className={cn('bg-surface-card border border-surface-border rounded-2xl p-5 text-center', className)}>
        <p className="text-sm text-slate-500">No patient currently in consultation</p>
      </div>
    )
  }

  return (
    <div className={cn(
      'relative bg-gradient-to-br from-emerald-950/80 to-teal-950/80 border border-emerald-700/50 rounded-2xl p-5 overflow-hidden',
      className
    )}>
      <div className="absolute inset-0 bg-emerald-500/5 rounded-2xl" />
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-2">
            Now In Consultation
          </p>
          <TokenBadge displayToken={token.displayToken} status={token.status} size="xl" />
          {token.patientName && (
            <p className="text-sm text-slate-300 mt-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              {token.patientName}
            </p>
          )}
        </div>
        <div className="text-right">
          <PriorityBadge priority={token.priority} />
          {doctorName && (
            <p className="text-xs text-teal-400 mt-2 flex items-center justify-end gap-1.5">
              <Stethoscope className="w-3.5 h-3.5" />
              {doctorName}
            </p>
          )}
          {token.consultationStartAt && (
            <p className="text-xs text-slate-500 mt-1">
              Since {formatTime(token.consultationStartAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}