import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Download, ArrowRight, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { getAuditLog } from '../utils/api'

const RESOLUTION_COLOR = {
  refunded: '#22c55e', denied: '#ef4444', escalated: '#f59e0b',
  replied: '#06b6d4', cancelled: '#8b5cf6', unknown: '#6b7280',
}
const STATUS_COLOR = { completed: '#22c55e', dead_letter: '#ef4444', processing: '#4F6EF7' }

export default function AuditLog() {
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterResolution, setFilterResolution] = useState('all')
  const [minConf, setMinConf] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterStatus !== 'all') params.status = filterStatus
      if (filterResolution !== 'all') params.resolution = filterResolution
      if (minConf) params.min_confidence = parseFloat(minConf)
      const r = await getAuditLog(params)
      setLog(r.data.audit_log || [])
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [filterStatus, filterResolution, minConf])

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'audit_log.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const downloadTxt = () => {
    const lines = log.map(e => [
      `═══ ${e.ticket_id} ═══`,
      `Subject:    ${e.subject}`,
      `Customer:   ${e.customer_email}`,
      `Status:     ${e.status}`,
      `Resolution: ${e.resolution || '—'}`,
      `Confidence: ${e.confidence != null ? `${(e.confidence * 100).toFixed(0)}%` : '—'}`,
      `Duration:   ${e.duration_ms ? `${(e.duration_ms / 1000).toFixed(1)}s` : '—'}`,
      `Tool Calls: ${e.tool_calls?.length ?? 0}`,
      `Flags:      ${e.flags?.join(', ') || 'none'}`,
      `Reasoning:\n${e.reasoning || '—'}`,
      '',
    ].join('\n'))
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'audit_log.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Audit Log</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Full decision trail for every processed ticket
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTxt} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            <Download size={14} /> Export TXT
          </button>
          <button onClick={downloadJson} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            <Download size={14} /> Export JSON
          </button>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        {[
          { label: 'Status', value: filterStatus, set: setFilterStatus, opts: ['all', 'completed', 'dead_letter'] },
          { label: 'Resolution', value: filterResolution, set: setFilterResolution, opts: ['all', 'refunded', 'denied', 'escalated', 'replied', 'cancelled', 'unknown'] },
        ].map(({ label, value, set, opts }) => (
          <select key={label} value={value} onChange={e => set(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
            {opts.map(o => <option key={o} value={o}>{o === 'all' ? `All ${label}s` : o}</option>)}
          </select>
        ))}
        <input
          type="number" min="0" max="1" step="0.1"
          value={minConf}
          onChange={e => setMinConf(e.target.value)}
          placeholder="Min confidence (0–1)"
          className="px-3 py-2 rounded-lg text-sm w-52"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}
        />
        <span className="text-sm self-center" style={{ color: 'var(--text-muted)' }}>{log.length} entries</span>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />
        </div>
      ) : log.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No audit entries found. <Link to="/run" style={{ color: 'var(--brand)' }}>Run the agent →</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {log.map(entry => (
            <div key={entry.ticket_id} className="card p-5 animate-fade-in">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {entry.status === 'completed'
                      ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                      : entry.status === 'dead_letter'
                      ? <XCircle size={16} style={{ color: 'var(--danger)' }} />
                      : <RefreshCw size={16} style={{ color: 'var(--brand)' }} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold" style={{ color: 'var(--brand)' }}>{entry.ticket_id}</span>
                      {entry.resolution && (
                        <span className="px-2 py-0.5 rounded-full text-xs capitalize"
                          style={{ background: `${RESOLUTION_COLOR[entry.resolution] || '#555'}20`, color: RESOLUTION_COLOR[entry.resolution] || '#aaa' }}>
                          {entry.resolution}
                        </span>
                      )}
                      {entry.flags?.length > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                          style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>
                          <AlertTriangle size={10} /> {entry.flags.length} flag{entry.flags.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>{entry.subject}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{entry.customer_email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs shrink-0">
                  <div className="text-right">
                    <div style={{ color: 'var(--text-muted)' }}>Confidence</div>
                    <div className="font-mono font-bold" style={{
                      color: entry.confidence >= 0.7 ? 'var(--success)' : entry.confidence >= 0.5 ? 'var(--warning)' : 'var(--danger)'
                    }}>
                      {entry.confidence != null ? `${(entry.confidence * 100).toFixed(0)}%` : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div style={{ color: 'var(--text-muted)' }}>Tools</div>
                    <div className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                      {entry.tool_calls?.length ?? 0}
                    </div>
                  </div>
                  <div className="text-right">
                    <div style={{ color: 'var(--text-muted)' }}>Duration</div>
                    <div className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                      {entry.duration_ms ? `${(entry.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </div>
                  </div>
                  <Link to={`/tickets/${entry.ticket_id}`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors"
                    style={{ background: 'rgba(79,110,247,0.1)', color: 'var(--brand)', border: '1px solid rgba(79,110,247,0.2)' }}>
                    Details <ArrowRight size={12} />
                  </Link>
                </div>
              </div>

              {/* Reasoning preview */}
              {entry.reasoning && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--surface-border)' }}>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Reasoning preview</div>
                  <div className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {entry.reasoning.slice(0, 300)}...
                  </div>
                </div>
              )}

              {/* Tool call pills */}
              {entry.tool_calls?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {entry.tool_calls.map((call, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-xs font-mono"
                      style={{
                        background: call.success !== false ? 'rgba(79,110,247,0.1)' : 'rgba(239,68,68,0.1)',
                        color: call.success !== false ? 'var(--brand)' : 'var(--danger)',
                        border: `1px solid ${call.success !== false ? 'rgba(79,110,247,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                      {call.tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
