import { DEFAULTS, PRIORITY_ORDER } from '@/config/constants'

// ─── TOKEN FORMATTING ─────────────────────────────────────────────────────────

/**
 * Formats a token number into a padded display string.
 * e.g. 7 → "T007", 42 → "T042"
 */
export function formatTokenDisplay(number) {
  return `${DEFAULTS.TOKEN_PREFIX}${String(number).padStart(DEFAULTS.TOKEN_PAD_LENGTH, '0')}`
}

/**
 * Extracts the numeric part from a display token.
 * e.g. "T007" → 7
 */
export function parseTokenNumber(displayToken) {
  return parseInt(displayToken.replace(DEFAULTS.TOKEN_PREFIX, ''), 10)
}

// ─── TIME FORMATTING ─────────────────────────────────────────────────────────

/**
 * Returns today's date as a YYYY-MM-DD string in IST (Asia/Kolkata).
 * This is used as the sessionDate key across all Firestore documents.
 */
export function getTodayDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

/**
 * Formats a Firestore Timestamp or JS Date to a human-readable time string.
 * e.g. 14:32
 */
export function formatTime(tsOrDate) {
  if (!tsOrDate) return '—'
  const d = tsOrDate?.toDate ? tsOrDate.toDate() : new Date(tsOrDate)
  return d.toLocaleTimeString('en-IN', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
}

/**
 * Formats a duration in minutes to a human-readable string.
 * e.g. 75 → "1h 15m", 8 → "8m"
 */
export function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes)) return '—'
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/**
 * Returns a live-updating elapsed time string from a start timestamp.
 * e.g. "4m 32s"
 * Pass the result of Date.now() - startMs as `elapsedMs`.
 */
