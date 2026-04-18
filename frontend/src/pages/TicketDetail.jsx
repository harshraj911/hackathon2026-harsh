import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Play, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, ChevronDown, ChevronRight, Clock, Zap,
  User, Package, FileText, MessageSquare
} from 'lucide-react'
import { getTicket, runSingle } from '../utils/api'

const RESOLUTION_COLOR = {
  refunded: '#22c55e', denied: '#ef4444', escalated: '#f59e0b',
  replied: '#06b6d4', cancelled: '#8b5cf6',
}
const TIER_COLOR = { vip: '#f59e0b', premium: '#4F6EF7', standard: '#6b7280' }
const TOOL_ICON = {
  get_customer: User, get_order: Package, get_product: Package,
  search_knowledge_base: FileText, get_orders_by_email: User,
  check_refund_eligibility: CheckCircle2, issue_refund: Zap,
  send_reply: MessageSquare, escalate: AlertTriangle,
}
const TOOL_COLOR = {
  get_customer: '#4F6EF7', get_order: '#06b6d4', get_product: '#8b5cf6',
  search_knowledge_base: '#f59e0b', get_orders_by_email: '#4F6EF7',
  check_refund_eligibility: '#22c55e', issue_refund: '#ef4444',
  send_reply: '#22c55e', escalate: '#f59e0b',
}

