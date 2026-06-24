import { useState, useEffect } from 'react'
import { X, User, Phone, Stethoscope, AlertTriangle, Printer, FileText } from 'lucide-react'
import { useStore } from '@/store/store'
import { addToken } from '@/services/firebase.services'
import { PRIORITY, PRIORITY_LABELS, CHECKIN_METHOD, DOCTOR_STATUS } from '@/config/constants'
import { estimateWaitMinutes, formatEstimatedWait } from '@/utils/utils'
import { Button, Label, Input, Select, Textarea } from '@/components/Shared'
import { PriorityBadge } from '@/components/QueueComponents'
import { cn } from '@/utils/utils'

export default function AddPatientModal({ open, onClose, onSuccess, clinicId, doctors }) {
  const [form, setForm] = useState({
    patientName:  '',
    patientPhone: '',
    doctorId:     '',
    priority:     PRIORITY.NORMAL,
    notes:        '',
    printSlip:    true,
  })
  const [errors,  setErrors]  = useState({})
  const [loading, setLoading] = useState(false)

  // Pre-select first available doctor
  useEffect(() => {
    if (open && doctors.length > 0 && !form.doctorId) {
      const firstAvailable = doctors.find(
        (d) => d.status !== DOCTOR_STATUS.UNAVAILABLE
      ) ?? doctors[0]
      setForm((f) => ({ ...f, doctorId: firstAvailable.id }))
    }
  }, [open, doctors])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setForm({ patientName: '', patientPhone: '', doctorId: '', priority: PRIORITY.NORMAL, notes: '', printSlip: true })
      setErrors({})
    }
  }, [open])

  const selectedDoctor  = doctors.find((d) => d.id === form.doctorId)
  const waitingForDoctor = useStore((s) =>
    s.tokens.filter((t) => t.doctorId === form.doctorId && t.status === 'waiting').length
  )
  const estimatedWait = selectedDoctor
    ? formatEstimatedWait(estimateWaitMinutes(selectedDoctor.avgConsultationMinutes, waitingForDoctor + 1))
    : null

  const validate = () => {
    const e = {}
    if (!form.doctorId) e.doctorId = 'Please select a doctor'
    if (form.patientPhone && !/^[6-9]\d{9}$/.test(form.patientPhone.replace(/\s/g, ''))) {
      e.patientPhone = 'Enter a valid 10-digit Indian mobile number'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      const result = await addToken({
        clinicId,
        doctorId:     form.doctorId,
        patientName:  form.patientName.trim() || null,
        patientPhone: form.patientPhone.trim() || null,
        priority:     form.priority,
        checkInMethod: CHECKIN_METHOD.RECEPTIONIST,
        notes:        form.notes.trim() || null,
      })
      onSuccess?.({
        ...result,
        patientName:   form.patientName.trim() || null,
        doctorId:      form.doctorId,
        estimatedWait,
        printSlip:     form.printSlip,
      })
    } catch (err) {
      setErrors({ submit: err?.message ?? 'Failed to add patient' })
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-2xl w-full max-w-md shadow-2xl animate-slide-up max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Add Patient</h2>
            <p className="text-xs text-slate-500 mt-0.5">Fields marked * are required</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Doctor select */}
          <div>
            <Label htmlFor="doctorId" required>Doctor</Label>
            <Select
              id="doctorId"
              value={form.doctorId}
              onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
              error={errors.doctorId}
            >
              <option value="">Select doctor…</option>
              {doctors.map((d) => (
                <option
                  key={d.id}
                  value={d.id}
                  disabled={d.status === DOCTOR_STATUS.UNAVAILABLE}
                >
                  {d.name} — {d.specialization}
                  {d.status === DOCTOR_STATUS.UNAVAILABLE ? ' (Unavailable)' : ''}
                </option>
              ))}
            </Select>
          </div>

          {/* Doctor queue preview */}
          {selectedDoctor && (
            <div className="flex items-center justify-between bg-surface-raised rounded-xl px-4 py-3 text-xs">
              <span className="text-slate-400">
                <span className="font-semibold text-slate-200">{waitingForDoctor}</span> waiting
              </span>
              <span className="text-teal-400">
                Est. wait: <span className="font-semibold">{estimatedWait}</span>
              </span>
              <span className="text-slate-500">
                Avg: {selectedDoctor.avgConsultationMinutes}m
              </span>
            </div>
          )}

          {/* Priority */}
          <div>
            <Label htmlFor="priority">Priority</Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(PRIORITY).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                  className={cn(
                    'py-2.5 px-3 rounded-xl border text-xs font-medium transition-all',
                    form.priority === p
                      ? p === PRIORITY.EMERGENCY
                        ? 'bg-red-900/60 border-red-600 text-red-300'
                        : p === PRIORITY.SENIOR
                          ? 'bg-purple-900/60 border-purple-600 text-purple-300'
                          : 'bg-emerald-900/60 border-emerald-600 text-emerald-300'
                      : 'bg-surface-raised border-surface-border text-slate-500 hover:border-slate-500'
                  )}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Patient name */}
          <div>
            <Label htmlFor="patientName">Patient Name <span className="text-slate-600">(optional)</span></Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input
                id="patientName"
                value={form.patientName}
                onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))}
                placeholder="Enter patient name"
                className="pl-9"
                maxLength={60}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="patientPhone">Mobile Number <span className="text-slate-600">(optional)</span></Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input
                id="patientPhone"
                value={form.patientPhone}
                onChange={(e) => setForm((f) => ({ ...f, patientPhone: e.target.value }))}
                placeholder="10-digit mobile number"
                className="pl-9"
                maxLength={10}
                inputMode="numeric"
                error={errors.patientPhone}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Receptionist Notes <span className="text-slate-600">(optional)</span></Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-500" />
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Follow-up visit, bring reports"
                rows={2}
                className="pl-9"
                maxLength={200}
              />
            </div>
          </div>

          {/* Print slip toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setForm((f) => ({ ...f, printSlip: !f.printSlip }))}
              className={cn(
                'w-9 h-5 rounded-full transition-all relative border',
                form.printSlip
                  ? 'bg-emerald-600 border-emerald-500'
                  : 'bg-surface-raised border-surface-border'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all',
                form.printSlip ? 'left-4' : 'left-0.5'
              )} />
            </div>
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" />
              Print token slip after adding
            </span>
          </label>

          {/* Submit error */}
          {errors.submit && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-900/30 border border-red-700/50 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">{errors.submit}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-border shrink-0 flex gap-3">
          <Button variant="secondary" size="md" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="md" className="flex-1" loading={loading} onClick={handleSubmit}>
            Issue Token
          </Button>
        </div>
      </div>
    </div>
  )
}