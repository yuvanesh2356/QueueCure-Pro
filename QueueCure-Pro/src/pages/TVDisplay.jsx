import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  onSnapshot, query, where, orderBy,
  doc, getDoc, collection,
} from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'
import { Stethoscope, Wifi, WifiOff, X } from 'lucide-react'

import { db, auth } from '@/config/firebase'
import { TOKEN_STATUS, DOCTOR_STATUS } from '@/config/constants'
import { getTodayDateString, formatTime, cn } from '@/utils/utils'

// ─── NOW SERVING HERO ─────────────────────────────────────────────────────────

function NowServingHero({ token, doctorName }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <p className="text-emerald-400 text-xl font-semibold uppercase tracking-[0.3em] mb-6">
        Now Being Seen
      </p>
      {token ? (
        <>
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-150" />
            <p className="relative font-mono font-black text-token-lg text-white leading-none tracking-tight drop-shadow-2xl">
              {token.displayToken}
            </p>
          </div>
          <p className="text-2xl text-teal-300 font-medium">{doctorName}</p>
          {token.patientName && (
            <p className="text-slate-500 text-lg mt-2">{token.patientName}</p>
          )}
          {token.consultationStartAt && (
            <p className="text-slate-600 text-base mt-1">
              Since {formatTime(token.consultationStartAt)}
            </p>
          )}
        </>
      ) : (
        <div className="text-center">
          <p className="font-mono font-black text-6xl text-slate-700 mb-3">—</p>
          <p className="text-slate-600 text-xl">{doctorName}</p>
          <p className="text-slate-700 text-base mt-1">Waiting for next patient</p>
        </div>
      )}
    </div>
  )
}

// ─── TOKEN BOARD ─────────────────────────────────────────────────────────────