function ToolCallCard({ call, index }) {
  const [open, setOpen] = useState(false)
  const Icon = TOOL_ICON[call.tool] || Zap
  const color = TOOL_COLOR[call.tool] || '#aaa'
  const success = call.success !== false && !call.output?.error

  return (
    <div className="relative">
      {/* Connector line */}
      <div className="absolute left-4 top-10 bottom-0 w-px" style={{ background: 'var(--surface-border)' }} />

      <div className="flex gap-3 mb-3">
        {/* Step icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10"
          style={{ background: `${color}20`, border: `2px solid ${color}` }}>
          <Icon size={14} style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-full text-left p-3 rounded-lg transition-colors hover:opacity-90"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--surface-border)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs font-medium" style={{ color }}>
                  {index + 1}. {call.tool}
                </span>
                <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  ({Object.entries(call.input || {}).map(([k, v]) => `${k}="${v}"`).join(', ')})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`w-2 h-2 rounded-full`} style={{ background: success ? 'var(--success)' : 'var(--danger)' }} />
                {open ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
              </div>
            </div>
          </button>

          {open && (
            <div className="mt-2 rounded-lg overflow-hidden animate-slide-up"
              style={{ border: '1px solid var(--surface-border)' }}>
              <div className="grid grid-cols-2">
                <div className="p-3" style={{ borderRight: '1px solid var(--surface-border)' }}>
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>INPUT</div>
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono"
                    style={{ color: '#06b6d4' }}>
                    {JSON.stringify(call.input, null, 2)}
                  </pre>
                </div>
                <div className="p-3">
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>OUTPUT</div>
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono"
                    style={{ color: success ? '#22c55e' : '#ef4444' }}>
                    {JSON.stringify(call.output, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TicketDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await getTicket(id)
      setData(r.data)
    } catch { }
    setLoading(false)
  }

  const handleRun = async () => {
    setRunning(true)
    try {
      await runSingle(id)
      await load()
    } catch { }
    setRunning(false)
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--text-secondary)' }} />
    </div>
  )

  if (!data) return (
    <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>Ticket not found</div>
  )

  const { ticket, audit } = data
  const resolution = audit?.resolution
  const resColor = RESOLUTION_COLOR[resolution] || '#aaa'

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link to="/tickets" className="mt-1 flex items-center gap-1 text-sm transition-colors hover:text-white"
          style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm font-bold" style={{ color: 'var(--brand)' }}>{ticket.ticket_id}</span>
            <span className="px-2 py-0.5 rounded text-xs capitalize"
              style={{ background: `${TIER_COLOR[ticket.tier]}20`, color: TIER_COLOR[ticket.tier] }}>
              {ticket.tier}
            </span>
            {resolution && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
                style={{ background: `${resColor}20`, color: resColor, border: `1px solid ${resColor}40` }}>
                {resolution}
              </span>
            )}
          </div>
          <h1 className="font-display font-bold text-xl mt-1" style={{ color: 'var(--text-primary)' }}>
            {ticket.subject}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {ticket.customer_email} · {ticket.source?.replace('_', ' ')} · {new Date(ticket.created_at).toLocaleString()}
          </p>
        </div>

        <button onClick={handleRun} disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          style={{ background: 'var(--brand)', color: 'white' }}>
          {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          {audit ? 'Re-run' : 'Run Now'}
        </button>
      </div>

      {/* Ticket body */}
      <div className="card p-5">
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>CUSTOMER MESSAGE</div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{ticket.body}</p>
      </div>

      {!audit ? (
        <div className="card p-10 text-center">
          <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>This ticket hasn't been processed yet.</div>
          <button onClick={handleRun} disabled={running}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium mx-auto transition-all"
            style={{ background: 'var(--brand)', color: 'white' }}>
            {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? 'Processing...' : 'Process This Ticket'}
          </button>
        </div>
      ) : (
        <>
          {/* Metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Confidence', value: audit.confidence != null ? `${(audit.confidence * 100).toFixed(0)}%` : '—', color: audit.confidence >= 0.7 ? 'var(--success)' : audit.confidence >= 0.5 ? 'var(--warning)' : 'var(--danger)' },
              { label: 'Tool Calls', value: audit.tool_calls?.length ?? 0, color: 'var(--brand)' },
              { label: 'LLM Calls', value: audit.llm_calls ?? 1, color: '#8b5cf6' },
              { label: 'Duration', value: audit.duration_ms ? `${(audit.duration_ms / 1000).toFixed(1)}s` : '—', color: 'var(--text-secondary)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-4">
                <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
                <div className="font-display font-bold text-2xl" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Flags */}
          {audit.flags?.length > 0 && (
            <div className="card p-4 flex flex-wrap gap-2 items-center">
              <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--warning)' }}>Flags raised:</span>
              {audit.flags.map(f => (
                <span key={f} className="px-2 py-0.5 rounded text-xs"
                  style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--warning)' }}>
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* Tool call trace */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-sm mb-5" style={{ color: 'var(--text-primary)' }}>
              Tool Call Chain ({audit.tool_calls?.length ?? 0} calls)
            </h2>
            {audit.tool_calls?.length > 0 ? (
              <div className="space-y-0">
                {audit.tool_calls.map((call, i) => (
                  <ToolCallCard key={i} call={call} index={i} />
                ))}
              </div>
            ) : (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No tool calls recorded</div>
            )}
          </div>

          {/* Reasoning */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
              Agent Reasoning
            </h2>
            <div className="text-sm leading-relaxed whitespace-pre-wrap p-4 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.2)', color: 'var(--text-secondary)', fontFamily: 'inherit' }}>
              {audit.reasoning || audit.raw_response || 'No reasoning captured'}
            </div>
          </div>

          {/* Customer reply */}
          {audit.customer_message && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={16} style={{ color: 'var(--success)' }} />
                <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Message Sent to Customer
                </h2>
              </div>
              <div className="text-sm leading-relaxed p-4 rounded-lg"
                style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', color: 'var(--text-primary)' }}>
                {audit.customer_message}
              </div>
            </div>
          )}

          {/* Error (dead letter) */}
          {audit.error && (
            <div className="card p-5" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={16} style={{ color: 'var(--danger)' }} />
                <h2 className="font-display font-semibold text-sm" style={{ color: 'var(--danger)' }}>
                  Processing Error (Dead Letter)
                </h2>
              </div>
              <pre className="text-xs font-mono p-3 rounded-lg overflow-x-auto"
                style={{ background: 'rgba(239,68,68,0.05)', color: 'var(--danger)' }}>
                {audit.error}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}
