import React from 'react'
import { Link } from 'react-router-dom'
import { Play, Square, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { useRun } from '../hooks/useRunContext'

const RESOLUTION_COLOR = {
  refunded:        'var(--success)',
  resolved:        'var(--success)',
  policy_explained:'#22c55e',
  no_action:       '#64748b',
  denied:          'var(--danger)',
  escalated:       'var(--warning)',
  replied:         'var(--info)',
  completed:       'var(--success)',
  dead_letter:     'var(--danger)',
  failed:          'var(--danger)',
}

export default function RunAgent() {
  const { running, done, status, events, concurrency, setConcurrency, startRun, stopRun, reset } = useRun()

  const [totalTickets, setTotalTickets] = React.useState(0)
  React.useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/tickets`)
      .then(r => r.json())
      .then(data => setTotalTickets(data.total || 0))
      .catch(() => setTotalTickets(20))
  }, [])

  const eventsEndRef = React.useRef(null)
  React.useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const completedCount = events.filter(e => e.status === 'completed').length
  const failedCount    = events.filter(e => ['failed', 'dead_letter'].includes(e.status)).length

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Run Agent</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Process all {totalTickets || 'the'} support tickets concurrently with autonomous resolution
        </p>
      </div>

      {/* Config */}
      <div className="card p-6">
        <h2 className="font-display font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
          Configuration
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
              Concurrency Limit
            </label>
            <select
              value={concurrency}
              onChange={e => setConcurrency(Number(e.target.value))}
              disabled={running}
              className="w-full px-3 py-2 rounded-lg text-sm font-mono"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--surface-border)',
                color: 'var(--text-primary)',
              }}
            >
              {[1, 2, 3, 5, 10, 15, 20, 25].map(n => (
                <option key={n} value={n}>{n} parallel tickets</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={startRun}
              disabled={running}
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: 'var(--brand)', color: 'white' }}
            >
              {running ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
              {running ? 'Running…' : 'Start Full Run'}
            </button>

            {running && (
              <button
                onClick={stopRun}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: '#f59e0b', color: '#fff' }}
              >
                <Square size={14} fill="currentColor" />
                Stop
              </button>
            )}

            <button
              onClick={reset}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: 'var(--danger)',
              }}
            >
              <RefreshCw size={14} />
              Reset
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {(running || done) && status && (
          <div className="mt-5">
            <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
              <span>{status.processed} / {status.total} tickets</span>
              <span>{status.progress_pct}%</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: 'var(--surface-border)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${status.progress_pct}%`, background: 'var(--brand)' }}
              />
            </div>
            {done && (
              <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--success)' }}>
                <CheckCircle2 size={14} />
                Run complete! {completedCount} resolved, {failedCount} failed.
                <Link to="/audit" style={{ color: 'var(--brand)' }}>View audit log →</Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live event feed — persists when you navigate away and come back */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Live Event Feed
          </h2>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {running && (
              <span className="flex items-center gap-1.5">
                <span className="status-dot animate-pulse" style={{ background: 'var(--brand)' }} />
                Processing
              </span>
            )}
            <span>{events.length} events</span>
          </div>
        </div>

        <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--surface-border)' }}>
          {/* Terminal title bar */}
          <div className="px-4 py-2 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid var(--surface-border)' }}>
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: '#ef4444' }} />
              <span className="w-3 h-3 rounded-full" style={{ background: '#f59e0b' }} />
              <span className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
            </div>
            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>agent.log</span>
          </div>

          <div className="p-4 h-80 overflow-y-auto font-mono text-xs space-y-1.5">
            {events.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>
                {running ? '$ waiting for first ticket…' : '$ run the agent to see live events here'}
              </div>
            ) : (
              events.map((evt, i) => {
                const color = RESOLUTION_COLOR[evt.resolution] || RESOLUTION_COLOR[evt.status] || '#aaa'
                const ts = new Date(evt.timestamp).toLocaleTimeString()
                return (
                  <div key={i} className="flex items-start gap-3 animate-slide-up">
                    <span style={{ color: 'var(--text-muted)' }}>[{ts}]</span>
                    <span style={{ color: 'var(--brand)' }}>{evt.ticket_id}</span>
                    <span style={{ color }}>
                      {['failed','dead_letter'].includes(evt.status) ? '✗ FAILED' : `✓ ${evt.resolution || evt.status}`}
                    </span>
                    {evt.confidence != null && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        conf={`${(evt.confidence * 100).toFixed(0)}%`}
                      </span>
                    )}
                  </div>
                )
              })
            )}
            <div ref={eventsEndRef} />
          </div>
        </div>

        {/* Summary badges */}
        {events.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4">
            {[
              { label: 'Completed',       count: completedCount, color: 'var(--success)' },
              { label: 'Failed',          count: failedCount,    color: 'var(--danger)' },
              { label: 'Refunded',        count: events.filter(e => e.resolution === 'refunded').length,        color: '#22c55e' },
              { label: 'Escalated',       count: events.filter(e => e.resolution === 'escalated').length,       color: 'var(--warning)' },
              { label: 'Policy Explained',count: events.filter(e => e.resolution === 'policy_explained').length,color: '#60a5fa' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
                <span className="font-bold">{count}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