function TVTokenBoard({ waiting, recentDone, totalWaiting }) {
  return (
    <div className="w-80 shrink-0 flex flex-col gap-4 h-full">

      {/* Next up */}
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5 flex-1">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Next Up</p>
        {waiting.length === 0 ? (
          <p className="text-slate-700 text-sm text-center py-8">Queue empty</p>
        ) : (
          <div className="space-y-3">
            {waiting.slice(0, 6).map((t, idx) => (
              <div
                key={t.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl',
                  idx === 0
                    ? 'bg-teal-950/60 border border-teal-700/40'
                    : 'bg-surface-raised'
                )}
              >
                <span className={cn(
                  'text-xs font-bold w-5 text-center',
                  idx === 0 ? 'text-teal-400' : 'text-slate-600'
                )}>
                  {idx + 1}
                </span>
                <span className={cn(
                  'font-mono font-bold text-base tracking-widest',
                  idx === 0 ? 'text-white' : 'text-slate-400'
                )}>
                  {t.displayToken}
                </span>
                {t.priority === 'emergency' && (
                  <span className="ml-auto text-xs text-red-400 font-semibold">⚡ EMRG</span>
                )}
                {t.priority === 'senior' && (
                  <span className="ml-auto text-xs text-purple-400 font-semibold">SR</span>
                )}
              </div>
            ))}
            {waiting.length > 6 && (
              <p className="text-xs text-slate-600 text-center">
                +{waiting.length - 6} more waiting
              </p>
            )}
          </div>
        )}
      </div>

      {/* Recently done */}
      {recentDone.length > 0 && (
        <div className="bg-surface-card border border-surface-border rounded-2xl p-5">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Completed</p>
          <div className="flex flex-wrap gap-2">
            {recentDone.map((t) => (
              <span key={t.id} className="font-mono text-sm font-bold text-emerald-700 line-through">
                {t.displayToken}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-teal-400">{totalWaiting}</p>
          <p className="text-xs text-slate-500 mt-1">Waiting</p>
        </div>
        <div className="bg-surface-card border border-surface-border rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-emerald-400">{recentDone.length}</p>
          <p className="text-xs text-slate-500 mt-1">Done Today</p>
        </div>
      </div>
    </div>
  )
}

// ─── MULTI-DOCTOR TV LAYOUT ───────────────────────────────────────────────────

function MultiDoctorBoard({ doctors, tokens }) {
  const today = getTodayDateString()

  return (
    <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden">
      {doctors.map((doctor) => {
        const current = tokens.find(
          (t) => t.doctorId === doctor.id && t.status === TOKEN_STATUS.IN_CONSULTATION
        )
        const waiting = tokens
          .filter((t) => t.doctorId === doctor.id && t.status === TOKEN_STATUS.WAITING)
          .sort((a, b) => {
            const pA = a.priority === 'emergency' ? 0 : a.priority === 'senior' ? 1 : 2
            const pB = b.priority === 'emergency' ? 0 : b.priority === 'senior' ? 1 : 2
            return pA !== pB ? pA - pB : a.tokenNumber - b.tokenNumber
          })

        const isUnavailable = doctor.status === DOCTOR_STATUS.UNAVAILABLE

        return (
          <div
            key={doctor.id}
            className={cn(
              'flex flex-col bg-surface-card border rounded-3xl p-8 overflow-hidden',
              current
                ? 'border-emerald-700/60'
                : isUnavailable
                  ? 'border-slate-700/40 opacity-50'
                  : 'border-surface-border'
            )}
          >
            {/* Doctor header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xl font-bold text-slate-100">{doctor.name}</p>
                <p className="text-slate-500 text-sm">{doctor.specialization}</p>
              </div>
              <div className={cn(
                'w-3 h-3 rounded-full',
                doctor.status === DOCTOR_STATUS.IN_SESSION  ? 'bg-emerald-500 animate-pulse' :
                doctor.status === DOCTOR_STATUS.AVAILABLE   ? 'bg-emerald-600'               :
                doctor.status === DOCTOR_STATUS.ON_BREAK    ? 'bg-amber-500'                 :
                'bg-slate-600'
              )} />
            </div>

            {/* Current token */}
            <div className="text-center flex-1 flex flex-col items-center justify-center">
              <p className="text-xs text-slate-600 uppercase tracking-widest mb-3">Now Serving</p>
              {current ? (
                <>
                  <p className="font-mono font-black text-7xl text-emerald-400 leading-none mb-2">
                    {current.displayToken}
                  </p>
                  {current.patientName && (
                    <p className="text-slate-400 text-base">{current.patientName}</p>
                  )}
                </>
              ) : isUnavailable ? (
                <p className="text-3xl font-bold text-slate-700">Unavailable</p>
              ) : (
                <p className="text-3xl font-bold text-slate-700">—</p>
              )}
            </div>

            {/* Next tokens */}
            {waiting.length > 0 && (
              <div className="mt-6 flex items-center gap-2">
                <p className="text-xs text-slate-600">Next:</p>
                {waiting.slice(0, 5).map((t) => (
                  <span key={t.id} className="font-mono text-sm font-bold text-slate-500">
                    {t.displayToken}
                  </span>
                ))}
                {waiting.length > 5 && (
                  <span className="text-xs text-slate-600">+{waiting.length - 5}</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── MAIN TV DISPLAY ─────────────────────────────────────────────────────────

export default function TVDisplay() {
const { clinicId } = useParams()

  const [clinic,    setClinic]    = useState(null)
  const [tokens,    setTokens]    = useState([])
  const [doctors,   setDoctors]   = useState([])
  const [session,   setSession]   = useState(null)
  const [connected, setConnected] = useState(true)
  const [clock,     setClock]     = useState(new Date())

  const today = getTodayDateString()

  // Clock
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

// Only sign in anonymously if no user is currently authenticated
useEffect(() => {
  import('@/config/firebase').then(({ auth }) => {
    if (!auth.currentUser) {
      signInAnonymously(auth).catch(() => {})
    }
  })
}, [])

  // Clinic
  useEffect(() => {
    if (!clinicId) return
    getDoc(doc(db, 'clinics', clinicId))
      .then((snap) => { if (snap.exists()) setClinic({ id: snap.id, ...snap.data() }) })
  }, [clinicId])

  // Tokens
  useEffect(() => {
    if (!clinicId) return
    const unsub = onSnapshot(
      query(
        collection(db, 'clinics', clinicId, 'tokens'),
        where('sessionDate', '==', today),
        orderBy('tokenNumber', 'asc')
      ),
      (snap) => { setTokens(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setConnected(true) },
      ()    => setConnected(false)
    )
    return () => unsub()
  }, [clinicId, today])

  // Doctors
  useEffect(() => {
    if (!clinicId) return
    const unsub = onSnapshot(
      query(collection(db, 'clinics', clinicId, 'doctors'), orderBy('order', 'asc')),
      (snap) => setDoctors(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return () => unsub()
  }, [clinicId])

  // Session
  useEffect(() => {
    if (!clinicId) return
    const unsub = onSnapshot(
      doc(db, 'clinics', clinicId, 'sessions', today),
      (snap) => { if (snap.exists()) setSession({ id: snap.id, ...snap.data() }) }
    )
    return () => unsub()
  }, [clinicId, today])

  // Derived data
  const allWaiting   = tokens.filter((t) => t.status === TOKEN_STATUS.WAITING)
  const recentDone   = tokens
    .filter((t) => t.status === TOKEN_STATUS.COMPLETED)
    .sort((a, b) => (b.consultationEndAt?.seconds ?? 0) - (a.consultationEndAt?.seconds ?? 0))
    .slice(0, 8)

  const timeStr = clock.toLocaleTimeString('en-IN', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })

  const isMultiDoctor = doctors.length > 1

  // Single doctor data
  const singleDoctor = doctors[0] ?? null
  const singleCurrent = singleDoctor
    ? tokens.find((t) => t.doctorId === singleDoctor.id && t.status === TOKEN_STATUS.IN_CONSULTATION)
    : null
  const singleWaiting = singleDoctor
    ? allWaiting
        .filter((t) => t.doctorId === singleDoctor.id)
        .sort((a, b) => {
          const pA = a.priority === 'emergency' ? 0 : a.priority === 'senior' ? 1 : 2
          const pB = b.priority === 'emergency' ? 0 : b.priority === 'senior' ? 1 : 2
          return pA !== pB ? pA - pB : a.tokenNumber - b.tokenNumber
        })
    : []

  return (
    <div className="min-h-screen bg-surface flex flex-col select-none overflow-hidden">

      {/* Top bar */}
<header className="flex items-center justify-between px-8 py-4 border-b border-surface-border shrink-0">
<div className="flex items-center gap-4">

  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
      <Stethoscope className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-xl font-bold text-slate-100">{clinic?.name ?? 'QueueCure'}</p>
      <p className="text-xs text-slate-500">Live Queue Display</p>
    </div>
  </div>
</div>

        <div className="flex items-center gap-6">
          {!connected && (
            <div className="flex items-center gap-1.5 text-red-400 text-sm">
              <WifiOff className="w-4 h-4" />
              Reconnecting…
            </div>
          )}
          {connected && (
            <div className="flex items-center gap-1.5 text-emerald-500 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live
            </div>
          )}
          <div className="flex items-center gap-4">
  <p className="font-mono text-2xl font-bold text-slate-200">{timeStr}</p>
  <button
    onClick={() => {
      sessionStorage.setItem('qc_returning_from_tv', 'true')
      window.location.href = '/receptionist'
    }}
    className="w-8 h-8 rounded-lg bg-red-600 hover:bg-red-700 flex items-center justify-center text-white transition-all"
    title="Back to dashboard"
  >
    <X className="w-4 h-4" />
  </button>
</div>
        </div>
      </header>

      {/* Welcome message */}
      {session?.tvDisplayMessage && (
        <div className="bg-emerald-950/40 border-b border-emerald-900/40 px-8 py-2.5 text-center">
          <p className="text-sm text-emerald-400">{session.tvDisplayMessage}</p>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 px-8 py-6 flex gap-6 min-h-0">
        {isMultiDoctor ? (
          <MultiDoctorBoard doctors={doctors} tokens={tokens} />
        ) : (
          <>
            <NowServingHero
              token={singleCurrent}
              doctorName={singleDoctor?.name ?? ''}
            />
            <TVTokenBoard
              waiting={singleWaiting}
              recentDone={recentDone}
              totalWaiting={allWaiting.length}
            />
          </>
        )}
      </main>

      {/* Bottom ticker */}
      <footer className="border-t border-surface-border px-8 py-3 flex items-center justify-between shrink-0">
        <p className="text-xs text-slate-600">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' })}
        </p>
        <p className="text-xs text-slate-700">Powered by QueueCure Pro</p>
        <p className="text-xs text-slate-600">
          {allWaiting.length} waiting · {recentDone.length} done today
        </p>
      </footer>
    </div>
  )
}