import { useState, useCallback, useRef } from 'react'
import {
  Plus, LogOut, Monitor, QrCode, BarChart2,
  X, ChevronDown, Printer, RefreshCw,
  Clock, Users, CheckCircle, AlertTriangle,
  Stethoscope, Search, Filter,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { QRCodeSVG } from 'qrcode.react'

import { auth } from '@/config/firebase'
import {
  useStore, useClinicId, useClinic, useDoctors,
  useActiveTokens, useTokens, useSession,
  useTodayStats, useIsQueueOpen,
  useRecentlyCompleted, useReEntryEligible,
} from '@/store/store'
import { useRealtimeAll } from '@/hooks/useRealtime'
import {
  useQueueOperations,
  useUpdateDoctorStatus,
  useOpenSession,
  useCloseSession,
} from '@/hooks/useOperations'
import {
  PRIORITY, PRIORITY_LABELS, TOKEN_STATUS,
  DOCTOR_STATUS, ROLE, STORAGE_KEYS,
} from '@/config/constants'
import {
  cn, formatTime, getTodayDateString,
  buildCheckinUrl, buildTVUrl, buildPatientUrl,
  formatDuration, formatDateLabel,
} from '@/utils/utils'
import { emitToast } from '@/components/Shared'
import {
  Button, Label, Input, Select, Textarea,
  SectionHeader, EmptyState, LoadingSpinner,
} from '@/components/Shared'
import {
  QueueList, NowServingBanner,
  TokenBadge, CallNextButton,
} from '@/components/QueueComponents'
import {
  DoctorCard, DoctorAvatar,
} from '@/components/DoctorComponents'

// ─── ADD PATIENT MODAL (extracted per architecture) ───────────────────────────
// Imported inline since AddPatientModal.jsx is Wave 5's companion file
// but lives in pages/ — we import from the sibling file
import AddPatientModal from '@/pages/AddPatientModal'

// ─── PRINT TOKEN SLIP ─────────────────────────────────────────────────────────

function printTokenSlip({ displayToken, patientName, doctorName, clinicName, estimatedWait }) {
  const slipWindow = window.open('', '_blank', 'width=320,height=480')
  if (!slipWindow) return

  slipWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Token Slip - ${displayToken}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          width: 280px;
          padding: 20px 16px;
          background: #fff;
          color: #000;
        }
        .clinic { font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 4px; }
        .subtitle { font-size: 10px; text-align: center; color: #555; margin-bottom: 16px; }
        .divider { border-top: 1px dashed #999; margin: 12px 0; }
        .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
        .token { font-size: 52px; font-weight: 900; text-align: center; letter-spacing: 4px; margin: 8px 0; }
        .row { margin-bottom: 8px; }
        .val { font-size: 13px; font-weight: bold; }
        .footer { font-size: 9px; text-align: center; color: #888; margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="clinic">${clinicName ?? 'QueueCure Clinic'}</div>
      <div class="subtitle">Queue Token Slip</div>
      <div class="divider"></div>
      <div class="label">Your Token Number</div>
      <div class="token">${displayToken}</div>
      <div class="divider"></div>
      ${patientName ? `<div class="row"><div class="label">Patient</div><div class="val">${patientName}</div></div>` : ''}
      ${doctorName  ? `<div class="row"><div class="label">Doctor</div><div class="val">${doctorName}</div></div>` : ''}
      ${estimatedWait ? `<div class="row"><div class="label">Estimated Wait</div><div class="val">${estimatedWait}</div></div>` : ''}
      <div class="row"><div class="label">Date</div><div class="val">${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</div></div>
      <div class="row"><div class="label">Time</div><div class="val">${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })}</div></div>
      <div class="divider"></div>
      <div class="footer">Please wait for your token to be announced<br>Powered by QueueCure Pro</div>
    </body>
    </html>
  `)
  slipWindow.document.close()
  slipWindow.focus()
  setTimeout(() => { slipWindow.print(); slipWindow.close() }, 300)
}

// ─── DOCTOR STATUS PANEL ──────────────────────────────────────────────────────

function DoctorStatusPanel({ doctors, tokens, onCallNext, onComplete, onStatusChange, loadingMap }) {
  const currentByDoctor = {}
  const waitingByDoctor = {}

  doctors.forEach((d) => {
    currentByDoctor[d.id] = tokens.find(
      (t) => t.doctorId === d.id && t.status === TOKEN_STATUS.IN_CONSULTATION
    ) ?? null
    waitingByDoctor[d.id] = tokens.filter(
      (t) => t.doctorId === d.id && t.status === TOKEN_STATUS.WAITING
    )
  })

  if (doctors.length === 0) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="No doctors configured"
        description="Add doctors during clinic setup."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {doctors.map((doctor) => (
        <DoctorCard
          key={doctor.id}
          doctor={doctor}
          currentToken={currentByDoctor[doctor.id]}
          waitingCount={waitingByDoctor[doctor.id]?.length ?? 0}
          onStatusChange={onStatusChange}
          onCallNext={onCallNext}
          onComplete={onComplete}
          loadingCallNext={loadingMap[`callNext_${doctor.id}`] ?? false}
          loadingComplete={loadingMap[`complete_${doctor.id}`]  ?? false}
        />
      ))}
    </div>
  )
}

// ─── QUEUE MANAGEMENT PANEL ───────────────────────────────────────────────────

function QueueManagementPanel({
  activeTokens,
  inactiveTokens,
  doctors,
  onSkip,
  onNoShow,
  onReEnter,
}) {
  const [filter,   setFilter]   = useState('active')
  const [search,   setSearch]   = useState('')
  const [doctorFilter, setDoctorFilter] = useState('all')

  const filtered = (filter === 'active' ? activeTokens : inactiveTokens).filter((t) => {
    const matchSearch = !search
      || t.displayToken.toLowerCase().includes(search.toLowerCase())
      || (t.patientName ?? '').toLowerCase().includes(search.toLowerCase())
    const matchDoctor = doctorFilter === 'all' || t.doctorId === doctorFilter
    return matchSearch && matchDoctor
  })

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex gap-1 p-1 bg-surface-raised rounded-xl">
          {[
            { key: 'active',   label: `Active (${activeTokens.length})`   },
            { key: 'inactive', label: `History (${inactiveTokens.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-all',
                filter === tab.key
                  ? 'bg-surface-card text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search token or name…"
              className="w-full bg-surface-raised border border-surface-border rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>
          {doctors.length > 1 && (
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="bg-surface-raised border border-surface-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            >
              <option value="all">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Token list */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 custom-scroll">
        <QueueList
          tokens={filtered}
          doctors={doctors}
          showActions={true}
          onSkip={onSkip}
          onNoShow={onNoShow}
          onReEnter={onReEnter}
          emptyTitle={filter === 'active' ? 'No active patients' : 'No history yet'}
          emptyDesc={filter === 'active'
            ? 'Add a patient to begin the queue.'
            : 'Completed and skipped tokens will appear here.'}
        />
      </div>
    </div>
  )
}

// ─── QUICK STATS BAR ─────────────────────────────────────────────────────────

function QuickStatsBar({ stats, avgWait }) {
  const items = [
    { label: 'Issued',    value: stats.issued,    color: 'text-slate-200'  },
    { label: 'Waiting',   value: stats.waiting,   color: 'text-teal-400'   },
    { label: 'Done',      value: stats.completed, color: 'text-emerald-400' },
    { label: 'Skipped',   value: stats.skipped,   color: 'text-amber-400'  },
    { label: 'No-Shows',  value: stats.noShows,   color: 'text-red-400'    },
    { label: 'Avg Wait',  value: avgWait != null ? `${avgWait}m` : '—', color: 'text-slate-300' },
  ]

  return (
    <div className="grid grid-cols-6 gap-2">
      {items.map((item) => (
        <div key={item.label} className="bg-surface-card border border-surface-border rounded-xl p-3 text-center">
          <p className={cn('text-lg font-bold', item.color)}>{item.value}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-tight">{item.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── QR PANEL ────────────────────────────────────────────────────────────────

function QRPanel({ clinicId, clinicName }) {
  const [show, setShow] = useState(false)
  const checkinUrl = buildCheckinUrl(clinicId)

  if (!show) {
    return (
      <Button variant="secondary" size="sm" icon={QrCode} onClick={() => setShow(true)}>
        QR Check-In
      </Button>
    )
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon={QrCode} onClick={() => setShow(true)}>
        QR Check-In
      </Button>

      <div
        className="fixed z-50"
        style={{
          top: '0px',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '24px',
          paddingLeft: '16px',
          paddingRight: '16px',
          backgroundColor: 'rgba(0,0,0,0.7)',
        }}
      >
        <div
          style={{
            position: 'relative',
            backgroundColor: '#111827',
            border: '1px solid #1f3048',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '360px',
            zIndex: 1,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '14px' }}>
              Patient Self Check-In
            </span>
            <button
              onClick={() => setShow(false)}
              style={{ color: '#64748b', cursor: 'pointer', background: 'none', border: 'none' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* QR Code */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px' }}>
              <QRCodeSVG value={checkinUrl} size={180} level="H" includeMargin={false} />
            </div>
          </div>

          {/* Description */}
          <p style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', marginBottom: '12px' }}>
            Patients scan this to self-register and join the queue
          </p>

          {/* URL */}
          <div style={{ backgroundColor: '#1a2436', borderRadius: '10px', padding: '8px 12px', marginBottom: '16px' }}>
            <p style={{ color: '#94a3b8', fontSize: '11px', fontFamily: 'monospace', textAlign: 'center', wordBreak: 'break-all' }}>
              {checkinUrl}
            </p>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => {
                navigator.clipboard.writeText(checkinUrl)
                emitToast({ message: 'Link copied!', type: 'success' })
              }}
            >
              Copy Link
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={() => window.open(checkinUrl, '_blank')}
            >
              Open Page
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── MAIN RECEPTIONIST DASHBOARD ─────────────────────────────────────────────

export default function ReceptionistDashboard() {
  const navigate    = useNavigate()
  const clinicId    = useClinicId()
  const clinic      = useClinic()
  const doctors     = useDoctors()
  const tokens      = useTokens()
  const session     = useSession()
  const stats       = useTodayStats()
  const isOpen      = useIsQueueOpen()
  const recentDone  = useRecentlyCompleted(3)

  const [addModalOpen,  setAddModalOpen]  = useState(false)
  const [loadingMap,    setLoadingMap]    = useState({})
  const [lastAdded,     setLastAdded]     = useState(null)

  // Real-time listeners
  useRealtimeAll(clinicId)

  // Operations
  const { callNext, complete, skip, noShow, reEnter } = useQueueOperations()
  const { execute: updateStatus  } = useUpdateDoctorStatus()
  const { execute: openSession   } = useOpenSession()
  const { execute: closeSession  } = useCloseSession()

  const setLoading = (key, val) => setLoadingMap((m) => ({ ...m, [key]: val }))

  // ── Handlers ──

  const handleOpenQueue = async () => {
    const result = await openSession(clinicId)
    if (result.success) emitToast({ message: 'Queue is now open', type: 'success' })
    else emitToast({ message: result.error, type: 'error' })
  }

  const handleCloseQueue = () => {
    closeSession(clinicId, (result) => {
      if (result?.success) emitToast({ message: 'Queue closed. Daily summary saved.', type: 'success' })
      else emitToast({ message: result?.error ?? 'Failed to close queue', type: 'error' })
    })
  }

  const handleCallNext = async (doctorId) => {
    setLoading(`callNext_${doctorId}`, true)
    const result = await callNext.execute(clinicId, doctorId)
    setLoading(`callNext_${doctorId}`, false)
    if (result.success) emitToast({ message: `Called ${result.data?.displayToken}`, type: 'success' })
    else emitToast({ message: result.error, type: 'error' })
  }

  const handleComplete = async (doctorId, tokenId) => {
    setLoading(`complete_${doctorId}`, true)
    const result = await complete.execute(clinicId, doctorId, tokenId)
    setLoading(`complete_${doctorId}`, false)
    if (result.success) emitToast({ message: 'Consultation marked complete', type: 'success' })
    else emitToast({ message: result.error, type: 'error' })
  }

  const handleStatusChange = async (doctorId, status) => {
    const result = await updateStatus.execute(clinicId, doctorId, status)
    if (!result.success) emitToast({ message: result.error, type: 'error' })
  }

  const handleSkip = (token) => {
    skip.execute(clinicId, token.id, token.displayToken, (result) => {
      if (result?.success) emitToast({ message: `${token.displayToken} skipped`, type: 'warning' })
      else emitToast({ message: result?.error, type: 'error' })
    })
  }

  const handleNoShow = (token) => {
    noShow.execute(clinicId, token.id, token.displayToken, (result) => {
      if (result?.success) emitToast({ message: `${token.displayToken} marked no-show`, type: 'warning' })
      else emitToast({ message: result?.error, type: 'error' })
    })
  }

  const handleReEnter = async (token) => {
    const result = await reEnter.execute(clinicId, token.id)
    if (result.success) emitToast({ message: `${token.displayToken} re-entered queue`, type: 'success' })
    else emitToast({ message: result.error, type: 'error' })
  }

  const handleTokenAdded = (tokenData) => {
    setLastAdded(tokenData)
    setAddModalOpen(false)
    emitToast({ message: `Token ${tokenData.displayToken} issued`, type: 'success' })

    if (tokenData.printSlip) {
      const doctor = doctors.find((d) => d.id === tokenData.doctorId)
      printTokenSlip({
        displayToken: tokenData.displayToken,
        patientName:  tokenData.patientName,
        doctorName:   doctor?.name,
        clinicName:   clinic?.name,
        estimatedWait: tokenData.estimatedWait,
      })
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    localStorage.removeItem(STORAGE_KEYS.CLINIC_ID)
    localStorage.removeItem(STORAGE_KEYS.CLINIC_NAME)
    localStorage.removeItem(STORAGE_KEYS.USER_ROLE)
    localStorage.removeItem(STORAGE_KEYS.DOCTOR_ID)
    navigate('/login')
  }

  // Derived data
  const activeTokens   = tokens.filter((t) => [TOKEN_STATUS.WAITING, TOKEN_STATUS.CALLED, TOKEN_STATUS.IN_CONSULTATION].includes(t.status))
  const inactiveTokens = tokens.filter((t) => [TOKEN_STATUS.COMPLETED, TOKEN_STATUS.SKIPPED, TOKEN_STATUS.NO_SHOW].includes(t.status))
  const avgWait        = session?.avgWaitMinutes ?? null

  const today = getTodayDateString()

  return (
    <div className="min-h-screen bg-surface flex flex-col">

      {/* ── Top Nav ── */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-surface-border">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Left: brand + clinic */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100 truncate">{clinic?.name ?? 'QueueCure Pro'}</p>
              <p className="text-xs text-slate-500">{formatDateLabel(today)} · Receptionist</p>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Queue open / close */}
            {!isOpen ? (
              <Button variant="primary" size="sm" onClick={handleOpenQueue}>
                Open Queue
              </Button>
            ) : (
              <Button variant="danger" size="sm" onClick={handleCloseQueue}>
                Close Queue
              </Button>
            )}

            <QRPanel clinicId={clinicId} clinicName={clinic?.name} />

            <Button
              variant="secondary"
              size="sm"
              icon={Monitor}
              onClick={() => navigate(`/display/${clinicId}`)}
            >
              TV Display
            </Button>

            <Button
              variant="ghost"
              size="sm"
              icon={BarChart2}
              onClick={() => navigate('/analytics')}
            />

            <Button
              variant="ghost"
              size="sm"
              icon={LogOut}
              onClick={handleLogout}
            />
          </div>
        </div>
      </header>

      {/* ── Queue closed banner ── */}
      {!isOpen && session && (
        <div className="bg-amber-950/60 border-b border-amber-700/40 px-4 py-2.5 text-center">
          <p className="text-xs text-amber-300">
            Queue is closed for today. Open the queue to begin accepting patients.
          </p>
        </div>
      )}

      {/* ── Main 3-panel layout ── */}
      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 py-4 flex gap-4 min-h-0">

        {/* ── LEFT: Doctor status panel ── */}
        <aside className="w-72 shrink-0 flex flex-col gap-4 overflow-y-auto">
          <SectionHeader
            title="Doctors"
            subtitle={`${doctors.filter(d => d.status === DOCTOR_STATUS.AVAILABLE || d.status === DOCTOR_STATUS.IN_SESSION).length} of ${doctors.length} active`}
          />
          <DoctorStatusPanel
            doctors={doctors}
            tokens={tokens}
            onCallNext={handleCallNext}
            onComplete={handleComplete}
            onStatusChange={handleStatusChange}
            loadingMap={loadingMap}
          />
        </aside>

        {/* ── CENTRE: Queue management ── */}
        <section className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Stats */}
          <QuickStatsBar stats={stats} avgWait={avgWait} />

          {/* Currently being seen (across all doctors) */}
          {doctors.filter(d => d.status === DOCTOR_STATUS.IN_SESSION).map((doc) => {
            const currentTok = tokens.find(
              (t) => t.doctorId === doc.id && t.status === TOKEN_STATUS.IN_CONSULTATION
            )
            if (!currentTok) return null
            return (
              <NowServingBanner
                key={doc.id}
                token={currentTok}
                doctorName={doc.name}
              />
            )
          })}

          {/* Add patient + queue heading */}
          <div className="flex items-center justify-between gap-3">
            <SectionHeader
              title="Queue"
              subtitle={`${activeTokens.length} active · ${inactiveTokens.length} completed`}
              className="mb-0"
            />
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              disabled={!isOpen}
              onClick={() => setAddModalOpen(true)}
            >
              Add Patient
            </Button>
          </div>

          {/* Queue list */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <QueueManagementPanel
              activeTokens={activeTokens}
              inactiveTokens={inactiveTokens}
              doctors={doctors}
              onSkip={handleSkip}
              onNoShow={handleNoShow}
              onReEnter={handleReEnter}
            />
          </div>
        </section>

        {/* ── RIGHT: Quick info ── */}
        <aside className="w-64 shrink-0 flex flex-col gap-4 overflow-y-auto">

          {/* Last token issued */}
          {lastAdded && (
            <div className="bg-surface-card border border-emerald-700/50 rounded-2xl p-4 animate-fade-in">
              <p className="text-xs text-emerald-400 font-semibold mb-2">Last Issued</p>
              <TokenBadge displayToken={lastAdded.displayToken} status={TOKEN_STATUS.WAITING} size="lg" />
              {lastAdded.patientName && (
                <p className="text-xs text-slate-400 mt-2">{lastAdded.patientName}</p>
              )}
            </div>
          )}

          {/* Recently completed */}
          {recentDone.length > 0 && (
            <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">Recently Done</p>
              <div className="flex flex-col gap-2">
                {recentDone.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <TokenBadge displayToken={t.displayToken} status={t.status} size="sm" />
                    <span className="text-xs text-slate-500">
                      {t.actualConsultMinutes != null ? `${t.actualConsultMinutes}m` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Waiting room link */}
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">Patient Link</p>
            <p className="text-xs text-slate-400 mb-3 break-all font-mono">
              {buildPatientUrl(clinicId)}
            </p>
            <Button
              variant="secondary"
              size="xs"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(buildPatientUrl(clinicId))
                emitToast({ message: 'Patient link copied!', type: 'success' })
              }}
            >
              Copy Link
            </Button>
          </div>

          {/* Session info */}
          {session && (
            <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-3">Session</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Opened</span>
                  <span className="text-slate-300">{formatTime(session.openedAt) ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Max tokens</span>
                  <span className="text-slate-300">{session.maxTokensPerDay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className={isOpen ? 'text-emerald-400' : 'text-red-400'}>
                    {isOpen ? 'Open' : 'Closed'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* ── Add Patient Modal ── */}
      <AddPatientModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleTokenAdded}
        clinicId={clinicId}
        doctors={doctors}
      />
    </div>
  )
}