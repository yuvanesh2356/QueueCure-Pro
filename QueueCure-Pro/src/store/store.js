import { create } from 'zustand'
import { TOKEN_STATUS, ACTIVE_STATUSES, PRIORITY_ORDER, DOCTOR_STATUS } from '@/config/constants'
import { getTodayDateString, estimateWaitMinutes } from '@/utils/utils'

// ─── CLINIC SLICE ─────────────────────────────────────────────────────────────

const createClinicSlice = (set, get) => ({
  // State
  clinic:        null,
  clinicId:      localStorage.getItem('qc_clinic_id') ?? null,
  settings:      null,
  isClinicLoaded: false,

  // Actions
  setClinic: (clinic) => set({ clinic, isClinicLoaded: true }),
  setClinicId: (id) => {
    localStorage.setItem('qc_clinic_id', id)
    set({ clinicId: id })
  },
  setSettings: (settings) => set({ settings }),
  clearClinic: () => {
    localStorage.removeItem('qc_clinic_id')
    localStorage.removeItem('qc_clinic_name')
    set({ clinic: null, clinicId: null, settings: null, isClinicLoaded: false })
  },
})

// ─── AUTH SLICE ───────────────────────────────────────────────────────────────

const createAuthSlice = (set, get) => ({
  // State
  user:          null,
  staffProfile:  null,
  authLoading:   true,
  authError:     null,

  // Actions
  setUser: (user) => set({ user, authLoading: false, authError: null }),
  setStaffProfile: (profile) => {
    if (profile?.role) localStorage.setItem('qc_user_role', profile.role)
    if (profile?.doctorId) localStorage.setItem('qc_doctor_id', profile.doctorId)
    set({
  staffProfile: profile,
  role: profile?.role ?? null,
  doctorId: profile?.doctorId ?? null,
})
  },
  setAuthLoading: (loading) => set({ authLoading: loading }),
  setAuthError:   (error)   => set({ authError: error }),
  clearAuth: () => {
    localStorage.removeItem('qc_user_role')
    localStorage.removeItem('qc_doctor_id')
    set({
  user: null,
  staffProfile: null,
  role: null,
  doctorId: null,
  authError: null,
})
  },

  // Derived helpers
role: null,
doctorId: null,
})

// ─── DOCTORS SLICE ────────────────────────────────────────────────────────────

const createDoctorsSlice = (set, get) => ({
  // State
  doctors:        [],
  doctorsLoading: true,
  doctorsError:   null,

  // Actions
  setDoctors:       (doctors) => set({ doctors, doctorsLoading: false, doctorsError: null }),
  setDoctorsLoading: (v)      => set({ doctorsLoading: v }),
  setDoctorsError:   (e)      => set({ doctorsError: e, doctorsLoading: false }),

  // Derived selectors
  getDoctorById: (id) => get().doctors.find((d) => d.id === id) ?? null,
  getAvailableDoctors: () => get().doctors.filter((d) =>
    d.status !== DOCTOR_STATUS.UNAVAILABLE
  ),
})

// ─── QUEUE SLICE ──────────────────────────────────────────────────────────────