export function formatElapsed(elapsedMs) {
  if (elapsedMs == null || elapsedMs < 0) return '—'
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes      = Math.floor(totalSeconds / 60)
  const seconds      = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`
}

/**
 * Formats a date string (YYYY-MM-DD) to a readable label.
 * e.g. "2026-06-19" → "Thu, 19 Jun"
 */
export function formatDateLabel(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00+05:30')
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
    timeZone: 'Asia/Kolkata',
  })
}

/**
 * Returns a relative time string.
 * e.g. "2 minutes ago", "just now"
 */
export function formatRelativeTime(tsOrDate) {
  if (!tsOrDate) return '—'
  const d       = tsOrDate?.toDate ? tsOrDate.toDate() : new Date(tsOrDate)
  const diffMs  = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1)  return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH   = Math.floor(diffMin / 60)
  if (diffH < 24)   return `${diffH}h ago`
  return formatDateLabel(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))
}

// ─── WAIT ESTIMATION ─────────────────────────────────────────────────────────

/**
 * Estimates wait time in minutes.
 * @param {number} avgConsultMinutes - Rolling average consultation duration for the doctor
 * @param {number} slotsAhead - Number of patients ahead including current in-session
 * @returns {number} Estimated wait in minutes, rounded to nearest DEFAULTS.WAIT_ROUND_TO_NEAREST
 */
export function estimateWaitMinutes(avgConsultMinutes, slotsAhead) {
  if (!avgConsultMinutes || slotsAhead <= 0) return 0
  const raw     = avgConsultMinutes * slotsAhead
  const nearest = DEFAULTS.WAIT_ROUND_TO_NEAREST
  return Math.max(nearest, Math.round(raw / nearest) * nearest)
}

/**
 * Returns a human-readable estimated wait string.
 * e.g. "~ 15 min", "< 5 min"
 */
export function formatEstimatedWait(minutes) {
  if (minutes == null || minutes === 0) return '< 5 min'
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `~ ${h}h ${m}m` : `~ ${h}h`
  }
  return `~ ${minutes} min`
}

/**
 * Computes a new rolling average incorporating the latest value.
 * Uses a capped sample window to weight recent consultations more.
 */
export function computeRollingAverage(prevAvg, prevCount, newValue, sampleSize = DEFAULTS.ROLLING_AVG_SAMPLE_SIZE) {
  if (prevCount === 0) return newValue
  const effectiveCount = Math.min(prevCount, sampleSize - 1)
  return Math.round((prevAvg * effectiveCount + newValue) / (effectiveCount + 1))
}

// ─── QR GENERATOR ────────────────────────────────────────────────────────────

/**
 * Builds the patient-facing waiting room URL for a clinic.
 * This is what the QR code encodes.
 */
export function buildPatientUrl(clinicId, tokenId = null) {
  const base = `${window.location.origin}/wait/${clinicId}`
  return tokenId ? `${base}/${tokenId}` : base
}

/**
 * Builds the QR self check-in URL for a clinic.
 */
export function buildCheckinUrl(clinicId) {
  return `${window.location.origin}/checkin/${clinicId}`
}

/**
 * Builds the TV display URL for a clinic.
 */
export function buildTVUrl(clinicId) {
  return `${window.location.origin}/display/${clinicId}`
}

// ─── PDF EXPORT ───────────────────────────────────────────────────────────────

/**
 * Generates and downloads a daily summary PDF report.
 * Uses jsPDF + jsPDF-AutoTable.
 * @param {object} session - Today's session document
 * @param {Array}  doctorStats - Output of getDoctorStats()
 * @param {string} clinicName
 */
export async function exportDailySummaryPDF(session, doctorStats, clinicName) {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable')

  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const date = session.date ?? getTodayDateString()
  const now  = new Date()

  // ── Header ──
  doc.setFillColor(14, 165, 233)
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('QueueCure Pro', 14, 14)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Daily Summary Report`, 14, 21)
  doc.text(`Generated: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 130, 14)
  doc.text(`${clinicName}`, 130, 21)

  // ── Date ──
  doc.setTextColor(30, 41, 59)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`Report Date: ${formatDateLabel(date)}`, 14, 42)

  // ── Summary Stats ──
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const statsData = [
    ['Total Tokens Issued',    String(session.totalTokensIssued  ?? 0)],
    ['Total Completed',        String(session.totalCompleted     ?? 0)],
    ['Total Skipped',          String(session.totalSkipped       ?? 0)],
    ['Total No-Shows',         String(session.totalNoShows       ?? 0)],
    ['Avg. Wait Time',         session.avgWaitMinutes    != null ? formatDuration(session.avgWaitMinutes)    : 'N/A'],
    ['Avg. Consultation Time', session.avgConsultMinutes != null ? formatDuration(session.avgConsultMinutes) : 'N/A'],
    ['Peak Hour',              session.peakHour          != null ? `${session.peakHour}:00 – ${session.peakHour + 1}:00` : 'N/A'],
    ['Queue Opened',           session.openedAt  ? formatTime(session.openedAt)  : 'N/A'],
    ['Queue Closed',           session.closedAt  ? formatTime(session.closedAt)  : 'Still Open'],
  ]

  doc.autoTable({
    startY: 48,
    head:   [['Metric', 'Value']],
    body:   statsData,
    theme:  'striped',
    headStyles:   { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 249, 255] },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 1: { cellWidth: 60 } },
  })

  // ── Per-Doctor Breakdown ──
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Per-Doctor Breakdown', 14, doc.lastAutoTable.finalY + 12)

  const doctorRows = doctorStats.map((d) => [
    d.name,
    d.specialization,
    String(d.issued),
    String(d.completed),
    String(d.skipped),
    String(d.noShows),
    d.avgConsultMins != null ? `${d.avgConsultMins}m` : 'N/A',
    d.avgWaitMins    != null ? `${d.avgWaitMins}m`    : 'N/A',
  ])

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 16,
    head:   [['Doctor', 'Specialization', 'Issued', 'Done', 'Skipped', 'No-Show', 'Avg. Consult', 'Avg. Wait']],
    body:   doctorRows,
    theme:  'striped',
    headStyles:   { fillColor: [7, 89, 133], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 249, 255] },
    styles: { fontSize: 9, cellPadding: 3 },
  })

  // ── Footer ──
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(
      `QueueCure Pro | ${clinicName} | Page ${i} of ${pageCount}`,
      105,
      doc.internal.pageSize.height - 8,
      { align: 'center' }
    )
  }

  doc.save(`QueueCure-Summary-${date}.pdf`)
}

// ─── MISC UTILITIES ───────────────────────────────────────────────────────────

/**
 * Merges class names, filtering falsy values.
 * Lightweight alternative to clsx for simple cases.
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Debounce: delays fn execution until `delay` ms after last call.
 */
export function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Capitalizes first letter of a string.
 */
export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Returns initials from a full name string.
 * e.g. "Dr. Priya Sharma" → "PS"
 */
export function getInitials(name) {
  if (!name) return '?'
  return name
    .replace(/^Dr\.?\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

/**
 * Safe number formatter. Returns fallback if value is null/undefined/NaN.
 */
export function safeNum(value, fallback = 0) {
  const n = Number(value)
  return isNaN(n) ? fallback : n
}

/**
 * Clamps a value between min and max.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Generates a simple color from a string (for doctor avatars).
 * Returns a Tailwind-compatible hex value.
 */
export function stringToColor(str) {
  const colors = [
    '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#ef4444', '#06b6d4', '#f97316',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}