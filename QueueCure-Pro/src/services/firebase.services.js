import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import {
  TOKEN_STATUS,
  DOCTOR_STATUS,
  PRIORITY,
  PRIORITY_ORDER,
  CHECKIN_METHOD,
  DEFAULTS,
  ROLE,
} from '@/config/constants'
import {
  formatTokenDisplay,
  getTodayDateString,
  computeRollingAverage,
} from '@/utils/utils'

// ─── COLLECTION REFS ─────────────────────────────────────────────────────────

export const clinicRef       = (clinicId) => doc(db, 'clinics', clinicId)
export const doctorsRef      = (clinicId) => collection(db, 'clinics', clinicId, 'doctors')
export const doctorRef       = (clinicId, doctorId) => doc(db, 'clinics', clinicId, 'doctors', doctorId)
export const tokensRef       = (clinicId) => collection(db, 'clinics', clinicId, 'tokens')
export const tokenRef        = (clinicId, tokenId) => doc(db, 'clinics', clinicId, 'tokens', tokenId)
export const sessionsRef     = (clinicId) => collection(db, 'clinics', clinicId, 'sessions')
export const sessionRef      = (clinicId, date) => doc(db, 'clinics', clinicId, 'sessions', date)
export const settingsRef     = (clinicId) => doc(db, 'clinics', clinicId, 'settings', 'main')
export const staffRef        = (clinicId) => collection(db, 'clinics', clinicId, 'staff')
export const staffMemberRef  = (clinicId, uid) => doc(db, 'clinics', clinicId, 'staff', uid)

// ─── TOKEN SERVICES ──────────────────────────────────────────────────────────

/**
 * Adds a new patient token to the queue using a transaction to guarantee
 * sequential token numbers with no gaps or duplicates.
 */
export async function addToken({
  clinicId,
  doctorId,
  patientName  = null,
  patientPhone = null,
  priority     = PRIORITY.NORMAL,
  checkInMethod = CHECKIN_METHOD.RECEPTIONIST,
  notes        = null,
}) {
  const today = getTodayDateString()

  return await runTransaction(db, async (tx) => {
    // Read session to get next token number
    const sessionSnap = await tx.get(sessionRef(clinicId, today))
    if (!sessionSnap.exists()) {
      throw new Error('No active session for today. Please open the queue first.')
    }

    const session = sessionSnap.data()
    if (!session.isOpen) {
      throw new Error('The queue is closed for today. Please contact the receptionist.')
    }

    const nextNumber     = (session.totalTokensIssued ?? 0) + 1
    const maxTokens      = session.maxTokensPerDay ?? DEFAULTS.MAX_TOKENS_PER_DAY
    if (nextNumber > maxTokens) {
      throw new Error(`Maximum token limit (${maxTokens}) reached for today.`)
    }

    const displayToken   = formatTokenDisplay(nextNumber)
    const newTokenRef    = doc(tokensRef(clinicId))

    // Count current waiting tokens for this doctor to set initial queue position
    const waitingSnap = await getDocs(
      query(
        tokensRef(clinicId),
        where('doctorId',    '==', doctorId),
        where('sessionDate', '==', today),
        where('status',      'in', [TOKEN_STATUS.WAITING, TOKEN_STATUS.CALLED, TOKEN_STATUS.IN_CONSULTATION])
      )
    )
    const queuePosition = waitingSnap.size + 1

    const tokenData = {
      tokenNumber:        nextNumber,
      displayToken,
      patientName,
      patientPhone,
      doctorId,
      priority,
      status:             TOKEN_STATUS.WAITING,
      queuePosition,
      createdAt:          serverTimestamp(),
      calledAt:           null,
      consultationStartAt: null,
      consultationEndAt:  null,
      actualWaitMinutes:  null,
      actualConsultMinutes: null,
      sessionDate:        today,
      checkInMethod,
      notes,
    }

    tx.set(newTokenRef, tokenData)

    // Increment session counter and update per-doctor issued count
    const doctorStats = session.tokensByDoctor?.[doctorId] ?? { issued: 0, completed: 0, avgConsultMinutes: 0 }
    tx.update(sessionRef(clinicId, today), {
      totalTokensIssued: nextNumber,
      [`tokensByDoctor.${doctorId}.issued`]: (doctorStats.issued ?? 0) + 1,
    })

    return { tokenId: newTokenRef.id, tokenNumber: nextNumber, displayToken, queuePosition }
  })
}

