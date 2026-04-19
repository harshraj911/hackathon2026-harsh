import axios from 'axios'

let base = import.meta.env.VITE_API_URL || '/api'
if (base !== '/api' && !base.startsWith('http')) {
  base = `https://${base}`
}

export const BASE_URL = base
const api = axios.create({ baseURL: base, timeout: 120000 })

export const getHealth    = () => api.get('/health')
export const getTickets   = () => api.get('/tickets')
export const getTicket    = (id) => api.get(`/tickets/${id}`)
export const runAgent     = (body) => api.post('/run', body)
export const runSingle    = (ticket_id) => api.post('/run/single', { ticket_id })
export const getRunStatus = () => api.get('/run/status')
export const getAuditLog  = (params) => api.get('/audit', { params })
export const getStats     = () => api.get('/stats')
export const resetAudit   = () => api.delete('/audit')

export default api
