import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Award, Clock, Users, CheckCircle, AlertTriangle } from 'lucide-react'
import { cn, formatDuration, formatDateLabel } from '@/utils/utils'

// ─── SHARED CHART THEME ───────────────────────────────────────────────────────

const CHART_COLORS = {
  emerald: '#10b981',
  teal:    '#14b8a6',
  mint:    '#6ee7b7',
  muted:   '#334155',
  grid:    '#1e293b',
  text:    '#64748b',
}

const CustomTooltipWrapper = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-300">{entry.name}:</span>
          <span className="font-semibold text-slate-100">
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── HOURLY VOLUME CHART ──────────────────────────────────────────────────────

export function TokenVolumeChart({ data, className = '' }) {
  if (!data || data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-48 text-slate-600 text-sm', className)}>
        No token data for this period
      </div>
    )
  }

  return (
    <div className={cn('', className)}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barGap={2} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={<CustomTooltipWrapper formatter={(v, n) => `${v} patients`} />}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: CHART_COLORS.text, paddingTop: 8 }}
          />
          <Bar dataKey="tokens"    name="Issued"    fill={CHART_COLORS.teal}    radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="completed" name="Completed" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── WAIT TIME TREND CHART ────────────────────────────────────────────────────

export function WaitTimeChart({ data, className = '' }) {
  if (!data || data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-48 text-slate-600 text-sm', className)}>
        Not enough historical data yet
      </div>
    )
  }

  const chartData = data
    .filter((s) => s.avgWaitMinutes != null)
    .map((s) => ({
      date:    formatDateLabel(s.date),
      wait:    s.avgWaitMinutes ?? 0,
      consult: s.avgConsultMinutes ?? 0,
    }))
    .reverse()

  return (
    <div className={cn('', className)}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            unit="m"
          />
          <Tooltip
            content={<CustomTooltipWrapper formatter={(v) => `${v} min`} />}
            cursor={{ stroke: CHART_COLORS.muted }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: CHART_COLORS.text, paddingTop: 8 }}
          />
          <Line
            type="monotone"
            dataKey="wait"
            name="Avg Wait"
            stroke={CHART_COLORS.teal}
            strokeWidth={2.5}
            dot={{ fill: CHART_COLORS.teal,    r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="consult"
            name="Avg Consult"
            stroke={CHART_COLORS.emerald}
            strokeWidth={2.5}
            dot={{ fill: CHART_COLORS.emerald, r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── DOCTOR COMPARISON TABLE ──────────────────────────────────────────────────

export function DoctorComparisonTable({ stats, className = '' }) {
  if (!stats || stats.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-10 text-slate-600 text-sm', className)}>
        No doctor data available
      </div>
    )
  }

  const maxCompleted = Math.max(...stats.map((s) => s.completed), 1)

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border">
            {['Doctor', 'Issued', 'Done', 'Skipped', 'No-Show', 'Avg Consult', 'Avg Wait', 'Throughput'].map((h) => (
              <th key={h} className="pb-3 text-xs font-medium text-slate-500 text-left first:text-left px-3 first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border/50">
          {stats.map((s, idx) => {
            const throughput = s.issued > 0 ? Math.round((s.completed / s.issued) * 100) : 0

            return (
              <tr key={s.doctorId} className="hover:bg-surface-raised/40 transition-colors">
                <td className="py-3.5 pl-0 px-3">
                  <div>
                    <p className="font-medium text-slate-200">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.specialization}</p>
                  </div>
                </td>
                <td className="py-3.5 px-3 text-slate-300 font-medium">{s.issued}</td>
                <td className="py-3.5 px-3">
                  <span className="text-emerald-400 font-semibold">{s.completed}</span>
                </td>
                <td className="py-3.5 px-3">
                  <span className={cn('font-medium', s.skipped > 0 ? 'text-amber-400' : 'text-slate-500')}>{s.skipped}</span>
                </td>
                <td className="py-3.5 px-3">
                  <span className={cn('font-medium', s.noShows > 0 ? 'text-red-400' : 'text-slate-500')}>{s.noShows}</span>
                </td>
                <td className="py-3.5 px-3 text-slate-300">{s.avgConsultMins != null ? `${s.avgConsultMins}m` : '—'}</td>
                <td className="py-3.5 px-3 text-slate-300">{s.avgWaitMins    != null ? `${s.avgWaitMins}m`    : '—'}</td>
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-raised rounded-full overflow-hidden w-16">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${throughput}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-8 shrink-0">{throughput}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── STAT SUMMARY ROW ─────────────────────────────────────────────────────────

export function AnalyticsStatRow({ stats, className = '' }) {
  const items = [
    {
      label:  'Total Issued',
      value:  stats.issued   ?? 0,
      icon:   Users,
      color:  'teal',
    },
    {
      label:  'Completed',
      value:  stats.completed ?? 0,
      icon:   CheckCircle,
      color:  'emerald',
    },
    {
      label:  'Skipped',
      value:  stats.skipped  ?? 0,
      icon:   AlertTriangle,
      color:  stats.skipped  > 0 ? 'amber' : 'slate',
    },
    {
      label:  'No-Shows',
      value:  stats.noShows  ?? 0,
      icon:   AlertTriangle,
      color:  stats.noShows  > 0 ? 'red'   : 'slate',
    },
    {
      label:  'Avg Wait',
      value:  stats.avgWaitMinutes    != null ? formatDuration(stats.avgWaitMinutes)    : '—',
      icon:   Clock,
      color:  'teal',
    },
    {
      label:  'Avg Consult',
      value:  stats.avgConsultMinutes != null ? formatDuration(stats.avgConsultMinutes) : '—',
      icon:   Clock,
      color:  'emerald',
    },
  ]

  const colorMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    teal:    'text-teal-400 bg-teal-500/10 border-teal-500/20',
    amber:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red:     'text-red-400 bg-red-500/10 border-red-500/20',
    slate:   'text-slate-400 bg-slate-500/10 border-slate-500/20',
  }

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3', className)}>
      {items.map((item) => {
        const Icon = item.icon
        const c    = colorMap[item.color] ?? colorMap.slate
        return (
          <div key={item.label} className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center border mb-3', c)}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-slate-100">{item.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
          </div>
        )
      })}
    </div>
  )
}