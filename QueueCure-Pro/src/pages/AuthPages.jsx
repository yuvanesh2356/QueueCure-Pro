import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  Stethoscope, Plus, Trash2, ChevronRight,
  ChevronLeft, Eye, EyeOff, AlertTriangle,
  CheckCircle, Clock, User, Mail, Lock,
  Building2, Phone, MapPin, Users,
} from 'lucide-react'

import { auth } from '@/config/firebase'
import { createClinic, openSession, getStaffMember } from '@/services/firebase.services'
import { useStore } from '@/store/store'
import { ROLE, STORAGE_KEYS, DEFAULTS } from '@/config/constants'
import { cn } from '@/utils/utils'
import {
  Button, Input, Label, Select, LoadingSpinner,
} from '@/components/Shared'

// ─── SHARED LAYOUT WRAPPER ────────────────────────────────────────────────────

function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Ambient background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-900/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-900/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-950/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-10">
        {/* Brand mark */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-glow-green">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-100 leading-none">QueueCure Pro</p>
            <p className="text-xs text-emerald-400 mt-0.5">Healthcare Queue Management</p>
          </div>
        </div>

        {children}
      </div>

      <footer className="relative text-center py-4 text-xs text-slate-700">
        QueueCure Pro · Built for Indian Clinics
      </footer>
    </div>
  )
}

// ─── STEP INDICATOR ───────────────────────────────────────────────────────────

