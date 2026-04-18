import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL: BASE, timeout: 120000 })

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