const createQueueSlice = (set, get) => ({
  // State
  tokens:       [],
  tokensLoading: true,
  tokensError:   null,

  // Actions
  setTokens: (tokens) => set({ tokens, tokensLoading: false, tokensError: null }),
  setTokensLoading: (v) => set({ tokensLoading: v }),
  setTokensError:   (e) => set({ tokensError: e, tokensLoading: false }),

  // Derived selectors — all computed from raw tokens array

  /** All active tokens (waiting, called, in_consultation) */
  getActiveTokens: () =>
    get().tokens
      .filter((t) => ACTIVE_STATUSES.includes(t.status))
      .sort((a, b) => {
        const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        return pDiff !== 0 ? pDiff : a.tokenNumber - b.tokenNumber
      }),

  /** Active tokens for a specific doctor */
  getTokensByDoctor: (doctorId) =>
    get().getActiveTokens().filter((t) => t.doctorId === doctorId),

  /** Currently in-consultation token for a doctor */
  getCurrentToken: (doctorId) =>
    get().tokens.find(
      (t) => t.doctorId === doctorId && t.status === TOKEN_STATUS.IN_CONSULTATION
    ) ?? null,

  /** Waiting tokens for a doctor (excludes in-consultation) */
  getWaitingTokens: (doctorId) =>
    get().getActiveTokens().filter(
      (t) => t.doctorId === doctorId && t.status === TOKEN_STATUS.WAITING
    ),

  /** Inactive tokens for recent history display */
  getRecentlyCompleted: (limit = 5) =>
    get().tokens
      .filter((t) => t.status === TOKEN_STATUS.COMPLETED)
      .sort((a, b) => (b.consultationEndAt?.seconds ?? 0) - (a.consultationEndAt?.seconds ?? 0))
      .slice(0, limit),

  /** Skipped and no-show tokens eligible for re-entry */
  getReEntryEligible: () =>
    get().tokens.filter(
      (t) => t.status === TOKEN_STATUS.SKIPPED || t.status === TOKEN_STATUS.NO_SHOW
    ),

  /** Estimated wait for a given token based on its doctor's rolling average */
  getEstimatedWait: (tokenId) => {
    const token   = get().tokens.find((t) => t.id === tokenId)
    if (!token || token.status !== TOKEN_STATUS.WAITING) return null

    const doctor  = get().getDoctorById?.(token.doctorId)
    if (!doctor) return null

    const waiting = get().getWaitingTokens(token.doctorId)
    const positionAhead = waiting.findIndex((t) => t.id === tokenId)
    if (positionAhead === -1) return null

    // Add 1 for the current in-consultation token
    const currentToken = get().getCurrentToken(token.doctorId)
    const slotsAhead   = positionAhead + (currentToken ? 1 : 0)

    return estimateWaitMinutes(doctor.avgConsultationMinutes, slotsAhead)
  },

  /** Token by ID */
  getTokenById: (id) => get().tokens.find((t) => t.id === id) ?? null,
})

// ─── SESSION SLICE ────────────────────────────────────────────────────────────

const createSessionSlice = (set, get) => ({
  // State
  session:        null,
  sessionLoading: true,
  sessionError:   null,

  // Actions
  setSession:        (session) => set({ session, sessionLoading: false, sessionError: null }),
  setSessionLoading: (v)       => set({ sessionLoading: v }),
  setSessionError:   (e)       => set({ sessionError: e, sessionLoading: false }),

  // Derived
  isQueueOpen:     () => get().session?.isOpen === true,
  getTodayStats:   () => {
    const s = get().session
    if (!s) return { issued: 0, completed: 0, skipped: 0, noShows: 0, waiting: 0 }
    const active  = get().getActiveTokens?.() ?? []
    return {
      issued:    s.totalTokensIssued   ?? 0,
      completed: s.totalCompleted      ?? 0,
      skipped:   s.totalSkipped        ?? 0,
      noShows:   s.totalNoShows        ?? 0,
      waiting:   active.filter((t) => t.status === TOKEN_STATUS.WAITING).length,
    }
  },
})

// ─── UI SLICE ─────────────────────────────────────────────────────────────────

const createUISlice = (set) => ({
  // State
  firestoreConnected: true,
  globalError:        null,
  confirmDialog: {
    open:     false,
    title:    '',
    message:  '',
    onConfirm: null,
    variant:  'default',
  },

  // Actions
  setFirestoreConnected: (v) => set({ firestoreConnected: v }),
  setGlobalError:        (e) => set({ globalError: e }),
  clearGlobalError:      ()  => set({ globalError: null }),

  openConfirmDialog: ({ title, message, onConfirm, variant = 'default' }) =>
    set({ confirmDialog: { open: true, title, message, onConfirm, variant } }),

  closeConfirmDialog: () =>
    set({ confirmDialog: { open: false, title: '', message: '', onConfirm: null, variant: 'default' } }),
})

