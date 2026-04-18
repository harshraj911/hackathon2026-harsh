import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid
} from 'recharts'
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Zap,
  TrendingUp, ArrowRight, RefreshCw, Activity
} from 'lucide-react'
import { getStats, getTickets } from '../utils/api'

const COLORS = {
  refunded: '#10b981',
  denied: '#f43f5e',
  escalated: '#f59e0b',
  replied: '#3b82f6',
  cancelled: '#6366f1',
  pending_info: '#71717a',
  unknown: '#3f3f46',
}

const TIER_COLORS = { vip: '#f59e0b', premium: '#6366f1', standard: '#a1a1aa' }

function StatCard({ label, value, sub, icon: Icon, color = 'var(--brand)', trend }) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}22` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div>
        <div className="font-display font-bold text-3xl" style={{ color: 'var(--text-primary)' }}>{value}</div>
        {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [s, t] = await Promise.all([getStats(), getTickets()])
      setStats(s.data)
      setTickets(t.data.tickets || [])
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const processed = tickets.filter(t => t.status !== 'pending')
  const pending = tickets.filter(t => t.status === 'pending')
  const escalated = tickets.filter(t => t.resolution === 'escalated')
  const avgConf = stats?.avg_confidence ? `${(stats.avg_confidence * 100).toFixed(0)}%` : '—'

  const resolutionData = stats?.resolution_breakdown
    ? Object.entries(stats.resolution_breakdown).map(([k, v]) => ({ name: k, value: v, color: COLORS[k] }))
    : []

  const tierData = ['vip', 'premium', 'standard'].map(tier => ({
    tier,
    count: tickets.filter(t => t.tier === tier).length,
    resolved: tickets.filter(t => t.tier === tier && t.status === 'completed').length,
  }))

  const confidenceHist = processed
    .filter(t => t.confidence != null)
    .reduce((acc, t) => {
      const bucket = `${Math.floor(t.confidence * 10) * 10}%`
      const existing = acc.find(a => a.range === bucket)
      if (existing) existing.count++
      else acc.push({ range: bucket, count: 1 })
      return acc
    }, [])
    .sort((a, b) => a.range.localeCompare(b.range))

  const recentActivity = [...processed]
    .sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0))
    .slice(0, 8)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3" style={{ color: 'var(--text-secondary)' }}>
          <RefreshCw size={20} className="animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>
            Operations Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Real-time overview of the autonomous support agent
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <Link
            to="/run"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'var(--brand)', color: 'white' }}
          >
            <Zap size={14} />
            Run Agent
          </Link>
        </div>
      </div>

      {/* Stat cards */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tickets" value={tickets.length} icon={Activity} />
        <StatCard label="Token Efficiency" value={`${Math.round((stats?.total_tokens || 0) / (tickets.length || 1))} / tkt`} icon={Zap} color="var(--brand)" />
        <StatCard label="Avg Resolution Time" value={stats?.avg_duration_ms ? `${(stats.avg_duration_ms / 1000).toFixed(1)}s` : '—'} icon={Clock} color="var(--info)" />
        <div className="aurora-glow rounded-2xl overflow-hidden p-[1px]">
          <div className="relative h-full">
            <StatCard label="Avg Confidence" value={avgConf} sub={`${stats?.total_tool_calls || 0} tool calls`} icon={TrendingUp} color="#a855f7" />
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Resolution pie */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
            Resolution Breakdown
          </h3>
          {resolutionData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={resolutionData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                    {resolutionData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-primary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {resolutionData.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="status-dot" style={{ background: d.color }} />
                    <span style={{ color: 'var(--text-secondary)' }} className="capitalize">{d.name}</span>
                    <span className="ml-auto font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--text-muted)' }}>
              No data yet — run the agent first
            </div>
          )}
        </div>

        {/* Customer Sentiment */}
        <div className="card p-5">
           <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Customer Sentiment Heatmap</h3>
           <div className="space-y-4">
             {['angry', 'frustrated', 'neutral', 'happy'].map(s => {
               const count = tickets.filter(t => t.sentiment === s).length;
               const pct = tickets.length > 0 ? (count / tickets.length) * 100 : 0;
               const colors = { angry: 'var(--danger)', frustrated: 'var(--warning)', neutral: 'var(--text-secondary)', happy: 'var(--success)' };
               return (
                 <div key={s}>
                   <div className="flex justify-between text-xs mb-1 capitalize">
                     <span style={{ color: colors[s] }}>{s}</span>
                     <span>{count}</span>
                   </div>
                   <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                     <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: colors[s] }} />
                   </div>
                 </div>
               )
             })}
           </div>
        </div>

        {/* Confidence histogram */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
            Confidence Distribution
          </h3>
          {confidenceHist.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={confidenceHist} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="var(--brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--text-muted)' }}>No data yet</div>
          )}
        </div>

        {/* Tier breakdown */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
            Tickets by Customer Tier
          </h3>
          <div className="space-y-4 mt-2">
            {tierData.map(({ tier, count, resolved }) => (
              <div key={tier}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="status-dot" style={{ background: TIER_COLORS[tier] }} />
                    <span className="capitalize font-medium" style={{ color: 'var(--text-primary)' }}>{tier}</span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)' }}>{resolved}/{count}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--surface-border)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: count > 0 ? `${(resolved / count) * 100}%` : '0%', background: TIER_COLORS[tier] }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="font-mono font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                  {stats?.avg_tool_calls_per_ticket || 0}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>avg tool calls</div>
              </div>
              <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="font-mono font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                  {stats?.avg_duration_ms ? `${(stats.avg_duration_ms / 1000).toFixed(1)}s` : '—'}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>avg resolve time</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Recent Activity
          </h3>
          <Link to="/tickets" className="flex items-center gap-1 text-xs" style={{ color: 'var(--brand)' }}>
            View all <ArrowRight size={12} />
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
            No tickets processed yet. <Link to="/run" style={{ color: 'var(--brand)' }}>Run the agent →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivity.map(ticket => (
              <Link
                key={ticket.ticket_id}
                to={`/tickets/${ticket.ticket_id}`}
                className="flex items-center gap-4 p-3 rounded-lg transition-colors hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--surface-border)' }}
              >
                <span className="status-dot" style={{ background: COLORS[ticket.resolution] || '#555' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {ticket.ticket_id} — {ticket.subject}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{ticket.customer_email}</div>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="capitalize px-2 py-0.5 rounded-full"
                    style={{ background: `${COLORS[ticket.resolution] || '#555'}22`, color: COLORS[ticket.resolution] || '#aaa' }}>
                    {ticket.resolution || ticket.status}
                  </span>
                  {ticket.confidence != null && (
                    <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                      {(ticket.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                  <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
