import { useState } from 'react'
import { LogOut, Stethoscope, Clock, CheckCircle, Users, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'

import { auth } from '@/config/firebase'
import {
  useStore, useClinicId, useClinic,
  useStaffProfile, useTokens, useDoctors,
} from '@/store/store'
import { useRealtimeAll } from '@/hooks/useRealtime'
import { useCompleteConsultation, useUpdateDoctorStatus } from '@/hooks/useOperations'
import { TOKEN_STATUS, DOCTOR_STATUS, STORAGE_KEYS } from '@/config/constants'
import { cn, formatTime, formatRelativeTime, formatDuration, formatDateLabel, getTodayDateString } from '@/utils/utils'
import { emitToast } from '@/components/Shared'
import { Button, SectionHeader, EmptyState, Badge } from '@/components/Shared'
import { TokenBadge, PriorityBadge, NowServingBanner } from '@/components/QueueComponents'
import { ConsultationTimer, DoctorStatusToggle, DoctorAvatar } from '@/components/DoctorComponents'

// ─── DOCTOR QUEUE VIEW ────────────────────────────────────────────────────────

function DoctorQueueView({ tokens, doctor, doctors }) {
  const waiting = tokens
    .filter((t) => t.doctorId === doctor.id && t.status === TOKEN_STATUS.WAITING)
    .sort((a, b) => {
      const pA = a.priority === 'emergency' ? 0 : a.priority === 'senior' ? 1 : 2
      const pB = b.priority === 'emergency' ? 0 : b.priority === 'senior' ? 1 : 2
      return pA !== pB ? pA - pB : a.tokenNumber - b.tokenNumber
    })

  if (waiting.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No patients waiting"
        description="The queue is empty. Waiting for the receptionist to add patients."
      />
    )
  }

  return (
    <div className="space-y-2">
      {waiting.map((token, idx) => (
        <div
          key={token.id}
          className={cn(
            'flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all',
            idx === 0
              ? 'bg-teal-950/40 border-teal-700/50'
              : 'bg-surface-card border-surface-border'
          )}
        >
          {/* Position */}
          <div className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
            idx === 0
              ? 'bg-teal-600 text-white'
              : 'bg-surface-raised text-slate-500'
          )}>
            {idx + 1}
          </div>

          <TokenBadge displayToken={token.displayToken} status={token.status} size="md" />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">
              {token.patientName ?? 'Walk-in Patient'}
            </p>
            <p className="text-xs text-slate-500">
              Waiting since {formatRelativeTime(token.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PriorityBadge priority={token.priority} />
            {idx === 0 && (
              <Badge variant="teal">Next Up</Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── TODAY'S STATS CARD ───────────────────────────────────────────────────────

function TodayStatsCard({ doctor, tokens }) {
  const doctorTokens = tokens.filter((t) => t.doctorId === doctor.id)
  const completed    = doctorTokens.filter((t) => t.status === TOKEN_STATUS.COMPLETED)
  const avgConsult   = completed.length > 0
    ? Math.round(completed.reduce((s, t) => s + (t.actualConsultMinutes ?? 0), 0) / completed.length)
    : doctor.avgConsultationMinutes

  const stats = [
    { label: 'Seen Today',   value: completed.length,               color: 'text-emerald-400' },
    { label: 'Still Waiting', value: doctorTokens.filter(t => t.status === TOKEN_STATUS.WAITING).length, color: 'text-teal-400' },
    { label: 'Avg Consult',  value: `${avgConsult ?? '—'}m`,        color: 'text-slate-200'   },
    { label: 'Rolling Avg',  value: `${doctor.avgConsultationMinutes ?? 10}m`, color: 'text-slate-200' },
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-surface-card border border-surface-border rounded-2xl p-4 text-center">
          <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── RECENT CONSULTATIONS ─────────────────────────────────────────────────────

function RecentConsultations({ doctorId, tokens }) {
  const recent = tokens
    .filter((t) => t.doctorId === doctorId && t.status === TOKEN_STATUS.COMPLETED)
    .sort((a, b) => (b.consultationEndAt?.seconds ?? 0) - (a.consultationEndAt?.seconds ?? 0))
    .slice(0, 8)

  if (recent.length === 0) {
    return (
      <p className="text-xs text-slate-600 text-center py-6">
        No completed consultations yet today
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      {recent.map((t) => (
        <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-raised transition-colors">
          <TokenBadge displayToken={t.displayToken} status={t.status} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-300 truncate">{t.patientName ?? 'Walk-in'}</p>
            <p className="text-xs text-slate-600">
              {t.consultationEndAt ? formatRelativeTime(t.consultationEndAt) : '—'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-teal-400">
              {t.actualConsultMinutes != null ? `${t.actualConsultMinutes}m` : '—'}
            </p>
            <p className="text-xs text-slate-600">consult</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── MAIN DOCTOR DASHBOARD ────────────────────────────────────────────────────

export default function DoctorDashboard() {
  const navigate     = useNavigate()
  const clinicId     = useClinicId()
  const clinic       = useClinic()
  const staffProfile = useStaffProfile()
  const doctors      = useDoctors()
  const tokens       = useTokens()
  const [loadingComplete, setLoadingComplete] = useState(false)
  const [loadingStatus,   setLoadingStatus]   = useState(false)

  useRealtimeAll(clinicId)

  const { execute: complete } = useCompleteConsultation()
  const { execute: updateStatus } = useUpdateDoctorStatus()

  // Find this doctor's profile
  const doctorId = staffProfile?.doctorId ?? localStorage.getItem(STORAGE_KEYS.DOCTOR_ID)
  const doctor   = doctors.find((d) => d.id === doctorId) ?? null

  const currentToken = doctor
    ? tokens.find((t) => t.doctorId === doctor.id && t.status === TOKEN_STATUS.IN_CONSULTATION) ?? null
    : null

  const handleComplete = async () => {
    if (!currentToken || !doctor) return
    setLoadingComplete(true)
    const result = await complete(clinicId, doctor.id, currentToken.id)
    setLoadingComplete(false)
    if (result.success) emitToast({ message: 'Consultation complete', type: 'success' })
    else emitToast({ message: result.error, type: 'error' })
  }

  const handleStatusChange = async (status) => {
    if (!doctor) return
    setLoadingStatus(true)
    const result = await updateStatus(clinicId, doctor.id, status)
    setLoadingStatus(false)
    if (!result.success) emitToast({ message: result.error, type: 'error' })
  }

  const handleLogout = async () => {
    await signOut(auth)
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k))
    navigate('/login')
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <Stethoscope className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Doctor profile not found.</p>
          <p className="text-xs text-slate-600 mt-1">Contact your administrator.</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={handleLogout}>Sign Out</Button>
        </div>
      </div>
    )
  }

  const today = getTodayDateString()

  return (
    <div className="min-h-screen bg-surface flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-surface-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <DoctorAvatar name={doctor.name} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100 truncate">{doctor.name}</p>
              <p className="text-xs text-slate-500">{doctor.specialization} · {clinic?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DoctorStatusToggle
              doctorId={doctor.id}
              currentStatus={doctor.status}
              onUpdate={handleStatusChange}
              loading={loadingStatus}
            />
            <Button variant="ghost" size="sm" icon={LogOut} onClick={handleLogout} />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-5 flex gap-5">

        {/* Left column */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Today's stats */}
          <TodayStatsCard doctor={doctor} tokens={tokens} />

          {/* Current consultation */}
          <div>
            <SectionHeader title="Current Consultation" />
            {currentToken ? (
              <div className="bg-gradient-to-br from-emerald-950/80 to-teal-950/80 border border-emerald-700/50 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <TokenBadge displayToken={currentToken.displayToken} status={currentToken.status} size="lg" />
                      <PriorityBadge priority={currentToken.priority} />
                    </div>
                    <p className="text-lg font-semibold text-slate-100">
                      {currentToken.patientName ?? 'Walk-in Patient'}
                    </p>
                    {currentToken.patientPhone && (
                      <p className="text-xs text-slate-500 mt-0.5">{currentToken.patientPhone}</p>
                    )}
                  </div>
                  <ConsultationTimer
                    startTime={currentToken.consultationStartAt}
                    avgMinutes={doctor.avgConsultationMinutes}
                  />
                </div>

                {currentToken.notes && (
                  <div className="mb-4 px-3 py-2.5 bg-amber-950/40 border border-amber-700/30 rounded-xl">
                    <p className="text-xs text-amber-300">
                      <span className="font-semibold">Note: </span>
                      {currentToken.notes}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                  <div className="bg-surface-raised/50 rounded-xl p-3">
                    <p className="text-slate-500 mb-0.5">Called at</p>
                    <p className="text-slate-200 font-medium">{formatTime(currentToken.calledAt) ?? '—'}</p>
                  </div>
                  <div className="bg-surface-raised/50 rounded-xl p-3">
                    <p className="text-slate-500 mb-0.5">Wait time</p>
                    <p className="text-slate-200 font-medium">
                      {currentToken.actualWaitMinutes != null ? `${currentToken.actualWaitMinutes}m` : '—'}
                    </p>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  icon={CheckCircle}
                  loading={loadingComplete}
                  onClick={handleComplete}
                  className="w-full"
                >
                  Mark Consultation Complete
                </Button>
              </div>
            ) : (
              <div className="bg-surface-card border border-surface-border rounded-2xl p-8 text-center">
                {doctor.status === DOCTOR_STATUS.UNAVAILABLE ? (
                  <>
                    <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">You are currently unavailable</p>
                    <p className="text-xs text-slate-600 mt-1">Toggle your status to start accepting patients</p>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-10 h-10 text-emerald-800 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Ready for next patient</p>
                    <p className="text-xs text-slate-600 mt-1">Ask the receptionist to call the next token</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Waiting queue */}
          <div>
            <SectionHeader
              title="Waiting Queue"
              subtitle={`Patients assigned to ${doctor.name}`}
            />
            <DoctorQueueView tokens={tokens} doctor={doctor} doctors={doctors} />
          </div>
        </div>

        {/* Right column */}
        <aside className="w-64 shrink-0 space-y-4">

          {/* Doctor info card */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <DoctorAvatar name={doctor.name} size="lg" />
              <div>
                <p className="text-sm font-semibold text-slate-100">{doctor.name}</p>
                <p className="text-xs text-slate-500">{doctor.specialization}</p>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className={cn(
                  'font-medium',
                  doctor.status === DOCTOR_STATUS.AVAILABLE   ? 'text-emerald-400' :
                  doctor.status === DOCTOR_STATUS.IN_SESSION  ? 'text-blue-400'    :
                  doctor.status === DOCTOR_STATUS.ON_BREAK    ? 'text-amber-400'   :
                  'text-slate-400'
                )}>
                  {doctor.status === DOCTOR_STATUS.AVAILABLE   ? 'Available'   :
                   doctor.status === DOCTOR_STATUS.IN_SESSION  ? 'In Session'  :
                   doctor.status === DOCTOR_STATUS.ON_BREAK    ? 'On Break'    : 'Unavailable'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Avg consult</span>
                <span className="text-slate-300">{doctor.avgConsultationMinutes}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date</span>
                <span className="text-slate-300">{formatDateLabel(today)}</span>
              </div>
            </div>
          </div>

          {/* Recent consultations */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <SectionHeader title="Recent" subtitle="Today's completed" />
            <RecentConsultations doctorId={doctor.id} tokens={tokens} />
          </div>
        </aside>
      </main>
    </div>
  )
}