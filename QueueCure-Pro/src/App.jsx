import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'
import {
  onAuthStateChanged,
  signInAnonymously,
} from 'firebase/auth'

import { auth } from '@/config/firebase'
import { useStore } from '@/store/store'
import { getStaffMember } from '@/services/firebase.services'
import { ROLE, STORAGE_KEYS, ROUTES } from '@/config/constants'
import {
  AppErrorBoundary,
  ToastContainer,
  ConfirmDialog,
  ConnectionStatus,
  GlobalErrorBanner,
  PageLoader,
} from '@/components/Shared'

// ─── PAGE IMPORTS (lazy for code splitting) ───────────────────────────────────

import ReceptionistDashboard from '@/pages/ReceptionistDashboard'
import DoctorDashboard       from '@/pages/DoctorDashboard'
import PatientWaitingRoom    from '@/pages/PatientWaitingRoom'
import TVDisplay             from '@/pages/TVDisplay'
import AnalyticsDashboard    from '@/pages/AnalyticsDashboard'

// Auth pages are lightweight — import directly
import { SetupPage, LoginPage } from '@/pages/AuthPages'

// ─── 404 PAGE ─────────────────────────────────────────────────────────────────

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-card border border-surface-border flex items-center justify-center mb-6">
        <span className="text-2xl font-black text-slate-600 font-mono">404</span>
      </div>
      <h1 className="text-xl font-bold text-slate-200 mb-2">Page not found</h1>
      <p className="text-sm text-slate-500 mb-6 max-w-xs">
        The page you are looking for does not exist or has been moved.
      </p>
      <a
        href="/"
        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
      >
        Go to Home
      </a>
    </div>
  )
}

// ─── ROUTE TRANSITION WRAPPER ─────────────────────────────────────────────────

function RouteTransition({ children }) {
  const location = useLocation()
  return (
    <div key={location.pathname} className="animate-fade-in flex-1 flex flex-col min-h-0">
      {children}
    </div>
  )
}

// ─── PROTECTED ROUTE ──────────────────────────────────────────────────────────

function ProtectedRoute({ children, allowedRoles = [] }) {
  const user         = useStore((s) => s.user)
  const staffProfile = useStore((s) => s.staffProfile)
  const authLoading  = useStore((s) => s.authLoading)
  const clinicId     = useStore((s) => s.clinicId)
  const [extraWait,  setExtraWait] = useState(false)

  useEffect(() => {
    const returning = sessionStorage.getItem('qc_returning_from_tv')
    if (returning) {
      sessionStorage.removeItem('qc_returning_from_tv')
      setExtraWait(true)
      setTimeout(() => setExtraWait(false), 2000)
    }
  }, [])

  if (authLoading || extraWait) {
    return <PageLoader label="Loading dashboard…" />
  }

  if (!user || user.isAnonymous) {
    return <Navigate to="/login" replace />
  }

  if (!clinicId) {
    return <Navigate to="/setup" replace />
  }

  if (allowedRoles.length > 0 && !staffProfile) {
    return <PageLoader label="Loading profile…" />
  }

  if (allowedRoles.length > 0 && staffProfile && !allowedRoles.includes(staffProfile.role)) {
    if (staffProfile.role === ROLE.DOCTOR) {
      return <Navigate to="/doctor" replace />
    }
    return <Navigate to="/receptionist" replace />
  }

  return children
}
// ─── PUBLIC ROUTE (redirect authenticated users) ──────────────────────────────

function PublicRoute({ children }) {
  const user        = useStore((s) => s.user)
  const authLoading = useStore((s) => s.authLoading)
  const staffProfile = useStore((s) => s.staffProfile)
  const clinicId    = useStore((s) => s.clinicId)

  if (authLoading) {
    return <PageLoader label="Loading…" />
  }

  // If authenticated staff with clinic, redirect to their dashboard
  if (user && !user.isAnonymous && clinicId && staffProfile) {
    if (staffProfile.role === ROLE.DOCTOR) {
      return <Navigate to="/doctor" replace />
    }
    return <Navigate to="/receptionist" replace />
  }

  return children
}

// ─── APP INITIALIZER ──────────────────────────────────────────────────────────

