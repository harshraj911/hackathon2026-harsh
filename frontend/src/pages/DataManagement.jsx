import React, { useState, useEffect } from 'react'
import { Save, FileJson, AlertCircle, CheckCircle2, Info } from 'lucide-react'

const FILES = [
  { id: 'tickets.json',   label: 'Tickets Data',   description: 'Core support tickets to be processed.' },
  { id: 'orders.json',    label: 'Orders Data',    description: 'Order details, shipping status, and refund states.' },
  { id: 'customers.json', label: 'Customers Data', description: 'Customer profiles, tiers, and policy exceptions.' },
  { id: 'products.json',  label: 'Products Data',  description: 'Product metadata, warranty, and return policies.' },
]

export default function DataManagement() {
  const [activeFile, setActiveFile] = useState(FILES[0])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const loadFile = async (file) => {
    setLoading(true)
    setMessage(null)
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
      const r = await fetch(`${baseUrl}/data/files/${file.id}`)
      const data = await r.json()
      setContent(JSON.stringify(data, null, 2))
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to load ${file.id}` })
    }
    setLoading(false)
  }

  useEffect(() => {
    loadFile(activeFile)
  }, [activeFile])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      let parsed
      try {
        parsed = JSON.parse(content)
      } catch (e) {
        throw new Error('Invalid JSON format')
      }

      const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
      const r = await fetch(`${baseUrl}/data/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: activeFile.id, content: parsed })
      })
      
      if (!r.ok) throw new Error('Failed to save file')
      
      setMessage({ type: 'success', text: `${activeFile.id} updated successfully!` })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Data Management</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Configure mock data sources. Ensure IDs (OrderID, CustomerEmail) are correlated across files.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-2">
          {FILES.map(file => (
            <button
              key={file.id}
              onClick={() => setActiveFile(file)}
              className={`w-full text-left p-4 rounded-xl transition-all border ${
                activeFile.id === file.id 
                  ? 'border-brand/40 bg-brand/5' 
                  : 'border-white/5 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileJson size={18} className={activeFile.id === file.id ? 'text-brand' : 'text-muted'} />
                <span className={`text-sm font-medium ${activeFile.id === file.id ? 'text-white' : 'text-secondary'}`}>
                  {file.label}
                </span>
              </div>
              <p className="text-[10px] mt-1 text-muted leading-relaxed">
                {file.description}
              </p>
            </button>
          ))}

          <div className="p-4 rounded-xl bg-warning/5 border border-warning/20 mt-6">
            <div className="flex gap-2 text-warning">
              <Info size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider">Correlation Warning</p>
                <p className="text-[10px] leading-relaxed mt-1 opacity-80">
                  Tickets reference CustomerEmail and OrderIDs. Ensure these exist in the respective files or the agent will fail to find info.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-brand">{activeFile.id}</span>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="btn btn-primary py-1.5 px-4 text-xs flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                Save Changes
              </button>
            </div>

            <div className="relative">
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                disabled={loading}
                spellCheck={false}
                className="w-full h-[600px] p-6 font-mono text-xs bg-transparent outline-none resize-none leading-relaxed"
                style={{ color: '#d1d5db' }}
              />
              {loading && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                  <RefreshCw size={24} className="animate-spin text-brand" />
                </div>
              )}
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-xl flex items-center gap-3 animate-slide-up ${
              message.type === 'success' 
                ? 'bg-success/10 border border-success/20 text-success' 
                : 'bg-danger/10 border border-danger/20 text-danger'
            }`}>
              {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function RefreshCw({ size, className }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}
