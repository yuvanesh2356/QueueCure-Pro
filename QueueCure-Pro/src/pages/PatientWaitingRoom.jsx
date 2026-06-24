import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  onSnapshot, query, where, orderBy,
  doc, getDoc, collection,
} from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'
import { Stethoscope, RefreshCw, Home } from 'lucide-react'

import { db, auth } from '@/config/firebase'
import { TOKEN_STATUS, PRIORITY_ORDER } from '@/config/constants'
import {
  cn, estimateWaitMinutes, formatEstimatedWait,
  getTodayDateString, formatTime,
} from '@/utils/utils'
import {
  LoadingSpinner, EmptyState,
} from '@/components/Shared'
import {
  CurrentTokenDisplay,
  WaitEstimateCard,
  QueuePositionBar,
  TokenStatusTracker,
  LiveIndicator,
  PatientTokenHero,
} from '@/components/PatientComponents'
import { TokenBadge, PriorityBadge } from '@/components/QueueComponents'

// ─── GENERAL ROOM VIEW (no personal token) ───────────────────────────────────

function GeneralRoomView({ tokens, doctors, clinic, session }) {
  const inConsultation = tokens.filter((t) => t.status === TOKEN_STATUS.IN_CONSULTATION)
  const waiting        = tokens.filter((t) => t.status === TOKEN_STATUS.WAITING)
  const recentDone     = tokens
    .filter((t) => t.status === TOKEN_STATUS.COMPLETED)
    .sort((a, b) => (b.consultationEndAt?.seconds ?? 0) - (a.consultationEndAt?.seconds ?? 0))
    .slice(0, 5)

  const getDoctorName = (id) => doctors.find((d) => d.id === id)?.name ?? ''
  const getDoctor     = (id) => doctors.find((d) => d.id === id) ?? null

  return (
    <div className="min-h-screen bg-surface flex flex-col">

      {/* Header */}
      <header className="bg-surface/95 backdrop-blur border-b border-surface-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">{clinic?.name ?? 'Clinic'}</p>
              <p className="text-xs text-slate-500">Waiting Room</p>
            </div>
          </div>
          <LiveIndicator />
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5 space-y-4">

        {/* Queue not open */}
        {!session?.isOpen && (
          <div className="bg-amber-950/40 border border-amber-700/40 rounded-2xl px-4 py-3 text-center">
            <p className="text-sm text-amber-300">Queue is currently closed.</p>
            <p className="text-xs text-amber-500 mt-0.5">Please check back when the clinic opens.</p>
          </div>
        )}

        {/* Now being seen — per doctor */}
        {doctors.length > 0 && (
          <div className="space-y-3">
            {doctors.map((doc) => {
              const current = inConsultation.find((t) => t.doctorId === doc.id)
              const docWaiting = waiting.filter((t) => t.doctorId === doc.id)

              return (
                <div key={doc.id} className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
                  {/* Doctor header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{doc.name}</p>
                      <p className="text-xs text-slate-500">{doc.specialization}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{docWaiting.length} waiting</p>
                      <p className="text-xs text-teal-400">
                        {docWaiting.length > 0
                          ? `Est. ${formatEstimatedWait(estimateWaitMinutes(doc.avgConsultationMinutes, docWaiting.length + (current ? 1 : 0)))}`
                          : 'No wait'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Now serving */}
                  <div className="px-4 py-3.5">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Now Serving</p>
                    {current ? (
                      <div className="flex items-center gap-3">
                        <TokenBadge displayToken={current.displayToken} status={current.status} size="xl" />
                        {current.priority !== 'normal' && <PriorityBadge priority={current.priority} />}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600 italic">No patient currently</p>
                    )}
                  </div>

                  {/* Next up */}
                  {docWaiting.length > 0 && (
                    <div className="px-4 pb-3.5 flex items-center gap-2">
                      <p className="text-xs text-slate-600">Next:</p>
                      {docWaiting.slice(0, 4).map((t) => (
                        <TokenBadge key={t.id} displayToken={t.displayToken} status={t.status} size="sm" />
                      ))}
                      {docWaiting.length > 4 && (
                        <span className="text-xs text-slate-500">+{docWaiting.length - 4} more</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Recently completed */}
        {recentDone.length > 0 && (
          <div className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Recently Completed</p>
            <div className="flex flex-wrap gap-2">
              {recentDone.map((t) => (
                <div key={t.id} className="flex items-center gap-1.5">
                  <TokenBadge displayToken={t.displayToken} status={t.status} size="sm" />
                  <span className="text-xs text-emerald-500">✓</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {tokens.length === 0 && session?.isOpen && (
          <EmptyState
            icon={Stethoscope}
            title="No patients yet"
            description="The queue is open and waiting for patients."
          />
        )}

        {/* Footer note */}
        <p className="text-xs text-slate-600 text-center pb-4">
          Updates automatically · No refresh needed
        </p>
      </main>
    </div>
  )
}

// ─── PERSONAL TOKEN VIEW ─────────────────────────────────────────────────────

function PersonalTokenView({ token, tokens, doctors, clinic }) {
  const doctor    = doctors.find((d) => d.id === token.doctorId) ?? null
  const waiting   = tokens.filter(
    (t) => t.doctorId === token.doctorId && t.status === TOKEN_STATUS.WAITING
  ).sort((a, b) => {
    const pA = PRIORITY_ORDER[a.priority] ?? 2
    const pB = PRIORITY_ORDER[b.priority] ?? 2
    return pA !== pB ? pA - pB : a.tokenNumber - b.tokenNumber
  })

  const myPosition  = waiting.findIndex((t) => t.id === token.id)
  const tokensAhead = myPosition >= 0 ? myPosition : 0

  return (
    <div className="min-h-screen bg-surface flex flex-col">

      {/* Header */}
      <header className="bg-surface/95 backdrop-blur border-b border-surface-border px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">{clinic?.name ?? 'Clinic'}</p>
              <p className="text-xs text-slate-500">Your Queue Status</p>
            </div>
          </div>
          <LiveIndicator />
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5">
        <PatientTokenHero
          token={token}
          doctor={doctor}
          position={tokensAhead + 1}
          totalWaiting={waiting.length}
        />

        {/* Helpful note */}
        <p className="text-xs text-slate-600 text-center mt-6">
          Keep this page open · Updates in real time · No refresh needed
        </p>
      </main>
    </div>
  )
}

// ─── MAIN PATIENT WAITING ROOM ────────────────────────────────────────────────

export default function PatientWaitingRoom() {
  const { clinicId, tokenId } = useParams()

  const [clinic,  setClinic]  = useState(null)
  const [tokens,  setTokens]  = useState([])
  const [doctors, setDoctors] = useState([])
  const [session, setSession] = useState(null)
  const [myToken, setMyToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const today = getTodayDateString()

  // Anonymous auth so Firestore rules allow read
  useEffect(() => {
    signInAnonymously(auth).catch((e) => console.warn('[PatientView] Anonymous auth failed:', e))
  }, [])

  // Load clinic info
  useEffect(() => {
    if (!clinicId) return
    getDoc(doc(db, 'clinics', clinicId))
      .then((snap) => { if (snap.exists()) setClinic({ id: snap.id, ...snap.data() }) })
      .catch((e)  => setError('Could not load clinic information.'))
  }, [clinicId])

  // Subscribe to tokens
  useEffect(() => {
    if (!clinicId) return

    const q = query(
      collection(db, 'clinics', clinicId, 'tokens'),
      where('sessionDate', '==', today),
      orderBy('tokenNumber', 'asc')
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setTokens(all)
        if (tokenId) setMyToken(all.find((t) => t.id === tokenId) ?? null)
        setLoading(false)
      },
      (e) => { setError('Real-time connection failed.'); setLoading(false) }
    )

    return () => unsub()
  }, [clinicId, tokenId, today])

  // Subscribe to doctors
  useEffect(() => {
    if (!clinicId) return
    const q = query(
      collection(db, 'clinics', clinicId, 'doctors'),
      orderBy('order', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setDoctors(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [clinicId])

  // Subscribe to session
  useEffect(() => {
    if (!clinicId) return
    const unsub = onSnapshot(
      doc(db, 'clinics', clinicId, 'sessions', today),
      (snap) => { if (snap.exists()) setSession({ id: snap.id, ...snap.data() }) }
    )
    return () => unsub()
  }, [clinicId, today])

  if (!clinicId) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <EmptyState icon={Home} title="Invalid link" description="This waiting room link is not valid." />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <LoadingSpinner size="lg" label="Connecting to waiting room…" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-xs text-emerald-400 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // Show personal token view if tokenId in URL and token found
  if (tokenId && myToken) {
    return (
      <PersonalTokenView
        token={myToken}
        tokens={tokens}
        doctors={doctors}
        clinic={clinic}
      />
    )
  }

  // Token not found but ID was specified
  if (tokenId && !myToken && !loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <EmptyState
          icon={Stethoscope}
          title="Token not found"
          description="Your token may have been completed or this link is outdated."
          action={
            <button
              onClick={() => window.location.href = `/wait/${clinicId}`}
              className="text-sm text-emerald-400 hover:underline"
            >
              View general waiting room
            </button>
          }
        />
      </div>
    )
  }

  return (
    <GeneralRoomView
      tokens={tokens}
      doctors={doctors}
      clinic={clinic}
      session={session}
    />
  )
}