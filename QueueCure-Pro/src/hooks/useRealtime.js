import { useEffect, useRef } from 'react'
import {
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useStore } from '@/store/store'
import {
  tokensRef,
  doctorsRef,
  sessionRef,
  clinicRef,
  settingsRef,
} from '@/services/firebase.services'
import { getTodayDateString } from '@/utils/utils'

// ─── useRealtimeQueue ─────────────────────────────────────────────────────────
/**
 * Subscribes to all tokens for today's session.
 * Populates store.tokens via onSnapshot.
 * Returns unsubscribe fn; call it on unmount.
 */
export function useRealtimeQueue(clinicId) {
  const setTokens       = useStore((s) => s.setTokens)
  const setTokensLoading = useStore((s) => s.setTokensLoading)
  const setTokensError  = useStore((s) => s.setTokensError)
  const unsubRef        = useRef(null)

  useEffect(() => {
    if (!clinicId) {
      setTokensLoading(false)
      return
    }

    setTokensLoading(true)
    const today = getTodayDateString()

    const q = query(
      tokensRef(clinicId),
      where('sessionDate', '==', today),
      orderBy('tokenNumber', 'asc')
    )

    unsubRef.current = onSnapshot(
      q,
      (snap) => {
        const tokens = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setTokens(tokens)
      },
      (error) => {
        console.error('[useRealtimeQueue] Firestore error:', error)
        setTokensError(error.message)
      }
    )

    return () => {
      if (unsubRef.current) unsubRef.current()
    }
  }, [clinicId])
}

// ─── useRealtimeDoctors ───────────────────────────────────────────────────────
/**
 * Subscribes to all doctors for this clinic.
 * Populates store.doctors via onSnapshot.
 */
export function useRealtimeDoctors(clinicId) {
  const setDoctors       = useStore((s) => s.setDoctors)
  const setDoctorsLoading = useStore((s) => s.setDoctorsLoading)
  const setDoctorsError  = useStore((s) => s.setDoctorsError)
  const unsubRef         = useRef(null)

  useEffect(() => {
    if (!clinicId) {
      setDoctorsLoading(false)
      return
    }

    setDoctorsLoading(true)

    const q = query(doctorsRef(clinicId), orderBy('order', 'asc'))

    unsubRef.current = onSnapshot(
      q,
      (snap) => {
        const doctors = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setDoctors(doctors)
      },
      (error) => {
        console.error('[useRealtimeDoctors] Firestore error:', error)
        setDoctorsError(error.message)
      }
    )

    return () => {
      if (unsubRef.current) unsubRef.current()
    }
  }, [clinicId])
}

// ─── useRealtimeSession ───────────────────────────────────────────────────────
/**
 * Subscribes to today's session document.
 * Populates store.session via onSnapshot.
 */
export function useRealtimeSession(clinicId) {
  const setSession       = useStore((s) => s.setSession)
  const setSessionLoading = useStore((s) => s.setSessionLoading)
  const setSessionError  = useStore((s) => s.setSessionError)
  const unsubRef         = useRef(null)

  useEffect(() => {
    if (!clinicId) {
      setSessionLoading(false)
      return
    }

    setSessionLoading(true)
    const today = getTodayDateString()

    unsubRef.current = onSnapshot(
      sessionRef(clinicId, today),
      (snap) => {
        setSession(snap.exists() ? { id: snap.id, ...snap.data() } : null)
      },
      (error) => {
        console.error('[useRealtimeSession] Firestore error:', error)
        setSessionError(error.message)
      }
    )

    return () => {
      if (unsubRef.current) unsubRef.current()
    }
  }, [clinicId])
}

// ─── useRealtimeClinic ────────────────────────────────────────────────────────
/**
 * Subscribes to the clinic document and settings.
 * Populates store.clinic and store.settings.
 */
export function useRealtimeClinic(clinicId) {
  const setClinic   = useStore((s) => s.setClinic)
  const setSettings = useStore((s) => s.setSettings)
  const unsubClinic = useRef(null)
  const unsubSettings = useRef(null)

  useEffect(() => {
    if (!clinicId) return

    unsubClinic.current = onSnapshot(
      clinicRef(clinicId),
      (snap) => {
        if (snap.exists()) {
          setClinic({ id: snap.id, ...snap.data() })
          localStorage.setItem('qc_clinic_name', snap.data().name)
        }
      },
      (error) => console.error('[useRealtimeClinic] Firestore error:', error)
    )

    unsubSettings.current = onSnapshot(
      settingsRef(clinicId),
      (snap) => {
        if (snap.exists()) setSettings(snap.data())
      },
      (error) => console.error('[useRealtimeClinic/settings] Firestore error:', error)
    )

    return () => {
      if (unsubClinic.current)   unsubClinic.current()
      if (unsubSettings.current) unsubSettings.current()
    }
  }, [clinicId])
}

// ─── useRealtimeAll ───────────────────────────────────────────────────────────
/**
 * Convenience hook that activates all four real-time listeners at once.
 * Use this in authenticated layout components.
 */
export function useRealtimeAll(clinicId) {
  useRealtimeClinic(clinicId)
  useRealtimeDoctors(clinicId)
  useRealtimeQueue(clinicId)
  useRealtimeSession(clinicId)
}