/**
 * Calls the next waiting token for a specific doctor.
 * Respects priority order: Emergency → Senior → Normal.
 * Within same priority, earliest createdAt is called first.
 */
export async function callNextToken(clinicId, doctorId) {
  const today = getTodayDateString()

  return await runTransaction(db, async (tx) => {
    // Get doctor to verify availability
    const doctorSnap = await tx.get(doctorRef(clinicId, doctorId))
    if (!doctorSnap.exists()) throw new Error('Doctor not found.')

    const doctor = doctorSnap.data()
    if (doctor.status === DOCTOR_STATUS.UNAVAILABLE) {
      throw new Error('Doctor is marked unavailable.')
    }

    // If a token is currently in consultation, it must be completed first
    if (doctor.currentTokenId) {
      const currentSnap = await tx.get(tokenRef(clinicId, doctor.currentTokenId))
      if (currentSnap.exists() && currentSnap.data().status === TOKEN_STATUS.IN_CONSULTATION) {
        throw new Error('Please complete the current consultation before calling the next patient.')
      }
    }

    // Fetch all waiting tokens for this doctor today
    const waitingSnap = await getDocs(
      query(
        tokensRef(clinicId),
        where('doctorId',    '==', doctorId),
        where('sessionDate', '==', today),
        where('status',      '==', TOKEN_STATUS.WAITING)
      )
    )

    if (waitingSnap.empty) {
      throw new Error('No patients waiting in the queue.')
    }

    // Sort by priority then by token number (FIFO within same priority)
    const waitingTokens = waitingSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        return pDiff !== 0 ? pDiff : a.tokenNumber - b.tokenNumber
      })

    const next       = waitingTokens[0]
    const now        = Timestamp.now()
    const createdAt  = next.createdAt?.toDate?.() ?? new Date()
    const waitMins   = Math.round((now.toDate() - createdAt) / 60000)

    tx.update(tokenRef(clinicId, next.id), {
      status:            TOKEN_STATUS.IN_CONSULTATION,
      calledAt:          now,
      consultationStartAt: now,
      actualWaitMinutes: waitMins,
    })

    tx.update(doctorRef(clinicId, doctorId), {
      status:           DOCTOR_STATUS.IN_SESSION,
      currentTokenId:   next.id,
      sessionStartTime: now,
    })

    // Update queue positions for remaining waiting tokens
    waitingTokens.slice(1).forEach((t, idx) => {
      tx.update(tokenRef(clinicId, t.id), { queuePosition: idx + 1 })
    })

    return { tokenId: next.id, displayToken: next.displayToken }
  })
}

/**
 * Marks the current consultation as complete and updates rolling averages.
 */
