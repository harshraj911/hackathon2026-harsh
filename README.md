# ShopWave Autonomous Support Resolution Agent

> Ksolves Agentic AI Hackathon 2026 — En(AI)bling

An AI agent that autonomously resolves 20 ShopWave customer support tickets end-to-end — classifying, triaging, taking actions, escalating intelligently, and logging every decision with full reasoning traces.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Dashboard                       │
│  Dashboard │ Run Agent │ Ticket List │ Audit Log         │
└────────────────────┬────────────────────────────────────┘
                     │ REST + SSE
┌────────────────────▼────────────────────────────────────┐
│              FastAPI Backend (Python 3.12)               │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │          TicketProcessor (asyncio)               │    │
│  │  • Semaphore-limited concurrency (N parallel)    │    │
│  │  • Agentic loop with robust ReAct pattern        │    │
│  │  • Multi-model fallback matrix (NVIDIA NIM)      │    │
│  │  • Dead-letter queue for failed tickets          │    │
│  └──────────────────┬──────────────────────────────┘    │
│                     │                                    │
│  ┌──────────────────▼──────────────────────────────┐    │
│  │        NVIDIA NIM — Multi-Model Cluster          │    │
│  │  • Primary: Llama-3.3-70b-instruct               │    │
│  │  • Fallback: Llama-3.1-405b / Nemotron-70b       │    │
│  │  • Structured JSON resolution output             │    │
│  └──────────────────┬──────────────────────────────┘    │
│                     │                                    │
│  ┌──────────────────▼──────────────────────────────┐    │
│  │              Mock Tool Layer                     │    │
│  │  READ:  get_order │ get_customer │ get_product   │    │
│  │         search_knowledge_base │ get_orders_by_email│   │
│  │  WRITE: check_refund_eligibility │ issue_refund  │    │
│  │         send_reply │ escalate                    │    │
│  │  Failures: 8% random error │ 5% timeout         │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- An NVIDIA NIM API Key (via integrate.api.nvidia.com)

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/hackathon2026-YOUR_NAME
cd hackathon2026-YOUR_NAME
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt

# Set your API key
export NVIDIA_API_KEY=nvapi-...

# Optional Fallbacks
export NVIDIA_API_KEY_FALLBACK_1=nvapi-...
export NVIDIA_API_KEY_FALLBACK_2=nvapi-...

# Start the server
uvicorn main:app --reload --port 8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 4. Run the agent
- Open `http://localhost:3000/run`
- Click **Start Full Run**
- Watch all 20 tickets process concurrently in real time

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| LLM | NVIDIA NIM Cluster (Llama-3.3-70b / Llama-3.1-405b) |
| Backend | FastAPI + asyncio (Python 3.12) |
| Frontend | React 18 + Vite + Recharts |
| Deployment | Railway (backend) + Vercel (frontend) |
| Architecture | Agentic loop with tool-calling |

---

## ✅ Agent Constraints Satisfied

### Chain
Every ticket triggers at minimum 3 tool calls in sequence:
`get_customer → get_order → get_product → check_refund_eligibility → issue_refund/send_reply/escalate`

### Recover
All tool calls are wrapped in retry logic with backoff. The agent also implements a **Multi-Model Fallback Matrix**: if the primary model hits a rate limit (429), capability error (e.g., "single tool-calls only"), or 5xx error, it automatically rotates to the next available model in the NVIDIA NIM cluster (Llama-3.1-405B, Nemotron-70B, etc.).

### Concurrency
`process_all_tickets()` uses `asyncio.Semaphore` to process N tickets in parallel. Tool calls within a single ticket also run concurrently via `asyncio.gather()`.

### Explain
Every resolution includes:
- Full reasoning text explaining each decision
- Structured JSON resolution block with confidence score
- Per-tool-call input/output trace visible in the dashboard
- Flags for any suspicious or notable patterns

---

## 📁 Repository Structure

```
.
├── backend/
│   ├── main.py              # FastAPI app + all endpoints
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── railway.toml
│   ├── agent/
│   │   └── processor.py     # TicketProcessor — core agentic loop
│   ├── tools/
│   │   └── mock_tools.py    # All 9 tools with failure simulation
│   └── data/                # tickets, orders, customers, products, KB
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, RunAgent, TicketList, TicketDetail, AuditLog
│   │   ├── components/      # Layout, shared components
│   │   └── utils/api.js     # Axios API client
│   ├── vercel.json
│   └── package.json
├── architecture.md           # Architecture diagram (this file)
├── failure_modes.md          # Failure scenario analysis
├── audit_log.json            # Generated by demo run
└── README.md
```

---

## 🌐 Deployment

### Backend → Railway
1. Connect your GitHub repo to Railway
2. Set root directory to `/backend`
3. Add env var: `NVIDIA_API_KEY=nvapi-...`
4. Railway auto-detects Python and runs `uvicorn main:app`

### Frontend → Vercel
1. Connect your GitHub repo to Vercel
2. Set root directory to `/frontend`
3. Add env var: `VITE_API_URL=https://your-railway-url.up.railway.app`
4. Vercel auto-builds with Vite

---

## 🎯 Judging Criteria Coverage

| Criterion | Implementation |
|---|---|
| **Production Readiness (30pts)** | Error handling, retry logic, dead-letter queue, structured logging, env vars, Docker |
| **Agentic Design (10pts)** | Multi-turn tool loop, knows when NOT to act, escalation with confidence thresholds |
| **Engineering Depth (30pts)** | True concurrency, realistic mock failures, confidence calibration, schema validation |
| **Evaluation & Self-awareness (10pts)** | Per-ticket confidence score, auto-escalation below 0.6, flags raised |
| **Presentation & Deployment (20pts)** | Live React dashboard, Railway + Vercel deployment, full audit trail UI |
