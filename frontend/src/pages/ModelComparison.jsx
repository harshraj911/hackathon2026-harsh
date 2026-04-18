import React, { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Database, Zap, Clock, ShieldCheck, Activity } from 'lucide-react'

export default function ModelComparison() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
        const r = await fetch(`${baseUrl}/run/compare`)
        const j = await r.json()
        setData(Object.entries(j).map(([name, metrics]) => ({ name, ...metrics })))
      } catch {}
      setLoading(false)
    }
    fetchMetrics()
  }, [])

  if (loading) return <div className="p-10 text-center animate-pulse">Analyzing model performance...</div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl text-white">Multi-Model A/B Benchmark</h1>
        <p className="text-sm text-muted mt-1">Comparing ShopWave Agent performance across NVIDIA NIM models</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accuracy Chart */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <ShieldCheck size={16} className="text-success" />
            Accuracy % (Policy Adherence)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" domain={[0, 1]} hide />
              <YAxis dataKey="name" type="category" tick={{ fill: '#a1a1aa', fontSize: 10 }} width={100} />
              <Tooltip 
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
              />
              <Bar dataKey="accuracy" fill="var(--brand)" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Speed Chart */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
            <Zap size={16} className="text-warning" />
            Latency (Seconds per Ticket)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" tick={{ fill: '#a1a1aa', fontSize: 10 }} width={100} />
              <Tooltip 
                 contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
              />
              <Bar dataKey="avg_duration" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 border-b border-surface-border">
            <tr>
              <th className="px-6 py-4 font-semibold text-white">Model Architecture</th>
              <th className="px-6 py-4 font-semibold text-white">Accuracy</th>
              <th className="px-6 py-4 font-semibold text-white">Avg Latency</th>
              <th className="px-6 py-4 font-semibold text-white">Tokens/Sec</th>
              <th className="px-6 py-4 font-semibold text-white">Reliability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {data.map(m => (
              <tr key={m.name} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-brand">{m.name}</td>
                <td className="px-6 py-4 text-white">{(m.accuracy * 100).toFixed(0)}%</td>
                <td className="px-6 py-4 text-muted">{m.avg_duration}s</td>
                <td className="px-6 py-4 text-muted">{m.tps} tps</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] uppercase font-bold">Stable</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