function StepIndicator({ currentStep, totalSteps, labels }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step      = i + 1
        const completed = step < currentStep
        const active    = step === currentStep

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border-2 transition-all duration-300',
                completed && 'bg-emerald-600 border-emerald-500 text-white',
                active    && 'bg-teal-600 border-teal-400 text-white ring-4 ring-teal-500/20',
                !completed && !active && 'bg-surface-raised border-surface-border text-slate-600'
              )}>
                {completed ? <CheckCircle className="w-4 h-4" /> : step}
              </div>
              {labels?.[i] && (
                <p className={cn(
                  'text-xs mt-1.5 font-medium whitespace-nowrap',
                  active    && 'text-teal-300',
                  completed && 'text-emerald-400',
                  !active && !completed && 'text-slate-600'
                )}>
                  {labels[i]}
                </p>
              )}
            </div>
            {i < totalSteps - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-2 mb-4 transition-all duration-300',
                completed ? 'bg-emerald-600' : 'bg-surface-border'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── DOCTOR ENTRY ROW ─────────────────────────────────────────────────────────

function DoctorRow({ doctor, index, onChange, onRemove, canRemove, defaultConsultTime }) {
  return (
    <div className="group flex gap-3 p-4 bg-surface-raised rounded-2xl border border-surface-border hover:border-emerald-700/40 transition-all">
      {/* Index pill */}
      <div className="w-7 h-7 rounded-lg bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0 mt-0.5">
        {index + 1}
      </div>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Name */}
        <div className="sm:col-span-1">
          <label className="block text-xs text-slate-500 mb-1">Doctor Name *</label>
          <input
            value={doctor.name}
            onChange={(e) => onChange(index, 'name', e.target.value)}
            placeholder="Dr. Priya Sharma"
            maxLength={60}
            className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
          />
        </div>

        {/* Specialization */}
        <div className="sm:col-span-1">
          <label className="block text-xs text-slate-500 mb-1">Specialization</label>
          <input
            value={doctor.specialization}
            onChange={(e) => onChange(index, 'specialization', e.target.value)}
            placeholder="General Physician"
            maxLength={50}
            className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
          />
        </div>

        {/* Avg time */}
        <div className="sm:col-span-1">
          <label className="block text-xs text-slate-500 mb-1">Avg. Consult (min)</label>
          <div className="relative">
            <input
              type="number"
              min={1}
              max={60}
              value={doctor.avgConsultationMinutes}
              onChange={(e) => onChange(index, 'avgConsultationMinutes', Math.max(1, parseInt(e.target.value) || defaultConsultTime))}
              className="w-full bg-surface border border-surface-border rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">min</span>
          </div>
        </div>
      </div>

      {/* Remove */}
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-all mt-0.5 shrink-0 opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── SETUP PAGE ───────────────────────────────────────────────────────────────

export function SetupPage() {
  const navigate   = useNavigate()
  const setClinicId = useStore((s) => s.setClinicId)
  const clinicId   = useStore((s) => s.clinicId)

  // If clinic already exists, redirect
  useEffect(() => {
    if (clinicId) navigate('/login', { replace: true })
  }, [clinicId])

  const [step, setStep] = useState(1)
  const TOTAL_STEPS     = 3
  const STEP_LABELS     = ['Clinic Info', 'Doctors', 'Review']

  // ── Step 1: Clinic info ──
  const [clinicForm, setClinicForm] = useState({
    name:    '',
    address: '',
    phone:   '',
    defaultConsultationMinutes: DEFAULTS.CONSULTATION_MINUTES,
  })
  const [clinicErrors, setClinicErrors] = useState({})

  // ── Step 2: Doctors ──
  const [doctors, setDoctors] = useState([
    { name: '', specialization: 'General Physician', avgConsultationMinutes: DEFAULTS.CONSULTATION_MINUTES },
  ])
  const [doctorErrors, setDoctorErrors] = useState([])

  // ── Submission ──
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [done,        setDone]        = useState(false)

  // ── Clinic form handlers ──
  const setClinicField = (field, value) => {
    setClinicForm((f) => ({ ...f, [field]: value }))
    setClinicErrors((e) => ({ ...e, [field]: undefined }))
  }

  const validateClinic = () => {
    const e = {}
    if (!clinicForm.name.trim())    e.name    = 'Clinic name is required'
    if (clinicForm.phone && !/^[6-9]\d{9}$/.test(clinicForm.phone.replace(/\s/g, ''))) {
      e.phone = 'Enter a valid 10-digit Indian mobile number'
    }
    if (!clinicForm.defaultConsultationMinutes || clinicForm.defaultConsultationMinutes < 1) {
      e.defaultConsultationMinutes = 'Set a valid consultation time'
    }
    setClinicErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Doctor handlers ──
  const handleDoctorChange = (idx, field, value) => {
    setDoctors((prev) => {
      const updated = [...prev]
      updated[idx]  = { ...updated[idx], [field]: value }
      return updated
    })
    setDoctorErrors((prev) => {
      const updated = [...prev]
      if (updated[idx]) updated[idx] = { ...updated[idx], [field]: undefined }
      return updated
    })
  }

  const addDoctor = () => {
    if (doctors.length >= 10) return
    setDoctors((prev) => [
      ...prev,
      {
        name:                   '',
        specialization:         'General Physician',
        avgConsultationMinutes: clinicForm.defaultConsultationMinutes,
      },
    ])
  }

  const removeDoctor = (idx) => {
    setDoctors((prev) => prev.filter((_, i) => i !== idx))
    setDoctorErrors((prev) => prev.filter((_, i) => i !== idx))
  }

  const validateDoctors = () => {
    const errors = doctors.map((d) => {
      const e = {}
      if (!d.name.trim()) e.name = 'Doctor name is required'
      return e
    })
    setDoctorErrors(errors)
    return errors.every((e) => Object.keys(e).length === 0)
  }

  // ── Navigation ──
  const handleNext = () => {
    if (step === 1 && !validateClinic()) return
    if (step === 2 && !validateDoctors()) return
    setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  }

  const handleBack = () => setStep((s) => Math.max(s - 1, 1))

  // ── Submit ──
  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)

    try {
      const { clinicId: newClinicId } = await createClinic({
        name:    clinicForm.name.trim(),
        address: clinicForm.address.trim(),
        phone:   clinicForm.phone.trim(),
        doctors: doctors.map((d) => ({
          name:                   d.name.trim(),
          specialization:         d.specialization.trim() || 'General Physician',
          avgConsultationMinutes: d.avgConsultationMinutes,
        })),
        defaultConsultationMinutes: clinicForm.defaultConsultationMinutes,
      })

      await openSession(newClinicId)

      // Persist clinicId
      localStorage.setItem(STORAGE_KEYS.CLINIC_ID,   newClinicId)
      localStorage.setItem(STORAGE_KEYS.CLINIC_NAME, clinicForm.name.trim())
      setClinicId(newClinicId)

      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2200)
    } catch (err) {
      setSubmitError(err?.message ?? 'Setup failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ──
  if (done) {
    return (
      <AuthLayout>
        <div className="bg-surface-card border border-emerald-700/50 rounded-2xl p-8 w-full max-w-sm text-center animate-scale-in shadow-glow-green/20">
          <div className="w-16 h-16 rounded-2xl bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Clinic Created!</h2>
          <p className="text-sm text-slate-400 mb-1">
            <span className="text-emerald-300 font-semibold">{clinicForm.name}</span> is ready.
          </p>
          <p className="text-xs text-slate-500">Redirecting to login…</p>
          <div className="mt-5 flex justify-center">
            <LoadingSpinner size="sm" />
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-2xl">
        {/* Card */}
        <div className="bg-surface-card border border-surface-border rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-0">
            <h1 className="text-xl font-bold text-slate-100 mb-1">Set Up Your Clinic</h1>
            <p className="text-sm text-slate-500 mb-6">
              One-time setup · Takes under 2 minutes
            </p>
            <StepIndicator
              currentStep={step}
              totalSteps={TOTAL_STEPS}
              labels={STEP_LABELS}
            />
          </div>

          {/* Body */}
          <div className="px-6 pb-6">

            {/* ── STEP 1: Clinic Info ── */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">

                <div>
                  <Label htmlFor="clinicName" required>Clinic Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="clinicName"
                      value={clinicForm.name}
                      onChange={(e) => setClinicField('name', e.target.value)}
                      placeholder="City General Clinic"
                      className="pl-10"
                      maxLength={80}
                      error={clinicErrors.name}
                      autoFocus
                    />
                  </div>
                  {clinicErrors.name && (
                    <p className="text-xs text-red-400 mt-1">{clinicErrors.name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="clinicAddress">Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <textarea
                      id="clinicAddress"
                      value={clinicForm.address}
                      onChange={(e) => setClinicField('address', e.target.value)}
                      placeholder="123, MG Road, Bengaluru, Karnataka"
                      rows={2}
                      maxLength={200}
                      className="w-full bg-surface-raised border border-surface-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="clinicPhone">Clinic Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="clinicPhone"
                      value={clinicForm.phone}
                      onChange={(e) => setClinicField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="pl-10"
                      inputMode="numeric"
                      maxLength={10}
                      error={clinicErrors.phone}
                    />
                  </div>
                  {clinicErrors.phone && (
                    <p className="text-xs text-red-400 mt-1">{clinicErrors.phone}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="defaultTime" required>Default Consultation Time</Label>
                  <p className="text-xs text-slate-600 mb-2">
                    Used for wait-time estimates. Doctors can have individual settings in the next step.
                  </p>
                  <div className="flex items-center gap-3">
                    {[5, 8, 10, 15, 20].map((min) => (
                      <button
                        key={min}
                        type="button"
                        onClick={() => setClinicField('defaultConsultationMinutes', min)}
                        className={cn(
                          'px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                          clinicForm.defaultConsultationMinutes === min
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-surface-raised border-surface-border text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        )}
                      >
                        {min}m
                      </button>
                    ))}
                    <div className="relative flex items-center">
                      <input
                        id="defaultTime"
                        type="number"
                        min={1}
                        max={60}
                        value={clinicForm.defaultConsultationMinutes}
                        onChange={(e) => setClinicField('defaultConsultationMinutes', Math.max(1, parseInt(e.target.value) || DEFAULTS.CONSULTATION_MINUTES))}
                        className="w-20 bg-surface-raised border border-surface-border rounded-xl px-3 py-2 text-sm text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                      />
                      <span className="ml-2 text-xs text-slate-500">custom</span>
                    </div>
                  </div>
                  {clinicErrors.defaultConsultationMinutes && (
                    <p className="text-xs text-red-400 mt-1">{clinicErrors.defaultConsultationMinutes}</p>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 2: Doctors ── */}
            {step === 2 && (
              <div className="animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-slate-200">Add your doctors</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      You can add or remove doctors later from the dashboard.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    onClick={addDoctor}
                    disabled={doctors.length >= 10}
                  >
                    Add Doctor
                  </Button>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto custom-scroll pr-1">
                  {doctors.map((doctor, idx) => (
                    <div key={idx}>
                      <DoctorRow
                        doctor={doctor}
                        index={idx}
                        onChange={handleDoctorChange}
                        onRemove={removeDoctor}
                        canRemove={doctors.length > 1}
                        defaultConsultTime={clinicForm.defaultConsultationMinutes}
                      />
                      {doctorErrors[idx]?.name && (
                        <p className="text-xs text-red-400 mt-1 ml-11">{doctorErrors[idx].name}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 px-4 py-3 bg-teal-950/30 border border-teal-700/30 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <p className="text-xs text-teal-300">
                      Each doctor's avg. consultation time powers live wait estimates for patients.
                      Set it as accurately as possible.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: Review ── */}
            {step === 3 && (
              <div className="animate-fade-in space-y-4">
                <p className="text-sm text-slate-400">
                  Review your setup before creating the clinic.
                </p>

                {/* Clinic summary */}
                <div className="bg-surface-raised rounded-2xl border border-surface-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Clinic</p>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Name</span>
                      <span className="text-slate-100 font-medium">{clinicForm.name}</span>
                    </div>
                    {clinicForm.address && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Address</span>
                        <span className="text-slate-300 text-right max-w-[200px]">{clinicForm.address}</span>
                      </div>
                    )}
                    {clinicForm.phone && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Phone</span>
                        <span className="text-slate-300">{clinicForm.phone}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Default consult time</span>
                      <span className="text-teal-400 font-medium">{clinicForm.defaultConsultationMinutes} min</span>
                    </div>
                  </div>
                </div>

                {/* Doctors summary */}
                <div className="bg-surface-raised rounded-2xl border border-surface-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                      {doctors.length} {doctors.length === 1 ? 'Doctor' : 'Doctors'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {doctors.map((d, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center text-xs font-bold text-emerald-400">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-slate-200 font-medium">{d.name}</p>
                            <p className="text-xs text-slate-500">{d.specialization || 'General Physician'}</p>
                          </div>
                        </div>
                        <span className="text-teal-400 text-xs">{d.avgConsultationMinutes}m avg</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* What happens next */}
                <div className="px-4 py-3 bg-emerald-950/30 border border-emerald-700/30 rounded-xl">
                  <p className="text-xs font-semibold text-emerald-400 mb-2">What happens next</p>
                  <ul className="space-y-1 text-xs text-slate-400">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                      Clinic and doctors created in Firestore
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                      Today's queue session opened automatically
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                      You'll be redirected to login to access the dashboard
                    </li>
                  </ul>
                </div>

                {/* Submit error */}
                {submitError && (
                  <div className="flex items-start gap-2 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">{submitError}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Navigation buttons ── */}
            <div className={cn('flex gap-3 mt-6', step > 1 ? 'justify-between' : 'justify-end')}>
              {step > 1 && (
                <Button
                  variant="secondary"
                  size="md"
                  icon={ChevronLeft}
                  onClick={handleBack}
                  disabled={submitting}
                >
                  Back
                </Button>
              )}

              {step < TOTAL_STEPS ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleNext}
                  className="ml-auto"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  loading={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Creating Clinic…' : 'Create Clinic & Launch'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Already have a clinic */}
        <p className="text-center text-xs text-slate-600 mt-5">
          Already have a clinic?{' '}
          <a href="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">
            Sign in instead
          </a>
        </p>
      </div>
    </AuthLayout>
  )
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────

export function LoginPage() {
  const navigate       = useNavigate()
  const setUser        = useStore((s) => s.setUser)
  const setStaffProfile = useStore((s) => s.setStaffProfile)
  const clinicId       = useStore((s) => s.clinicId)

  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!email.trim())    e.email    = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address'
    if (!password)        e.password = 'Password is required'
    else if (password.length < 6) e.password = 'Password must be at least 6 characters'
    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  const handleLogin = async (e) => {
    e?.preventDefault()
    if (!validate()) return

    setLoading(true)
    setError(null)

    try {
      const credential   = await signInWithEmailAndPassword(auth, email.trim(), password)
      const firebaseUser = credential.user

      setUser(firebaseUser)

      // Determine clinicId — from store or localStorage
      const resolvedClinicId = clinicId ?? localStorage.getItem(STORAGE_KEYS.CLINIC_ID)

      if (!resolvedClinicId) {
        // No clinic yet — go to setup
        navigate('/setup', { replace: true })
        return
      }

      // Load staff profile from Firestore
      let profile = null
      try {
        profile = await getStaffMember(resolvedClinicId, firebaseUser.uid)
      } catch {
        // Firestore read failed — fall back to localStorage cache
      }

      if (!profile) {
        // Try localStorage cache (set during previous session)
        const cachedRole     = localStorage.getItem(STORAGE_KEYS.USER_ROLE)
        const cachedDoctorId = localStorage.getItem(STORAGE_KEYS.DOCTOR_ID)
        if (cachedRole) {
          profile = {
            role:     cachedRole,
            doctorId: cachedDoctorId ?? null,
            name:     firebaseUser.displayName ?? '',
            email:    firebaseUser.email ?? '',
          }
        }
      }

      if (!profile) {
        // Staff record missing — sign out and show helpful error
        await signOut(auth)
        setError(
          'Your account is not linked to this clinic. ' +
          'Ask your administrator to add you as a staff member in Firestore.'
        )
        setLoading(false)
        return
      }

      setStaffProfile(profile)

      // Persist role to localStorage for AppInitializer on next boot
      localStorage.setItem(STORAGE_KEYS.USER_ROLE, profile.role)
      if (profile.doctorId) {
        localStorage.setItem(STORAGE_KEYS.DOCTOR_ID, profile.doctorId)
      }

      // Route by role
      if (profile.role === ROLE.DOCTOR) {
        navigate('/doctor', { replace: true })
      } else {
        navigate('/receptionist', { replace: true })
      }
    } catch (err) {
      // Firebase auth error codes → user-friendly messages
      const code = err?.code ?? ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Incorrect email or password. Please try again.')
      } else if (code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please wait a moment before trying again.')
      } else if (code === 'auth/user-disabled') {
        setError('This account has been disabled. Contact your administrator.')
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Check your internet connection and try again.')
      } else {
        setError(err?.message ?? 'Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        <div className="bg-surface-card border border-surface-border rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-5 border-b border-surface-border">
            <h1 className="text-xl font-bold text-slate-100">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">
              Sign in to your clinic dashboard
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleLogin}
            className="px-6 py-5 space-y-4"
            noValidate
          >
            {/* Global error */}
            {error && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-xl animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <Label htmlFor="loginEmail" required>Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="loginEmail"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: undefined })); setError(null) }}
                  placeholder="doctor@clinic.com"
                  autoComplete="email"
                  autoFocus
                  className={cn(
                    'w-full bg-surface-raised border rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all',
                    fieldErrors.email ? 'border-red-500/60' : 'border-surface-border'
                  )}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="loginPassword" required>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="loginPassword"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((f) => ({ ...f, password: undefined })); setError(null) }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={cn(
                    'w-full bg-surface-raised border rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-600',
                    'focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all',
                    fieldErrors.password ? 'border-red-500/60' : 'border-surface-border'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.password}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl',
                'bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-surface-card',
                'transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed',
                'shadow-glow-green/20 mt-2'
              )}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="px-6 pb-5">
            <div className="pt-4 border-t border-surface-border">
              <p className="text-xs text-slate-600 text-center">
                Staff accounts are created by your clinic administrator.
              </p>
            </div>
          </div>
        </div>

        {/* Setup link */}
        <p className="text-center text-xs text-slate-600 mt-5">
          New clinic?{' '}
          <a href="/setup" className="text-emerald-400 hover:text-emerald-300 transition-colors">
            Set up your clinic
          </a>
        </p>

        {/* Role guide */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          {[
            { icon: Building2, label: 'Admin', desc: 'Full access' },
            { icon: User,      label: 'Receptionist', desc: 'Queue control' },
            { icon: Stethoscope, label: 'Doctor', desc: 'Own queue' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-surface-card border border-surface-border rounded-xl p-3">
              <Icon className="w-4 h-4 text-slate-600 mx-auto mb-1.5" />
              <p className="text-xs font-medium text-slate-400">{label}</p>
              <p className="text-xs text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </AuthLayout>
  )
}