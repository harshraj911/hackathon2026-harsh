import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { RunProvider } from './hooks/useRunContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import TicketList from './pages/TicketList'
import TicketDetail from './pages/TicketDetail'
import AuditLog from './pages/AuditLog'
import RunAgent from './pages/RunAgent'
import DataManagement from './pages/DataManagement'

export default function App() {
  return (
    <RunProvider>
      <Layout>
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/tickets"     element={<TicketList />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/audit"       element={<AuditLog />} />
          <Route path="/run"         element={<RunAgent />} />
          <Route path="/data"        element={<DataManagement />} />
        </Routes>
      </Layout>
    </RunProvider>
  )
}