export async function completeConsultation(clinicId, doctorId, tokenId) {
  const today = getTodayDateString()

  return await runTransaction(db, async (tx) => {
    const [tokenSnap, doctorSnap, sessionSnap] = await Promise.all([
      tx.get(tokenRef(clinicId, tokenId)),
      tx.get(doctorRef(clinicId, doctorId)),
      tx.get(sessionRef(clinicId, today)),
    ])

    if (!tokenSnap.exists())   throw new Error('Token not found.')
    if (!doctorSnap.exists())  throw new Error('Doctor not found.')
    if (!sessionSnap.exists()) throw new Error('Session not found.')

    const token   = tokenSnap.data()
    const doctor  = doctorSnap.data()
    const session = sessionSnap.data()
    const now     = Timestamp.now()

    const startTime   = token.consultationStartAt?.toDate?.() ?? now.toDate()
    const consultMins = Math.round((now.toDate() - startTime) / 60000)

    // Compute new rolling average for this doctor
    const prevAvg     = doctor.avgConsultationMinutes ?? DEFAULTS.CONSULTATION_MINUTES
    const prevCount   = doctor.consultationCount      ?? 0
    const newAvg      = computeRollingAverage(prevAvg, prevCount, consultMins, DEFAULTS.ROLLING_AVG_SAMPLE_SIZE)
    const newCount    = prevCount + 1

    tx.update(tokenRef(clinicId, tokenId), {
      status:              TOKEN_STATUS.COMPLETED,
      consultationEndAt:   now,
      actualConsultMinutes: consultMins,
    })

    tx.update(doctorRef(clinicId, doctorId), {
      status:               DOCTOR_STATUS.AVAILABLE,
      currentTokenId:       null,
      sessionStartTime:     null,
      avgConsultationMinutes: newAvg,
      consultationCount:    newCount,
    })

    // Update session aggregate stats
    const doctorStats     = session.tokensByDoctor?.[doctorId] ?? { issued: 0, completed: 0, avgConsultMinutes: 0 }
    const prevDoctorCompleted = doctorStats.completed ?? 0
    const prevDoctorAvg   = doctorStats.avgConsultMinutes ?? 0
    const newDoctorAvg    = prevDoctorCompleted === 0
      ? consultMins
      : Math.round((prevDoctorAvg * prevDoctorCompleted + consultMins) / (prevDoctorCompleted + 1))

    const newTotalCompleted = (session.totalCompleted ?? 0) + 1

    tx.update(sessionRef(clinicId, today), {
      totalCompleted: newTotalCompleted,
      [`tokensByDoctor.${doctorId}.completed`]:        prevDoctorCompleted + 1,
      [`tokensByDoctor.${doctorId}.avgConsultMinutes`]: newDoctorAvg,
    })

    return { consultMins, newAvg }
  })
}

/**
 * Skips a token (patient present but not responding when called).
 * Reorders remaining queue.
 */
export async function skipToken(clinicId, tokenId) {
  const today = getTodayDateString()

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(tokenRef(clinicId, tokenId))
    if (!snap.exists()) throw new Error('Token not found.')

    const token = snap.data()

    tx.update(tokenRef(clinicId, tokenId), {
      status:   TOKEN_STATUS.SKIPPED,
      calledAt: serverTimestamp(),
    })

    // If this token was in consultation on a doctor, free the doctor
    if (token.status === TOKEN_STATUS.IN_CONSULTATION && token.doctorId) {
      tx.update(doctorRef(clinicId, token.doctorId), {
        status:          DOCTOR_STATUS.AVAILABLE,
        currentTokenId:  null,
        sessionStartTime: null,
      })
    }

    // Reorder remaining waiting tokens for this doctor
    const waitingSnap = await getDocs(
      query(
        tokensRef(clinicId),
        where('doctorId',    '==', token.doctorId),
        where('sessionDate', '==', today),
        where('status',      '==', TOKEN_STATUS.WAITING)
      )
    )

    const sorted = waitingSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        return pDiff !== 0 ? pDiff : a.tokenNumber - b.tokenNumber
      })

    sorted.forEach((t, idx) => {
      tx.update(tokenRef(clinicId, t.id), { queuePosition: idx + 1 })
    })

    // Update session no-show/skip counter
    tx.update(sessionRef(clinicId, today), {
      totalSkipped: (await tx.get(sessionRef(clinicId, today))).data()?.totalSkipped + 1 ?? 1,
    })
  })
}

/**
 * Marks a token as no-show (patient did not arrive).
 */
export async function markNoShow(clinicId, tokenId) {
  const today = getTodayDateString()

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(tokenRef(clinicId, tokenId))
    if (!snap.exists()) throw new Error('Token not found.')

    const sessionSnap = await tx.get(sessionRef(clinicId, today))
    const sessionData = sessionSnap.data() ?? {}

    tx.update(tokenRef(clinicId, tokenId), {
      status: TOKEN_STATUS.NO_SHOW,
    })

    tx.update(sessionRef(clinicId, today), {
      totalNoShows: (sessionData.totalNoShows ?? 0) + 1,
    })
  })
}

/**
 * Re-enters a skipped or no-show token back into the waiting queue.
 * The token retains its original token number but gets a new queue position at the back.
 */
