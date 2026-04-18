import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Ticket, ScrollText, Play,
  Zap, Activity, Menu, X, Github, ChevronRight
} from 'lucide-react'
import { getHealth } from '../utils/api'

const NAV = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/run',     icon: Play,            label: 'Run Agent' },
  { to: '/tickets', icon: Ticket,          label: 'Tickets' },
  { to: '/audit',   icon: ScrollText,      label: 'Audit Log' },
]

export default function Layout({ children }) {
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [health, setHealth] = useState(null)

  useEffect(() => {
    getHealth().then(r => setHealth(r.data)).catch(() => setHealth(null))
  }, [])

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--surface-bg)' }}>
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col w-64 transition-transform duration-300
          lg:translate-x-0 lg:static lg:flex
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: 'var(--surface-card)', borderRight: '1px solid var(--surface-border)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: '1px solid var(--surface-border)' }}>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: 'var(--brand)' }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <div className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>ShopWave</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Support Agent</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)}>
            <X size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to))
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group"
                style={{
                  background: active ? 'rgba(79,110,247,0.12)' : 'transparent',
                  color: active ? 'var(--brand)' : 'var(--text-secondary)',
                }}
              >
                <Icon size={18} />
                <span className="font-medium text-sm">{label}</span>
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            )
          })}
        </nav>

        {/* Status */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <span className="status-dot" style={{ background: health ? 'var(--success)' : '#555', boxShadow: health ? '0 0 6px rgba(34,197,94,0.6)' : 'none' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {health ? `API Online · ${health.tickets_loaded} tickets` : 'API Offline'}
            </span>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 mt-2 rounded-lg text-xs transition-colors hover:text-white"
            style={{ color: 'var(--text-muted)' }}
          >
            <Github size={14} />
            View on GitHub
          </a>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header
          className="lg:hidden flex items-center gap-3 px-4 py-3"
          style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--surface-border)' }}
        >
          <button onClick={() => setOpen(true)}>
            <Menu size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <span className="font-display font-bold text-sm" style={{ color: 'var(--text-primary)' }}>ShopWave Agent</span>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