function AppInitializer({ children }) {
  const setUser          = useStore((s) => s.setUser)
  const setStaffProfile  = useStore((s) => s.setStaffProfile)
  const setClinicId      = useStore((s) => s.setClinicId)
  const setAuthLoading   = useStore((s) => s.setAuthLoading)
  const setAuthError     = useStore((s) => s.setAuthError)
  const clearAuth        = useStore((s) => s.clearAuth)
  const setGlobalError   = useStore((s) => s.setGlobalError)

  useEffect(() => {
    // Restore clinicId from localStorage on boot
    const storedClinicId = localStorage.getItem(STORAGE_KEYS.CLINIC_ID)
    if (storedClinicId) {
      setClinicId(storedClinicId)
    }

    // Firebase auth state listener
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser && !firebaseUser.isAnonymous) {
          // Authenticated staff user
          setUser(firebaseUser)

          const clinicId = localStorage.getItem(STORAGE_KEYS.CLINIC_ID)

          if (clinicId) {
            try {
              const profile = await getStaffMember(clinicId, firebaseUser.uid)
              if (profile) {
                setStaffProfile(profile)
              } else {
                // Staff record missing — could be first login after invite
                // Restore from localStorage as fallback
                const cachedRole     = localStorage.getItem(STORAGE_KEYS.USER_ROLE)
                const cachedDoctorId = localStorage.getItem(STORAGE_KEYS.DOCTOR_ID)
                if (cachedRole) {
                  setStaffProfile({
                    role:     cachedRole,
                    doctorId: cachedDoctorId ?? null,
                    name:     firebaseUser.displayName ?? '',
                    email:    firebaseUser.email ?? '',
                  })
                }
              }
            } catch (err) {
              console.error('[AppInitializer] Failed to load staff profile:', err)
              // Non-fatal: user is still authenticated, just no profile
              const cachedRole = localStorage.getItem(STORAGE_KEYS.USER_ROLE)
              if (cachedRole) {
                setStaffProfile({
                  role:     cachedRole,
                  doctorId: localStorage.getItem(STORAGE_KEYS.DOCTOR_ID) ?? null,
                  name:     firebaseUser.displayName ?? '',
                  email:    firebaseUser.email ?? '',
                })
              }
            }
          } else {
            setAuthLoading(false)
          }
        } else if (firebaseUser && firebaseUser.isAnonymous) {
          // Anonymous user (patient viewing waiting room)
          setUser(firebaseUser)
          setAuthLoading(false)
        } else {
          // Signed out
          clearAuth()
          setAuthLoading(false)
        }
      },
      (error) => {
        console.error('[AppInitializer] Auth error:', error)
        setAuthError(error.message)
        setAuthLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  return children
}

// ─── ROUTE MAP ────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* ── Default redirect ── */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* ── Public auth routes ── */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <RouteTransition>
              <LoginPage />
            </RouteTransition>
          </PublicRoute>
        }
      />

      <Route
        path="/setup"
        element={
          <RouteTransition>
            <SetupPage />
          </RouteTransition>
        }
      />

      {/* ── Protected staff routes ── */}
      <Route
        path="/receptionist"
        element={
          <ProtectedRoute allowedRoles={[ROLE.RECEPTIONIST, ROLE.ADMIN]}>
            <RouteTransition>
              <ReceptionistDashboard />
            </RouteTransition>
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor"
        element={
          <ProtectedRoute allowedRoles={[ROLE.DOCTOR]}>
            <RouteTransition>
              <DoctorDashboard />
            </RouteTransition>
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={[ROLE.RECEPTIONIST, ROLE.ADMIN]}>
            <RouteTransition>
              <AnalyticsDashboard />
            </RouteTransition>
          </ProtectedRoute>
        }
      />

      {/* ── Public patient routes (no auth required, anonymous) ── */}
      <Route
        path="/wait/:clinicId"
        element={
          <RouteTransition>
            <PatientWaitingRoom />
          </RouteTransition>
        }
      />

      <Route
        path="/wait/:clinicId/:tokenId"
        element={
          <RouteTransition>
            <PatientWaitingRoom />
          </RouteTransition>
        }
      />

      {/* ── QR check-in (redirects to waiting room after) ── */}
      <Route
        path="/checkin/:clinicId"
        element={
          <RouteTransition>
            <PatientWaitingRoom />
          </RouteTransition>
        }
      />

      {/* ── TV display (public, no auth) ── */}
      <Route
        path="/display/:clinicId"
        element={
          <RouteTransition>
            <TVDisplay />
          </RouteTransition>
        }
      />

      {/* ── 404 ── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AppInitializer>
          {/* Global overlays — always mounted */}
          <ConfirmDialog />
          <ToastContainer />
          <ConnectionStatus />
          <GlobalErrorBanner />

          {/* Route tree */}
          <AppRoutes />
        </AppInitializer>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}