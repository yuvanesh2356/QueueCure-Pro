import { useEffect, useState } from 'react'
import { Clock, Users, CheckCircle, Stethoscope, AlertCircle, Wifi } from 'lucide-react'
import { TOKEN_STATUS, PRIORITY } from '@/config/constants'
import {
  cn, formatEstimatedWait, estimateWaitMinutes,
  formatTime, formatRelativeTime,
} from '@/utils/utils'
import { TokenBadge, PriorityBadge } from '@/components/QueueComponents'

// ─── CURRENT TOKEN DISPLAY ────────────────────────────────────────────────────

export function CurrentTokenDisplay({ token, className = '' }) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-3xl p-8 text-center',
      'bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-900',
      'border border-emerald-700/40',
      className
    )}>
      {/* Decorative glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-emerald-500/10 rounded-full blur-3xl" />

      <p className="text-xs text-emerald-400 font-semibold uppercase tracking-[0.2em] mb-4 relative">
        Now Being Seen
      </p>

      {token ? (
        <>
          <div className="relative mb-3">
            <span className="font-mono font-black text-token-lg text-emerald-400 leading-none tracking-tight drop-shadow-lg">
              {token.displayToken}
            </span>
          </div>
          {token.patientName && (
            <p className="text-slate-300 text-sm mb-2">{token.patientName}</p>
          )}
          <PriorityBadge priority={token.priority} className="mx-auto" />
        </>
      ) : (
        <div className="py-4">
          <p className="text-2xl font-bold text-slate-600">—</p>
          <p className="text-xs text-slate-600 mt-2">Queue not started</p>
        </div>
      )}
    </div>
  )
}

// ─── QUEUE POSITION BAR ───────────────────────────────────────────────────────

export function QueuePositionBar({ position, totalAhead, className = '' }) {
  const progress = totalAhead === 0 ? 100 : Math.max(5, ((totalAhead - position + 1) / (totalAhead + 1)) * 100)

  return (
    <div className={cn('', className)}>
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
        <span>Your progress</span>
        <span>{position <= 0 ? 'Next up!' : `${position} ahead`}</span>
      </div>
      <div className="h-2.5 bg-surface-raised rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// ─── WAIT ESTIMATE CARD ───────────────────────────────────────────────────────

export function WaitEstimateCard({ estimatedMinutes, tokensAhead, avgConsultMinutes, className = '' }) {
  return (
    <div className={cn('bg-surface-card border border-surface-border rounded-2xl p-5', className)}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
          <Clock className="w-4 h-4 text-teal-400" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium">Estimated Wait</p>
          <p className="text-2xl font-bold text-slate-100">
            {formatEstimatedWait(estimatedMinutes)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-raised rounded-xl p-3 text-center">
          <Users className="w-4 h-4 text-slate-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-200">{tokensAhead}</p>
          <p className="text-xs text-slate-500">ahead of you</p>
        </div>
        <div className="bg-surface-raised rounded-xl p-3 text-center">
          <Stethoscope className="w-4 h-4 text-slate-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-200">{avgConsultMinutes ?? '—'}m</p>
          <p className="text-xs text-slate-500">avg per patient</p>
        </div>
      </div>

      <p className="text-xs text-slate-600 mt-3 text-center">
        Based on last 5 consultations · Updated live
      </p>
    </div>
  )
}

// ─── TOKEN STATUS TRACKER ─────────────────────────────────────────────────────

export function TokenStatusTracker({ status, className = '' }) {
  const steps = [
    { key: TOKEN_STATUS.WAITING,         label: 'In Queue',     icon: Users       },
    { key: TOKEN_STATUS.IN_CONSULTATION, label: 'Being Seen',   icon: Stethoscope },
    { key: TOKEN_STATUS.COMPLETED,       label: 'Done',         icon: CheckCircle },
  ]

  const statusIndex = {
    [TOKEN_STATUS.WAITING]:         0,
    [TOKEN_STATUS.CALLED]:          1,
    [TOKEN_STATUS.IN_CONSULTATION]: 1,
    [TOKEN_STATUS.COMPLETED]:       2,
    [TOKEN_STATUS.SKIPPED]:         -1,
    [TOKEN_STATUS.NO_SHOW]:         -1,
  }

  const activeIndex = statusIndex[status] ?? 0

  if (status === TOKEN_STATUS.SKIPPED || status === TOKEN_STATUS.NO_SHOW) {
    return (
      <div className={cn('flex items-center gap-2 px-4 py-3 bg-amber-900/30 border border-amber-700/40 rounded-xl', className)}>
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="text-sm text-amber-300">
          {status === TOKEN_STATUS.SKIPPED
            ? 'Your token was skipped. Please see the receptionist.'
            : 'You were marked as no-show. Please see the receptionist to re-enter.'
          }
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-0', className)}>
      {steps.map((step, idx) => {
        const Icon      = step.icon
        const completed = idx < activeIndex
        const active    = idx === activeIndex

        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all duration-300',
                completed && 'bg-emerald-600 border-emerald-500 text-white',
                active    && 'bg-teal-600 border-teal-400 text-white ring-4 ring-teal-500/30',
                !completed && !active && 'bg-surface-raised border-surface-border text-slate-600'
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <p className={cn(
                'text-xs mt-1.5 font-medium text-center leading-tight',
                active    && 'text-teal-300',
                completed && 'text-emerald-400',
                !active && !completed && 'text-slate-600'
              )}>
                {step.label}
              </p>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-1 mb-4 transition-all duration-300',
                idx < activeIndex ? 'bg-emerald-600' : 'bg-surface-border'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── LIVE INDICATOR ───────────────────────────────────────────────────────────

export function LiveIndicator({ className = '' }) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-xs text-emerald-400 font-medium">Live</span>
    </div>
  )
}

// ─── PATIENT TOKEN HERO ───────────────────────────────────────────────────────

export function PatientTokenHero({ token, doctor, position, totalWaiting, className = '' }) {
  const estimatedMins = doctor && position > 0
    ? estimateWaitMinutes(doctor.avgConsultationMinutes, position)
    : null

  return (
    <div className={cn('space-y-4', className)}>
      {/* Token display */}
      <div className="relative bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-900 border border-emerald-700/40 rounded-3xl p-8 text-center overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/8 rounded-full blur-3xl" />
        <div className="relative">
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-[0.2em] mb-3">Your Token</p>
          <p className="font-mono font-black text-token-lg text-white leading-none mb-3">{token.displayToken}</p>
          <PriorityBadge priority={token.priority} className="mx-auto" />
          {doctor && (
            <p className="text-xs text-teal-400 mt-3 flex items-center justify-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5" />
              {doctor.name}
            </p>
          )}
        </div>
      </div>

      {/* Status tracker */}
      <TokenStatusTracker status={token.status} />

      {/* Wait info */}
      {token.status === TOKEN_STATUS.WAITING && (
        <>
          <WaitEstimateCard
            estimatedMinutes={estimatedMins}
            tokensAhead={Math.max(0, position - 1)}
            avgConsultMinutes={doctor?.avgConsultationMinutes}
          />
          <QueuePositionBar position={Math.max(0, position - 1)} totalAhead={totalWaiting} />
        </>
      )}

      {token.status === TOKEN_STATUS.IN_CONSULTATION && (
        <div className="flex items-center gap-3 px-4 py-3.5 bg-emerald-900/30 border border-emerald-700/40 rounded-xl">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <p className="text-sm text-emerald-300 font-medium">
            You are now with the doctor. Please proceed to the consultation room.
          </p>
        </div>
      )}

      {token.status === TOKEN_STATUS.COMPLETED && (
        <div className="flex items-center gap-3 px-4 py-3.5 bg-teal-900/30 border border-teal-700/40 rounded-xl">
          <CheckCircle className="w-5 h-5 text-teal-400 shrink-0" />
          <p className="text-sm text-teal-300">
            Your consultation is complete. Thank you for visiting.
            {token.consultationEndAt && (
              <span className="text-slate-500 ml-1">({formatRelativeTime(token.consultationEndAt)})</span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}