export async function reEnterToken(clinicId, tokenId) {
  const today = getTodayDateString()

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(tokenRef(clinicId, tokenId))
    if (!snap.exists()) throw new Error('Token not found.')

    const token = snap.data()
    const allowedStatuses = [TOKEN_STATUS.SKIPPED, TOKEN_STATUS.NO_SHOW]
    if (!allowedStatuses.includes(token.status)) {
      throw new Error('Only skipped or no-show tokens can be re-entered.')
    }

    const sessionSnap = await tx.get(sessionRef(clinicId, today))
    if (!sessionSnap.data()?.isOpen) {
      throw new Error('Cannot re-enter token. Queue is closed for today.')
    }

    // Count current active tokens for this doctor to set new position
    const activeSnap = await getDocs(
      query(
        tokensRef(clinicId),
        where('doctorId',    '==', token.doctorId),
        where('sessionDate', '==', today),
        where('status',      'in', [TOKEN_STATUS.WAITING, TOKEN_STATUS.IN_CONSULTATION])
      )
    )

    const newPosition = activeSnap.size + 1

    tx.update(tokenRef(clinicId, tokenId), {
      status:             TOKEN_STATUS.WAITING,
      queuePosition:      newPosition,
      calledAt:           null,
      consultationStartAt: null,
      consultationEndAt:  null,
      actualWaitMinutes:  null,
      actualConsultMinutes: null,
    })

    // Undo the no-show/skip counter
    const sessionData = sessionSnap.data() ?? {}
    if (token.status === TOKEN_STATUS.NO_SHOW) {
      tx.update(sessionRef(clinicId, today), {
        totalNoShows: Math.max(0, (sessionData.totalNoShows ?? 0) - 1),
      })
    } else if (token.status === TOKEN_STATUS.SKIPPED) {
      tx.update(sessionRef(clinicId, today), {
        totalSkipped: Math.max(0, (sessionData.totalSkipped ?? 0) - 1),
      })
    }
  })
}

// ─── DOCTOR SERVICES ─────────────────────────────────────────────────────────

export async function createDoctor(clinicId, { name, specialization, avgConsultationMinutes }) {
  const data = {
    name,
    specialization,
    isAvailable:            true,
    avgConsultationMinutes: avgConsultationMinutes ?? DEFAULTS.CONSULTATION_MINUTES,
    consultationCount:      0,
    currentTokenId:         null,
    status:                 DOCTOR_STATUS.AVAILABLE,
    sessionStartTime:       null,
    order:                  Date.now(),
    createdAt:              serverTimestamp(),
  }
  const ref = await addDoc(doctorsRef(clinicId), data)
  return { doctorId: ref.id, ...data }
}

