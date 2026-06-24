import { useState, useCallback } from 'react'
import { useStore } from '@/store/store'
import {
  addToken,
  callNextToken,
  completeConsultation,
  skipToken,
  markNoShow,
  reEnterToken,
  updateDoctorStatus,
  openSession,
  closeSession,
} from '@/services/firebase.services'

// ─── SHARED OPERATION WRAPPER ─────────────────────────────────────────────────

/**
 * Returns a wrapped async function that handles loading/error state
 * and surfaces errors via the global store confirm dialog or a local state.
 */
function useOperation(fn) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const openConfirmDialog = useStore((s) => s.openConfirmDialog)

  const execute = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn(...args)
      return { success: true, data: result }
    } catch (err) {
      const message = err?.message ?? 'An unexpected error occurred.'
      setError(message)
      console.error(`[useOperation] ${fn.name ?? 'operation'} failed:`, err)
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [fn])

  return { execute, loading, error, clearError: () => setError(null) }
}

// ─── TOKEN OPERATIONS ─────────────────────────────────────────────────────────

export function useAddToken() {
  return useOperation(addToken)
}

export function useCallNext() {
  const { execute: callNext, loading, error, clearError } = useOperation(callNextToken)

  const execute = useCallback(
    (clinicId, doctorId) => callNext(clinicId, doctorId),
    [callNext]
  )

  return { execute, loading, error, clearError }
}

export function useCompleteConsultation() {
  const { execute: complete, loading, error, clearError } = useOperation(completeConsultation)

  const execute = useCallback(
    (clinicId, doctorId, tokenId) => complete(clinicId, doctorId, tokenId),
    [complete]
  )

  return { execute, loading, error, clearError }
}

export function useSkipToken() {
  const openConfirmDialog  = useStore((s) => s.openConfirmDialog)
  const closeConfirmDialog = useStore((s) => s.closeConfirmDialog)
  const { execute: skip, loading, error, clearError } = useOperation(skipToken)

  const executeWithConfirm = useCallback(
    (clinicId, tokenId, displayToken, onDone) => {
      openConfirmDialog({
        title:    `Skip Token ${displayToken}?`,
        message:  'This patient will be moved to the end of the queue if re-entered.',
        variant:  'warning',
        onConfirm: async () => {
          closeConfirmDialog()
          const result = await skip(clinicId, tokenId)
          if (onDone) onDone(result)
        },
      })
    },
    [skip, openConfirmDialog, closeConfirmDialog]
  )

  return { execute: executeWithConfirm, loading, error, clearError }
}

export function useMarkNoShow() {
  const openConfirmDialog  = useStore((s) => s.openConfirmDialog)
  const closeConfirmDialog = useStore((s) => s.closeConfirmDialog)
  const { execute: noShow, loading, error, clearError } = useOperation(markNoShow)

  const executeWithConfirm = useCallback(
    (clinicId, tokenId, displayToken, onDone) => {
      openConfirmDialog({
        title:    `Mark ${displayToken} as No-Show?`,
        message:  'The patient will be removed from the active queue. They can be re-entered if they return.',
        variant:  'destructive',
        onConfirm: async () => {
          closeConfirmDialog()
          const result = await noShow(clinicId, tokenId)
          if (onDone) onDone(result)
        },
      })
    },
    [noShow, openConfirmDialog, closeConfirmDialog]
  )

  return { execute: executeWithConfirm, loading, error, clearError }
}

export function useReEnterToken() {
  return useOperation(reEnterToken)
}

// ─── DOCTOR OPERATIONS ────────────────────────────────────────────────────────

export function useUpdateDoctorStatus() {
  return useOperation(updateDoctorStatus)
}

// ─── SESSION OPERATIONS ───────────────────────────────────────────────────────

export function useOpenSession() {
  return useOperation(openSession)
}

export function useCloseSession() {
  const openConfirmDialog  = useStore((s) => s.openConfirmDialog)
  const closeConfirmDialog = useStore((s) => s.closeConfirmDialog)
  const { execute: close, loading, error, clearError } = useOperation(closeSession)

  const executeWithConfirm = useCallback(
    (clinicId, onDone) => {
      openConfirmDialog({
        title:    'Close Queue for Today?',
        message:  'No new tokens can be added after closing. All current consultations should be completed first. This action cannot be undone.',
        variant:  'destructive',
        onConfirm: async () => {
          closeConfirmDialog()
          const result = await close(clinicId)
          if (onDone) onDone(result)
        },
      })
    },
    [close, openConfirmDialog, closeConfirmDialog]
  )

  return { execute: executeWithConfirm, loading, error, clearError }
}

// ─── COMPOSITE HOOK ───────────────────────────────────────────────────────────
/**
 * Returns all operation hooks in one object for pages that need several.
 * Avoids multiple hook calls in complex components.
 */
export function useQueueOperations() {
  const addTokenOp     = useAddToken()
  const callNextOp     = useCallNext()
  const completeOp     = useCompleteConsultation()
  const skipOp         = useSkipToken()
  const noShowOp       = useMarkNoShow()
  const reEnterOp      = useReEnterToken()

  return {
    addToken:    addTokenOp,
    callNext:    callNextOp,
    complete:    completeOp,
    skip:        skipOp,
    noShow:      noShowOp,
    reEnter:     reEnterOp,
  }
}