import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, RefreshCw, Calendar, TrendingUp, BarChart2 } from 'lucide-react'

import { useClinicId, useClinic, useDoctors, useSession } from '@/store/store'
import { useRealtimeAll } from '@/hooks/useRealtime'
import {
  getRecentSessions, getHourlyVolume, getDoctorStats,
} from '@/services/firebase.services'
import { exportDailySummaryPDF } from '@/utils/utils'
import { getTodayDateString, formatDateLabel, formatDuration } from '@/utils/utils'
import { Button, SectionHeader, LoadingSpinner, StatCard } from '@/components/Shared'
import {
  TokenVolumeChart, WaitTimeChart,
  DoctorComparisonTable, AnalyticsStatRow,
} from '@/components/AnalyticsComponents'
import {
  Clock, Users, CheckCircle, AlertTriangle,
  TrendingDown, Activity,
} from 'lucide-react'
import { cn } from '@/utils/utils'

// ─── DAILY SUMMARY SECTION ────────────────────────────────────────────────────

function DailySummaryView({ session, doctorStats, clinicName }) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!session) return
    setExporting(true)
    try {
      await exportDailySummaryPDF(session, doctorStats, clinicName)
    } catch (e) {
      console.error('PDF export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  if (!session) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-2xl p-8 text-center">
        <BarChart2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-500">No session data for today yet.</p>
        <p className="text-xs text-slate-600 mt-1">Open the queue to start tracking.</p>
      </div>
    )
  }

  const completionRate = session.totalTokensIssued > 0
    ? Math.round((session.totalCompleted / session.totalTokensIssued) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <AnalyticsStatRow
        stats={{
          issued:            session.totalTokensIssued   ?? 0,
          completed:         session.totalCompleted       ?? 0,
          skipped:           session.totalSkipped         ?? 0,
          noShows:           session.totalNoShows         ?? 0,
          avgWaitMinutes:    session.avgWaitMinutes,
          avgConsultMinutes: session.avgConsultMinutes,
        }}
      />

      {/* Completion rate + export */}
      <div className="flex items-center justify-between gap-4 bg-surface-card border border-surface-border rounded-2xl px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="#1e293b" strokeWidth="6" />
              <circle
                cx="28" cy="28" r="22"
                fill="none"
                stroke="#10b981"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - completionRate / 100)}`}
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-emerald-400">
              {completionRate}%
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-100">Completion Rate</p>
            <p className="text-xs text-slate-500">
              {session.totalCompleted} of {session.totalTokensIssued} patients seen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {session.peakHour != null && (
            <div className="text-right">
              <p className="text-xs text-slate-500">Peak Hour</p>
              <p className="text-sm font-semibold text-teal-400">
                {session.peakHour}:00 – {session.peakHour + 1}:00
              </p>
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            loading={exporting}
            onClick={handleExport}
          >
            Export PDF
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ANALYTICS DASHBOARD ─────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const navigate    = useNavigate()
  const clinicId    = useClinicId()
  const clinic      = useClinic()
  const doctors     = useDoctors()
  const todaySession = useSession()

  const [selectedDate,    setSelectedDate]    = useState(getTodayDateString())
  const [recentSessions,  setRecentSessions]  = useState([])
  const [hourlyVolume,    setHourlyVolume]    = useState([])
  const [doctorStats,     setDoctorStats]     = useState([])
  const [loading,         setLoading]         = useState(true)
  const [refreshing,      setRefreshing]      = useState(false)

  useRealtimeAll(clinicId)

  const loadData = useCallback(async (date) => {
    if (!clinicId) return
    setLoading(true)
    try {
      const [sessions, volume, dStats] = await Promise.all([
        getRecentSessions(clinicId, 7),
        getHourlyVolume(clinicId, date),
        getDoctorStats(clinicId, date),
      ])
      setRecentSessions(sessions)
      setHourlyVolume(volume)
      setDoctorStats(dStats)
    } catch (e) {
      console.error('[Analytics] Load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => { loadData(selectedDate) }, [selectedDate, loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData(selectedDate)
    setRefreshing(false)
  }

  // Use todaySession for today, or the selected session from recentSessions
  const displaySession = selectedDate === getTodayDateString()
    ? todaySession
    : recentSessions.find((s) => s.date === selectedDate) ?? null

  const today = getTodayDateString()

  return (
    <div className="min-h-screen bg-surface flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              icon={ArrowLeft}
              onClick={() => navigate(-1)}
            />
            <div>
              <p className="text-sm font-semibold text-slate-100">Analytics</p>
              <p className="text-xs text-slate-500">{clinic?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Date selector */}
            <div className="flex items-center gap-1.5">
              {recentSessions.map((s) => (
                <button
                  key={s.date}
                  onClick={() => setSelectedDate(s.date)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                    selectedDate === s.date
                      ? 'bg-emerald-600 text-white'
                      : 'bg-surface-raised text-slate-400 hover:text-slate-200'
                  )}
                >
                  {s.date === today
                    ? 'Today'
                    : new Date(s.date + 'T00:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
                  }
                </button>
              ))}
            </div>

            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={handleRefresh}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-5 space-y-6">

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" label="Loading analytics…" />
          </div>
        ) : (
          <>
            {/* Date heading */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-slate-100">
                  {selectedDate === today ? "Today's Report" : formatDateLabel(selectedDate)}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {displaySession?.isOpen ? 'Queue is open · Data updates live' : 'Queue closed · Final data'}
                </p>
              </div>
            </div>

            {/* Daily summary */}
            <section>
              <SectionHeader
                title="Daily Summary"
                subtitle="Session totals and completion metrics"
              />
              <DailySummaryView
                session={displaySession}
                doctorStats={doctorStats}
                clinicName={clinic?.name ?? 'Clinic'}
              />
            </section>

            {/* Hourly volume chart */}
            <section className="bg-surface-card border border-surface-border rounded-2xl p-5">
              <SectionHeader
                title="Hourly Patient Volume"
                subtitle="Tokens issued and completed by hour"
              />
              <TokenVolumeChart data={hourlyVolume} />
            </section>

            {/* 7-day wait trend */}
            {recentSessions.length > 1 && (
              <section className="bg-surface-card border border-surface-border rounded-2xl p-5">
                <SectionHeader
                  title="7-Day Wait Trend"
                  subtitle="Average wait and consult times across sessions"
                />
                <WaitTimeChart data={recentSessions} />
              </section>
            )}

            {/* Doctor comparison */}
            <section className="bg-surface-card border border-surface-border rounded-2xl p-5">
              <SectionHeader
                title="Doctor Performance"
                subtitle={`${formatDateLabel(selectedDate)} breakdown`}
              />
              <DoctorComparisonTable stats={doctorStats} />
            </section>

            {/* Session history table */}
            {recentSessions.length > 0 && (
              <section className="bg-surface-card border border-surface-border rounded-2xl p-5">
                <SectionHeader
                  title="Session History"
                  subtitle="Last 7 sessions"
                />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border">
                        {['Date', 'Issued', 'Done', 'Skip', 'No-Show', 'Avg Wait', 'Avg Consult', 'Status'].map((h) => (
                          <th key={h} className="pb-3 text-xs font-medium text-slate-500 text-left px-3 first:pl-0">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border/50">
                      {recentSessions.map((s) => (
                        <tr
                          key={s.date}
                          onClick={() => setSelectedDate(s.date)}
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-surface-raised/40',
                            selectedDate === s.date && 'bg-emerald-950/30'
                          )}
                        >
                          <td className="py-3 pl-0 px-3">
                            <p className="text-slate-200 font-medium">
                              {s.date === today ? 'Today' : formatDateLabel(s.date)}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-slate-300">{s.totalTokensIssued ?? 0}</td>
                          <td className="py-3 px-3 text-emerald-400 font-medium">{s.totalCompleted ?? 0}</td>
                          <td className="py-3 px-3">
                            <span className={cn((s.totalSkipped ?? 0) > 0 ? 'text-amber-400' : 'text-slate-600')}>
                              {s.totalSkipped ?? 0}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={cn((s.totalNoShows ?? 0) > 0 ? 'text-red-400' : 'text-slate-600')}>
                              {s.totalNoShows ?? 0}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {s.avgWaitMinutes    != null ? `${s.avgWaitMinutes}m`    : '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {s.avgConsultMinutes != null ? `${s.avgConsultMinutes}m` : '—'}
                          </td>
                          <td className="py-3 px-3">
                            <span className={cn(
                              'text-xs font-medium px-2 py-0.5 rounded-lg',
                              s.isOpen
                                ? 'bg-emerald-900/50 text-emerald-400'
                                : 'bg-slate-800 text-slate-500'
                            )}>
                              {s.isOpen ? 'Open' : 'Closed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}