// ─── COMBINED STORE ───────────────────────────────────────────────────────────

export const useStore = create((set, get) => ({
  ...createClinicSlice(set, get),
  ...createAuthSlice(set, get),
  ...createDoctorsSlice(set, get),
  ...createQueueSlice(set, get),
  ...createSessionSlice(set, get),
  ...createUISlice(set),
}))

// ─── SELECTOR HOOKS ───────────────────────────────────────────────────────────
// Fine-grained selectors prevent unnecessary re-renders

export const useClinicId      = ()  => useStore((s) => s.clinicId)
export const useClinic        = ()  => useStore((s) => s.clinic)
export const useSettings      = ()  => useStore((s) => s.settings)
export const useUser          = ()  => useStore((s) => s.user)
export const useStaffProfile  = ()  => useStore((s) => s.staffProfile)
export const useAuthLoading   = ()  => useStore((s) => s.authLoading)
export const useDoctors       = ()  => useStore((s) => s.doctors)
export const useTokens        = ()  => useStore((s) => s.tokens)
export const useSession       = ()  => useStore((s) => s.session)
export const useIsQueueOpen   = ()  => useStore((s) => s.session?.isOpen === true)
export const useConfirmDialog = ()  => useStore((s) => s.confirmDialog)
export const useFirestoreConnected = () => useStore((s) => s.firestoreConnected)
export const useGlobalError   = ()  => useStore((s) => s.globalError)

export const useTodayStats    = ()  => useStore((s) => {
  const session = s.session
  const tokens  = s.tokens
  if (!session) return { issued: 0, completed: 0, skipped: 0, noShows: 0, waiting: 0 }
  return {
    issued:    session.totalTokensIssued ?? 0,
    completed: session.totalCompleted    ?? 0,
    skipped:   session.totalSkipped      ?? 0,
    noShows:   session.totalNoShows      ?? 0,
    waiting:   tokens.filter((t) => t.status === TOKEN_STATUS.WAITING).length,
  }
})

export const useActiveTokens  = () => useStore((s) => {
  return s.tokens
    .filter((t) => ACTIVE_STATUSES.includes(t.status))
    .sort((a, b) => {
      const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      return pDiff !== 0 ? pDiff : a.tokenNumber - b.tokenNumber
    })
})

export const useTokensByDoctor = (doctorId) => useStore((s) => {
  return s.tokens
    .filter((t) => ACTIVE_STATUSES.includes(t.status) && t.doctorId === doctorId)
    .sort((a, b) => {
      const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      return pDiff !== 0 ? pDiff : a.tokenNumber - b.tokenNumber
    })
})

export const useCurrentToken = (doctorId) => useStore((s) =>
  s.tokens.find((t) => t.doctorId === doctorId && t.status === TOKEN_STATUS.IN_CONSULTATION) ?? null
)

export const useWaitingTokens = (doctorId) => useStore((s) =>
  s.tokens
    .filter((t) => t.doctorId === doctorId && t.status === TOKEN_STATUS.WAITING)
    .sort((a, b) => {
      const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      return pDiff !== 0 ? pDiff : a.tokenNumber - b.tokenNumber
    })
)

export const useRecentlyCompleted = (n = 5) => useStore((s) =>
  s.tokens
    .filter((t) => t.status === TOKEN_STATUS.COMPLETED)
    .sort((a, b) => (b.consultationEndAt?.seconds ?? 0) - (a.consultationEndAt?.seconds ?? 0))
    .slice(0, n)
)

export const useReEntryEligible = () => useStore((s) =>
  s.tokens.filter(
    (t) => t.status === TOKEN_STATUS.SKIPPED || t.status === TOKEN_STATUS.NO_SHOW
  )
)