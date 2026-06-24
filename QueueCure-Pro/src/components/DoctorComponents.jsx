import { useState, useEffect, useRef } from 'react'
import {
  Stethoscope, Clock, CheckCircle, Coffee,
  XCircle, ToggleLeft, ToggleRight, Timer,
  ChevronDown, User, TrendingUp,
} from 'lucide-react'
import { DOCTOR_STATUS, DOCTOR_STATUS_LABELS, STATUS_COLORS } from '@/config/constants'
import { cn, formatElapsed, formatDuration, getInitials, stringToColor } from '@/utils/utils'
import { Button, Badge } from '@/components/Shared'
import { TokenBadge } from '@/components/QueueComponents'

// ─── DOCTOR AVATAR ────────────────────────────────────────────────────────────

export function DoctorAvatar({ name, size = 'md', className = '' }) {
  const initials = getInitials(name)
  const color    = stringToColor(name)
  const sizes    = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-base' }

  return (
    <div
      className={cn('rounded-xl flex items-center justify-center font-bold text-white shrink-0', sizes[size], className)}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  )
}

// ─── DOCTOR STATUS BADGE ──────────────────────────────────────────────────────

export function DoctorStatusBadge({ status, className = '' }) {
  const config = STATUS_COLORS.doctor[status] ?? STATUS_COLORS.doctor[DOCTOR_STATUS.UNAVAILABLE]

  const icons = {
    [DOCTOR_STATUS.AVAILABLE]:   CheckCircle,
    [DOCTOR_STATUS.IN_SESSION]:  Stethoscope,
    [DOCTOR_STATUS.ON_BREAK]:    Coffee,
    [DOCTOR_STATUS.UNAVAILABLE]: XCircle,
  }
  const Icon = icons[status] ?? XCircle

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', config.text, className)}>
      <Icon className="w-3 h-3" />
      {DOCTOR_STATUS_LABELS[status]}
    </span>
  )
}

// ─── CONSULTATION TIMER ───────────────────────────────────────────────────────

export function ConsultationTimer({ startTime, avgMinutes, className = '' }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startTime) return
    const start = startTime?.toDate ? startTime.toDate() : new Date(startTime)

    const tick = () => setElapsed(Date.now() - start.getTime())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startTime])

  if (!startTime) return null

  const elapsedMin  = elapsed / 60000
  const avgMs       = (avgMinutes ?? 10) * 60000
  const overrunning = elapsed > avgMs * 1.2

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-mono font-bold',
        overrunning
          ? 'bg-red-900/50 text-red-300 border border-red-700/50'
          : 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50'
      )}>
        <Timer className={cn('w-3.5 h-3.5', overrunning && 'animate-pulse')} />
        {formatElapsed(elapsed)}
      </div>
      {overrunning && (
        <span className="text-xs text-red-400 animate-pulse">Running long</span>
      )}
    </div>
  )
}

// ─── DOCTOR STATUS TOGGLE ─────────────────────────────────────────────────────

