import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import api, { BASE_URL } from '../utils/api'

const RunContext = createContext(null)

export function RunProvider({ children }) {
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [status, setStatus] = useState(null)
  const [events, setEvents] = useState([])
  const [concurrency, setConcurrency] = useState(3)

  const esRef = useRef(null)
  const pollRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    // On first load, sync with whatever the backend says
    api.get('/run/status').then(r => {
      if (!mountedRef.current) return
      const d = r.data
      setStatus(d)
      if (d.running) {
        setRunning(true)
        startPolling()
      } else if (d.processed > 0) {
        setDone(true)
      }
    }).catch(() => { })

    return () => {
      mountedRef.current = false
      esRef.current?.close()
      clearInterval(pollRef.current)
    }
  }, [])

  const startPolling = useCallback(() => {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get('/run/status')
        if (!mountedRef.current) return
        const d = r.data
        setStatus(d)
        // Sync events from recent_events
        if (d.recent_events?.length) {
          setEvents(prev => {
            const existingIds = new Set(prev.map(e => e.ticket_id + e.timestamp))
            const newEvts = d.recent_events.filter(e => !existingIds.has(e.ticket_id + e.timestamp))
            return newEvts.length ? [...prev, ...newEvts] : prev
          })
        }
        if (!d.running) {
          clearInterval(pollRef.current)
          setRunning(false)
          if (d.processed > 0) setDone(true)
        }
      } catch { }
    }, 1500)
  }, [])

  const startRun = useCallback(async () => {
    setEvents([])
    setDone(false)
    setRunning(true)

    try {
      await api.post('/run', { concurrency })
    } catch (e) {
      setRunning(false)
      return
    }

    // Open SSE for live events
    esRef.current?.close()
    const es = new EventSource(`${BASE_URL}/run/stream`)
    esRef.current = es

    es.onmessage = (e) => {
      if (!mountedRef.current) return
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'complete') {
          setRunning(false)
          setDone(true)
          es.close()
          clearInterval(pollRef.current)
        } else {
          setEvents(prev => [...prev, data])
        }
      } catch { }
    }

    es.onerror = () => {
      es.close()
      // Fallback: polling handles it
    }

    // Always poll in parallel for status bar (survives SSE drops)
    startPolling()
  }, [concurrency, startPolling])

  const stopRun = useCallback(async () => {
    try {
      await api.post('/run/stop')
      setRunning(false)
      clearInterval(pollRef.current)
      esRef.current?.close()
    } catch { }
  }, [])

  const reset = useCallback(async () => {
    esRef.current?.close()
    clearInterval(pollRef.current)
    try { await api.delete('/audit') } catch { }
    setEvents([])
    setStatus(null)
    setDone(false)
    setRunning(false)
  }, [])

  return (
    <RunContext.Provider value={{ running, done, status, events, concurrency, setConcurrency, startRun, stopRun, reset }}>
      {children}
    </RunContext.Provider>
  )
}

export function useRun() {
  return useContext(RunContext)
}
