// ─── TOKEN STATUS ─────────────────────────────────────────────────────────────

export const TOKEN_STATUS = {
  WAITING:         'waiting',
  CALLED:          'called',
  IN_CONSULTATION: 'in_consultation',
  COMPLETED:       'completed',
  SKIPPED:         'skipped',
  NO_SHOW:         'no_show',
}

export const TOKEN_STATUS_LABELS = {
  [TOKEN_STATUS.WAITING]:         'Waiting',
  [TOKEN_STATUS.CALLED]:          'Called',
  [TOKEN_STATUS.IN_CONSULTATION]: 'In Consultation',
  [TOKEN_STATUS.COMPLETED]:       'Completed',
  [TOKEN_STATUS.SKIPPED]:         'Skipped',
  [TOKEN_STATUS.NO_SHOW]:         'No Show',
}

// Statuses considered "active" — visible in the live queue
export const ACTIVE_STATUSES = [
  TOKEN_STATUS.WAITING,
  TOKEN_STATUS.CALLED,
  TOKEN_STATUS.IN_CONSULTATION,
]

// Statuses that remove a token from the active queue
export const INACTIVE_STATUSES = [
  TOKEN_STATUS.COMPLETED,
  TOKEN_STATUS.SKIPPED,
  TOKEN_STATUS.NO_SHOW,
]

// ─── TOKEN PRIORITY ───────────────────────────────────────────────────────────

export const PRIORITY = {
  NORMAL:    'normal',
  SENIOR:    'senior',
  EMERGENCY: 'emergency',
}

export const PRIORITY_LABELS = {
  [PRIORITY.NORMAL]:    'General',
  [PRIORITY.SENIOR]:    'Senior Citizen',
  [PRIORITY.EMERGENCY]: 'Emergency',
}

// Lower number = higher priority in queue sort
export const PRIORITY_ORDER = {
  [PRIORITY.EMERGENCY]: 0,
  [PRIORITY.SENIOR]:    1,
  [PRIORITY.NORMAL]:    2,
}

// ─── DOCTOR STATUS ────────────────────────────────────────────────────────────

export const DOCTOR_STATUS = {
  AVAILABLE:       'available',
  IN_SESSION:      'in_session',
  ON_BREAK:        'on_break',
  UNAVAILABLE:     'unavailable',
}

export const DOCTOR_STATUS_LABELS = {
  [DOCTOR_STATUS.AVAILABLE]:   'Available',
  [DOCTOR_STATUS.IN_SESSION]:  'In Session',
  [DOCTOR_STATUS.ON_BREAK]:    'On Break',
  [DOCTOR_STATUS.UNAVAILABLE]: 'Unavailable',
}

// ─── STAFF ROLES ─────────────────────────────────────────────────────────────

export const ROLE = {
  ADMIN:        'admin',
  RECEPTIONIST: 'receptionist',
  DOCTOR:       'doctor',
}

export const ROLE_LABELS = {
  [ROLE.ADMIN]:        'Admin',
  [ROLE.RECEPTIONIST]: 'Receptionist',
  [ROLE.DOCTOR]:       'Doctor',
}

// ─── CHECK-IN METHOD ─────────────────────────────────────────────────────────

export const CHECKIN_METHOD = {
  RECEPTIONIST: 'receptionist',
  QR_SELF:      'qr_self',
}

// ─── SESSION ─────────────────────────────────────────────────────────────────

export const SESSION_STATUS = {
  OPEN:   'open',
  CLOSED: 'closed',
}

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────

export const DEFAULTS = {
  CONSULTATION_MINUTES:    10,
  MAX_TOKENS_PER_DAY:     150,
  NOTIFY_TOKENS_AHEAD:      3,
  ROLLING_AVG_SAMPLE_SIZE:  5,  // Last N consultations used for wait estimate
  WAIT_ROUND_TO_NEAREST:    5,  // Round estimated wait to nearest N minutes
  TOKEN_PREFIX:            'T',
  TOKEN_PAD_LENGTH:          3, // T001, T002 ... T150
}

// ─── ROUTES ──────────────────────────────────────────────────────────────────

export const ROUTES = {
  SETUP:        '/setup',
  LOGIN:        '/login',
  RECEPTIONIST: '/receptionist',
  DOCTOR:       '/doctor',
  PATIENT:      '/wait/:clinicId',
  PATIENT_TOKEN:'/wait/:clinicId/:tokenId',
  TV_DISPLAY:   '/display/:clinicId',
  CHECKIN:      '/checkin/:clinicId',
  ANALYTICS:    '/analytics',
}

// ─── LOCAL STORAGE KEYS ───────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  CLINIC_ID:   'qc_clinic_id',
  CLINIC_NAME: 'qc_clinic_name',
  USER_ROLE:   'qc_user_role',
  DOCTOR_ID:   'qc_doctor_id',
}

// ─── UI ───────────────────────────────────────────────────────────────────────

export const STATUS_COLORS = {
  // Token status → Tailwind color classes
  token: {
    [TOKEN_STATUS.WAITING]:         { bg: 'bg-slate-700',   text: 'text-slate-200',  border: 'border-slate-600',  dot: 'bg-slate-400'  },
    [TOKEN_STATUS.CALLED]:          { bg: 'bg-blue-900/60', text: 'text-blue-200',   border: 'border-blue-600',   dot: 'bg-blue-400'   },
    [TOKEN_STATUS.IN_CONSULTATION]: { bg: 'bg-green-900/60',text: 'text-green-200',  border: 'border-green-600',  dot: 'bg-green-400'  },
    [TOKEN_STATUS.COMPLETED]:       { bg: 'bg-slate-800',   text: 'text-slate-400',  border: 'border-slate-700',  dot: 'bg-slate-500'  },
    [TOKEN_STATUS.SKIPPED]:         { bg: 'bg-yellow-900/40',text:'text-yellow-300', border: 'border-yellow-700', dot: 'bg-yellow-500' },
    [TOKEN_STATUS.NO_SHOW]:         { bg: 'bg-red-900/40',  text: 'text-red-300',    border: 'border-red-700',    dot: 'bg-red-500'    },
  },
  // Doctor status → color classes
  doctor: {
    [DOCTOR_STATUS.AVAILABLE]:   { bg: 'bg-green-500',  ring: 'ring-green-400',  text: 'text-green-400'  },
    [DOCTOR_STATUS.IN_SESSION]:  { bg: 'bg-blue-500',   ring: 'ring-blue-400',   text: 'text-blue-400'   },
    [DOCTOR_STATUS.ON_BREAK]:    { bg: 'bg-yellow-500', ring: 'ring-yellow-400', text: 'text-yellow-400' },
    [DOCTOR_STATUS.UNAVAILABLE]: { bg: 'bg-slate-500',  ring: 'ring-slate-400',  text: 'text-slate-400'  },
  },
  // Priority → color classes
  priority: {
    [PRIORITY.NORMAL]:    { bg: 'bg-slate-700',    text: 'text-slate-300',   border: 'border-slate-600'   },
    [PRIORITY.SENIOR]:    { bg: 'bg-purple-900/60',text: 'text-purple-300',  border: 'border-purple-700'  },
    [PRIORITY.EMERGENCY]: { bg: 'bg-red-900/60',   text: 'text-red-300',     border: 'border-red-700'     },
  },
}

// ─── APP META ─────────────────────────────────────────────────────────────────

export const APP_NAME    = import.meta.env.VITE_APP_NAME    ?? 'QueueCure Pro'
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0'