export function DoctorStatusToggle({ doctorId, currentStatus, onUpdate, loading, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref             = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const options = [
    { status: DOCTOR_STATUS.AVAILABLE,   label: 'Available',   icon: CheckCircle, color: 'text-emerald-400' },
    { status: DOCTOR_STATUS.ON_BREAK,    label: 'On Break',    icon: Coffee,      color: 'text-amber-400'   },
    { status: DOCTOR_STATUS.UNAVAILABLE, label: 'Unavailable', icon: XCircle,     color: 'text-slate-400'   },
  ]

  const current      = STATUS_COLORS.doctor[currentStatus]
  const currentLabel = DOCTOR_STATUS_LABELS[currentStatus] ?? 'Unknown'
  const isAvailable  = currentStatus === DOCTOR_STATUS.AVAILABLE

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading || currentStatus === DOCTOR_STATUS.IN_SESSION}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed',
          isAvailable
            ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/50'
            : 'bg-surface-raised border-surface-border text-slate-300 hover:border-slate-500'
        )}
      >
        {isAvailable
          ? <ToggleRight className="w-4 h-4" />
          : <ToggleLeft  className="w-4 h-4" />
        }
        {currentStatus === DOCTOR_STATUS.IN_SESSION ? 'In Session' : currentLabel}
        {currentStatus !== DOCTOR_STATUS.IN_SESSION && (
          <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-surface-card border border-surface-border rounded-xl shadow-2xl z-20 py-1 animate-fade-in">
          {options.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.status}
                onClick={() => {
                  setOpen(false)
                  onUpdate(opt.status)
                }}
                disabled={opt.status === currentStatus}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors',
                  opt.status === currentStatus
                    ? 'text-slate-600 cursor-default'
                    : `hover:bg-surface-raised ${opt.color}`
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── DOCTOR CARD ─────────────────────────────────────────────────────────────

export function DoctorCard({
  doctor,
  currentToken,
  waitingCount,
  onStatusChange,
  onCallNext,
  onComplete,
  loadingCallNext,
  loadingComplete,
  showActions     = true,
  className       = '',
}) {
  const statusColor = STATUS_COLORS.doctor[doctor.status]
  const isInSession = doctor.status === DOCTOR_STATUS.IN_SESSION

  return (
    <div className={cn(
      'bg-surface-card border rounded-2xl p-5 transition-all duration-200',
      isInSession
        ? 'border-emerald-700/60 shadow-glow'
        : 'border-surface-border',
      className
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <DoctorAvatar name={doctor.name} size="md" />
            <span className={cn(
              'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface-card',
              statusColor?.bg ?? 'bg-slate-500'
            )} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">{doctor.name}</p>
            <p className="text-xs text-slate-500 truncate">{doctor.specialization}</p>
          </div>
        </div>

        {showActions && (
          <DoctorStatusToggle
            doctorId={doctor.id}
            currentStatus={doctor.status}
            onUpdate={(status) => onStatusChange?.(doctor.id, status)}
            loading={loadingCallNext || loadingComplete}
          />
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-surface-raised rounded-xl p-2.5 text-center">
          <p className="text-xs text-slate-500 mb-0.5">Waiting</p>
          <p className="text-lg font-bold text-slate-100">{waitingCount}</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-2.5 text-center">
          <p className="text-xs text-slate-500 mb-0.5">Done</p>
          <p className="text-lg font-bold text-emerald-400">{doctor.consultationCount ?? 0}</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-2.5 text-center">
          <p className="text-xs text-slate-500 mb-0.5">Avg</p>
          <p className="text-lg font-bold text-teal-400">{doctor.avgConsultationMinutes ?? 10}m</p>
        </div>
      </div>

      {/* Current consultation */}
      {isInSession && currentToken && (
        <div className="mb-3 p-3 bg-emerald-950/50 border border-emerald-700/40 rounded-xl">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wide">In Consultation</span>
            <ConsultationTimer
              startTime={currentToken.consultationStartAt}
              avgMinutes={doctor.avgConsultationMinutes}
            />
          </div>
          <div className="flex items-center gap-2">
            <TokenBadge displayToken={currentToken.displayToken} status={currentToken.status} size="sm" />
            <span className="text-sm text-slate-300">
              {currentToken.patientName ?? 'Walk-in Patient'}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="flex flex-col gap-2">
          {isInSession && currentToken && onComplete && (
            <Button
              variant="primary"
              size="sm"
              icon={CheckCircle}
              loading={loadingComplete}
              onClick={() => onComplete(doctor.id, currentToken.id)}
              className="w-full"
            >
              Mark Consultation Complete
            </Button>
          )}
          {!isInSession && doctor.status !== DOCTOR_STATUS.UNAVAILABLE && onCallNext && (
            <Button
              variant="teal"
              size="sm"
              icon={Stethoscope}
              loading={loadingCallNext}
              disabled={waitingCount === 0}
              onClick={() => onCallNext(doctor.id)}
              className="w-full"
            >
              {waitingCount === 0 ? 'No Patients Waiting' : `Call Next Patient`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── DOCTOR GRID ─────────────────────────────────────────────────────────────

export function DoctorGrid({
  doctors,
  tokensByDoctor,
  currentTokenByDoctor,
  onStatusChange,
  onCallNext,
  onComplete,
  loadingMap     = {},
  className      = '',
}) {
  if (!doctors || doctors.length === 0) return null

  return (
    <div className={cn('grid gap-4', doctors.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2', className)}>
      {doctors.map((doctor) => (
        <DoctorCard
          key={doctor.id}
          doctor={doctor}
          currentToken={currentTokenByDoctor?.[doctor.id] ?? null}
          waitingCount={tokensByDoctor?.[doctor.id]?.filter(t => t.status === 'waiting').length ?? 0}
          onStatusChange={onStatusChange}
          onCallNext={onCallNext}
          onComplete={onComplete}
          loadingCallNext={loadingMap[`callNext_${doctor.id}`] ?? false}
          loadingComplete={loadingMap[`complete_${doctor.id}`] ?? false}
        />
      ))}
    </div>
  )
}