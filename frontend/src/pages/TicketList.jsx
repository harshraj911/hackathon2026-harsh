import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, ArrowRight, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react'
import { getTickets } from '../utils/api'

const RESOLUTION_COLOR = {
  refunded: '#22c55e', denied: '#ef4444', escalated: '#f59e0b',
  replied: '#06b6d4', cancelled: '#8b5cf6', pending_info: '#6b7280',
  unknown: '#374151',
}
const TIER_COLOR = { vip: '#f59e0b', premium: '#4F6EF7', standard: '#6b7280' }
const STATUS_COLOR = { completed: '#22c55e', dead_letter: '#ef4444', processing: '#4F6EF7', pending: '#6b7280' }
const SENTIMENT_COLOR = { happy: '#10b981', neutral: '#a1a1aa', frustrated: '#f59e0b', angry: '#f43f5e' }

export default function TicketList() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTier, setFilterTier] = useState('all')
  const [filterResolution, setFilterResolution] = useState('all')
  const [sortBy, setSortBy] = useState('ticket_id')
  const [sortDir, setSortDir] = useState('asc')

  const load = async () => {
    setLoading(true)
    try {
      const r = await getTickets()
      setTickets(r.data.tickets || [])
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const filtered = tickets
    .filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterTier !== 'all' && t.tier !== filterTier) return false
      if (filterResolution !== 'all' && t.resolution !== filterResolution) return false
      if (search) {
        const q = search.toLowerCase()
        return t.ticket_id.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.customer_email.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      let va = a[sortBy] ?? '', vb = b[sortBy] ?? ''
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return null
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
  }

  const Th = ({ col, label }) => (
    <th
      className="text-left px-4 py-3 text-xs font-medium cursor-pointer select-none"
      style={{ color: sortBy === col ? 'var(--brand)' : 'var(--text-muted)' }}
      onClick={() => toggleSort(col)}
    >
      <span className="flex items-center gap-1">{label}<SortIcon col={col} /></span>
    </th>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Tickets</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {filtered.length} of {tickets.length} tickets
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
          style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-48 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--surface-border)' }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {[
          { label: 'Status', value: filterStatus, set: setFilterStatus, opts: ['all', 'pending', 'processing', 'completed', 'dead_letter'] },
          { label: 'Tier', value: filterTier, set: setFilterTier, opts: ['all', 'vip', 'premium', 'standard'] },
          { label: 'Resolution', value: filterResolution, set: setFilterResolution, opts: ['all', 'refunded', 'denied', 'escalated', 'replied', 'cancelled'] },
        ].map(({ label, value, set, opts }) => (
          <select key={label} value={value} onChange={e => set(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)' }}>
            {opts.map(o => <option key={o} value={o}>{o === 'all' ? `All ${label}s` : o}</option>)}
          </select>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ borderBottom: '1px solid var(--surface-border)', background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <Th col="ticket_id" label="Ticket ID" />
                <Th col="subject" label="Subject" />
                <Th col="customer_email" label="Customer" />
                <Th col="tier" label="Tier" />
                <Th col="source" label="Source" />
                <Th col="status" label="Status" />
                <Th col="resolution" label="Resolution" />
                <Th col="sentiment" label="Sentiment" />
                <Th col="confidence" label="Conf." />
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <RefreshCw size={16} className="animate-spin inline mr-2" />Loading...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
                  No tickets match your filters
                </td></tr>
              ) : filtered.map((ticket, i) => (
                <tr key={ticket.ticket_id}
                  style={{ 
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    boxShadow: ticket.sentiment === 'angry' ? 'inset 4px 0 0 #f43f5e, 0 0 15px rgba(244,63,94,0.05)' : 'none'
                  }}
                  className={`hover:bg-white/[0.02] transition-colors ${ticket.sentiment === 'angry' ? 'bg-red-500/5' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium" style={{ color: 'var(--brand)' }}>{ticket.ticket_id}</span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span className="text-sm truncate block" style={{ color: 'var(--text-primary)' }}>{ticket.subject}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{ticket.customer_email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs capitalize font-medium"
                      style={{ background: `${TIER_COLOR[ticket.tier]}20`, color: TIER_COLOR[ticket.tier] }}>
                      {ticket.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{ticket.source?.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs capitalize">
                      <span className="status-dot" style={{ background: STATUS_COLOR[ticket.status] || '#555' }} />
                      <span style={{ color: STATUS_COLOR[ticket.status] || 'var(--text-muted)' }}>{ticket.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {ticket.resolution ? (
                      <span className="px-2 py-0.5 rounded-full text-xs capitalize"
                        style={{ background: `${RESOLUTION_COLOR[ticket.resolution] || '#555'}20`, color: RESOLUTION_COLOR[ticket.resolution] || '#aaa' }}>
                        {ticket.resolution}
                      </span>
                    ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {ticket.sentiment ? (
                      <span className="text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: SENTIMENT_COLOR[ticket.sentiment] }}>
                        {ticket.sentiment}
                      </span>
                    ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {ticket.confidence != null
                      ? <span className="font-mono text-xs" style={{ color: ticket.confidence >= 0.7 ? 'var(--success)' : ticket.confidence >= 0.5 ? 'var(--warning)' : 'var(--danger)' }}>
                          {(ticket.confidence * 100).toFixed(0)}%
                        </span>
                      : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/tickets/${ticket.ticket_id}`}
                      className="flex items-center gap-1 text-xs transition-colors hover:text-white"
                      style={{ color: 'var(--text-muted)' }}>
                      View <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