export async function updateDoctorStatus(clinicId, doctorId, status) {
  const validStatuses = Object.values(DOCTOR_STATUS)
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid doctor status: ${status}`)
  }

  const updates = { status }
  if (status === DOCTOR_STATUS.AVAILABLE) {
    updates.isAvailable = true
  } else if (status === DOCTOR_STATUS.UNAVAILABLE || status === DOCTOR_STATUS.ON_BREAK) {
    updates.isAvailable = false
  }

  await updateDoc(doctorRef(clinicId, doctorId), updates)
}

export async function updateDoctorAvgTime(clinicId, doctorId, avgConsultationMinutes) {
  await updateDoc(doctorRef(clinicId, doctorId), { avgConsultationMinutes })
}

export async function getDoctors(clinicId) {
  const snap = await getDocs(query(doctorsRef(clinicId), orderBy('order', 'asc')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ─── SESSION SERVICES ─────────────────────────────────────────────────────────

export async function openSession(clinicId, { maxTokensPerDay } = {}) {
  const today = getTodayDateString()
  const ref   = sessionRef(clinicId, today)
  const snap  = await getDoc(ref)

  if (snap.exists() && snap.data().isOpen) {
    return { sessionDate: today, alreadyOpen: true }
  }

  const doctors = await getDoctors(clinicId)
  const tokensByDoctor = {}
  doctors.forEach((d) => {
    tokensByDoctor[d.id] = { issued: 0, completed: 0, avgConsultMinutes: d.avgConsultationMinutes ?? DEFAULTS.CONSULTATION_MINUTES }
  })

  const sessionData = {
    date:                today,
    isOpen:              true,
    openedAt:            serverTimestamp(),
    closedAt:            null,
    totalTokensIssued:   0,
    totalCompleted:      0,
    totalSkipped:        0,
    totalNoShows:        0,
    peakHour:            null,
    avgWaitMinutes:      null,
    avgConsultMinutes:   null,
    maxTokensPerDay:     maxTokensPerDay ?? DEFAULTS.MAX_TOKENS_PER_DAY,
    tokensByDoctor,
  }

  await setDoc(ref, sessionData, { merge: true })
  return { sessionDate: today, alreadyOpen: false }
}

export async function closeSession(clinicId) {
  const today       = getTodayDateString()
  const ref         = sessionRef(clinicId, today)
  const sessionSnap = await getDoc(ref)

  if (!sessionSnap.exists()) throw new Error('No session found for today.')

  // Compute final aggregates from completed tokens
  const completedSnap = await getDocs(
    query(
      tokensRef(clinicId),
      where('sessionDate', '==', today),
      where('status',      '==', TOKEN_STATUS.COMPLETED)
    )
  )

  const completedTokens = completedSnap.docs.map((d) => d.data())

  const avgWait    = completedTokens.length > 0
    ? Math.round(completedTokens.reduce((s, t) => s + (t.actualWaitMinutes ?? 0), 0) / completedTokens.length)
    : null

  const avgConsult = completedTokens.length > 0
    ? Math.round(completedTokens.reduce((s, t) => s + (t.actualConsultMinutes ?? 0), 0) / completedTokens.length)
    : null

  // Compute peak hour from token creation times
  const hourCounts = {}
  completedTokens.forEach((t) => {
    if (t.createdAt?.toDate) {
      const hour = t.createdAt.toDate().getHours()
      hourCounts[hour] = (hourCounts[hour] ?? 0) + 1
    }
  })
  const peakHour = Object.keys(hourCounts).length > 0
    ? parseInt(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0])
    : null

  await updateDoc(ref, {
    isOpen:           false,
    closedAt:         serverTimestamp(),
    avgWaitMinutes:   avgWait,
    avgConsultMinutes: avgConsult,
    peakHour,
  })

  return { avgWait, avgConsult, peakHour, totalCompleted: completedTokens.length }
}

export async function getSession(clinicId, date = null) {
  const d    = date ?? getTodayDateString()
  const snap = await getDoc(sessionRef(clinicId, d))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getRecentSessions(clinicId, days = 7) {
  const snap = await getDocs(
    query(sessionsRef(clinicId), orderBy('date', 'desc'), limit(days))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ─── SETTINGS SERVICES ───────────────────────────────────────────────────────

export async function getSettings(clinicId) {
  const snap = await getDoc(settingsRef(clinicId))
  return snap.exists() ? snap.data() : null
}

export async function saveSettings(clinicId, settings) {
  await setDoc(settingsRef(clinicId), settings, { merge: true })
}

export async function getClinic(clinicId) {
  const snap = await getDoc(clinicRef(clinicId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// ─── ANALYTICS SERVICES ──────────────────────────────────────────────────────

/**
 * Returns hourly token volume for a specific session date.
 * Used by the analytics dashboard bar chart.
 */
export async function getHourlyVolume(clinicId, date = null) {
  const d    = date ?? getTodayDateString()
  const snap = await getDocs(
    query(
      tokensRef(clinicId),
      where('sessionDate', '==', d)
    )
  )

  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour:      i,
    label:     `${i.toString().padStart(2, '0')}:00`,
    tokens:    0,
    completed: 0,
  }))

  snap.docs.forEach((d) => {
    const token = d.data()
    if (token.createdAt?.toDate) {
      const h = token.createdAt.toDate().getHours()
      hours[h].tokens += 1
      if (token.status === TOKEN_STATUS.COMPLETED) {
        hours[h].completed += 1
      }
    }
  })

  // Trim leading and trailing zero-activity hours for cleaner chart
  const nonZero = hours.filter((h) => h.tokens > 0)
  if (nonZero.length === 0) return hours.slice(8, 20) // Default 8am–8pm if no data
  const first = nonZero[0].hour
  const last  = nonZero[nonZero.length - 1].hour
  return hours.slice(Math.max(0, first - 1), Math.min(23, last + 2))
}

/**
 * Returns per-doctor stats for today.
 */
export async function getDoctorStats(clinicId, date = null) {
  const d       = date ?? getTodayDateString()
  const doctors = await getDoctors(clinicId)

  const tokenSnap = await getDocs(
    query(tokensRef(clinicId), where('sessionDate', '==', d))
  )
  const tokens = tokenSnap.docs.map((doc) => doc.data())

  return doctors.map((doctor) => {
    const doctorTokens  = tokens.filter((t) => t.doctorId === doctor.id)
    const completed     = doctorTokens.filter((t) => t.status === TOKEN_STATUS.COMPLETED)
    const avgConsult    = completed.length > 0
      ? Math.round(completed.reduce((s, t) => s + (t.actualConsultMinutes ?? 0), 0) / completed.length)
      : doctor.avgConsultationMinutes
    const avgWait       = completed.length > 0
      ? Math.round(completed.reduce((s, t) => s + (t.actualWaitMinutes ?? 0), 0) / completed.length)
      : null

    return {
      doctorId:       doctor.id,
      name:           doctor.name,
      specialization: doctor.specialization,
      issued:         doctorTokens.length,
      completed:      completed.length,
      skipped:        doctorTokens.filter((t) => t.status === TOKEN_STATUS.SKIPPED).length,
      noShows:        doctorTokens.filter((t) => t.status === TOKEN_STATUS.NO_SHOW).length,
      avgConsultMins: avgConsult,
      avgWaitMins:    avgWait,
    }
  })
}

// ─── CLINIC SETUP SERVICES ───────────────────────────────────────────────────

/**
 * Creates a brand new clinic with initial doctors and settings.
 * Called once from SetupPage. Returns the new clinicId.
 */
export async function createClinic({ name, address, phone, doctors, defaultConsultationMinutes }) {
  const batch    = writeBatch(db)
  const cRef     = doc(collection(db, 'clinics'))
  const clinicId = cRef.id

  batch.set(cRef, {
    name,
    address:   address ?? '',
    phone:     phone   ?? '',
    createdAt: serverTimestamp(),
    isActive:  true,
    plan:      'free',
    timezone:  'Asia/Kolkata',
  })

  // Default settings
  batch.set(settingsRef(clinicId), {
    defaultConsultationMinutes: defaultConsultationMinutes ?? DEFAULTS.CONSULTATION_MINUTES,
    maxTokensPerDay:            DEFAULTS.MAX_TOKENS_PER_DAY,
    qrCheckInEnabled:           true,
    whatsappNotificationsEnabled: false,
    notifyAtTokensAhead:        DEFAULTS.NOTIFY_TOKENS_AHEAD,
    displayName:                name,
    tvDisplayMessage:           `Welcome to ${name}. Please wait for your token number to be called.`,
    priorityLabels: {
      normal:    'General',
      senior:    'Senior Citizen',
      emergency: 'Emergency',
    },
  })

  // Create doctors
  const doctorIds = []
  doctors.forEach((d, idx) => {
    const dRef = doc(doctorsRef(clinicId))
    batch.set(dRef, {
      name:                   d.name,
      specialization:         d.specialization ?? 'General Physician',
      isAvailable:            true,
      avgConsultationMinutes: d.avgConsultationMinutes ?? defaultConsultationMinutes ?? DEFAULTS.CONSULTATION_MINUTES,
      consultationCount:      0,
      currentTokenId:         null,
      status:                 DOCTOR_STATUS.AVAILABLE,
      sessionStartTime:       null,
      order:                  idx,
      createdAt:              serverTimestamp(),
    })
    doctorIds.push(dRef.id)
  })

  await batch.commit()
  return { clinicId, doctorIds }
}

/**
 * Creates or updates a staff member record for a clinic.
 */
export async function upsertStaffMember(clinicId, uid, { role, name, email, doctorId = null }) {
  await setDoc(
    staffMemberRef(clinicId, uid),
    { role, name, email, doctorId, createdAt: serverTimestamp() },
    { merge: true }
  )
}

export async function getStaffMember(clinicId, uid) {
  const snap = await getDoc(staffMemberRef(clinicId, uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}