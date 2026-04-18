"""
ShopWave Agent — FastAPI Backend
Exposes REST endpoints for the React frontend dashboard.
"""

import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent.processor import TicketProcessor
from tools.mock_tools import (
    get_all_tickets, get_all_orders, get_all_customers, get_all_products
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# Global processor instance
processor = TicketProcessor()
_run_task: Optional[asyncio.Task] = None
_progress_events: list[dict] = []
_run_status = {"running": False, "started_at": None, "completed_at": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ShopWave Agent API starting up")
    yield
    logger.info("ShopWave Agent API shutting down")


app = FastAPI(
    title="ShopWave Autonomous Support Agent",
    description="AI-powered customer support resolution agent",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── MODELS ───

class RunRequest(BaseModel):
    ticket_ids: Optional[list[str]] = None
    concurrency: int = 10

class SingleTicketRequest(BaseModel):
    ticket_id: str

class DataUpdateRequest(BaseModel):
    filename: str  # tickets.json, orders.json, customers.json, products.json
    content: list[dict]


# ─── HEALTH ───

@app.get("/health")
async def health():
    tickets = get_all_tickets()
    orders = get_all_orders()
    customers = get_all_customers()
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "tickets_loaded": len(tickets),
        "orders_loaded": len(orders),
        "customers_loaded": len(customers),
    }


# ─── TICKETS ───

@app.get("/tickets")
async def list_tickets():
    """List all available tickets with their processing status."""
    audit_map = {e["ticket_id"]: e for e in processor.audit_log}
    tickets_data = get_all_tickets()

    tickets = []
    for tid, ticket in tickets_data.items():
        audit = audit_map.get(tid)
        tickets.append({
            "ticket_id": ticket["ticket_id"],
            "customer_email": ticket["customer_email"],
            "subject": ticket["subject"],
            "source": ticket["source"],
            "tier": ticket["tier"],
            "created_at": ticket["created_at"],
            "status": audit["status"] if audit else "pending",
            "resolution": audit.get("resolution") if audit else None,
            "confidence": audit.get("confidence") if audit else None,
            "duration_ms": audit.get("duration_ms") if audit else None,
            "flags": audit.get("flags", []) if audit else [],
        })

    return {"tickets": tickets, "total": len(tickets)}


@app.get("/tickets/{ticket_id}")
async def get_ticket_detail(ticket_id: str):
    """Get full audit trail for a specific ticket."""
    tickets_data = get_all_tickets()
    ticket = tickets_data.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")

    audit = next((e for e in processor.audit_log if e["ticket_id"] == ticket_id), None)

    return {
        "ticket": ticket,
        "audit": audit,
        "processed": audit is not None,
    }


# ─── AGENT RUNS ───

@app.post("/run")
async def run_agent(req: RunRequest):
    """Start processing tickets. Runs concurrently in background."""
    global _run_task, _run_status

    if _run_status["running"]:
        raise HTTPException(status_code=409, detail="Agent is already running")

    tickets_data = get_all_tickets()
    ticket_list = list(tickets_data.values())
    if req.ticket_ids:
        ticket_list = [t for t in ticket_list if t["ticket_id"] in req.ticket_ids]

    _run_status = {"running": True, "started_at": datetime.now().isoformat(), "completed_at": None}
    _progress_events.clear()

    async def progress_callback(result: dict):
        _progress_events.append({
            "ticket_id": result["ticket_id"],
            "status": result["status"],
            "resolution": result.get("resolution"),
            "confidence": result.get("confidence"),
            "timestamp": datetime.now().isoformat(),
        })

    async def run():
        global _run_status
        try:
            await processor.process_all_tickets(
                tickets=ticket_list,
                concurrency_limit=req.concurrency,
                progress_callback=progress_callback,
            )
        except asyncio.CancelledError:
            logger.info("Agent run was forcefully stopped by the user.")
        finally:
            _run_status["running"] = False
            _run_status["completed_at"] = datetime.now().isoformat()

    _run_task = asyncio.create_task(run())

    return {
        "message": f"Agent started processing {len(ticket_list)} tickets",
        "concurrency": req.concurrency,
        "ticket_count": len(ticket_list),
    }


@app.post("/run/stop")
async def stop_run():
    """Force stop the currently running agent."""
    global _run_task, _run_status
    if _run_task and not _run_task.done():
        _run_task.cancel()
        _run_status["running"] = False
        _run_status["completed_at"] = datetime.now().isoformat()
        return {"message": "Run stopped successfully"}
    return {"message": "No active run to stop"}

@app.post("/run/single")
async def run_single_ticket(req: SingleTicketRequest):
    """Process a single ticket synchronously and return the full result."""
    tickets_data = get_all_tickets()
    ticket = tickets_data.get(req.ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket {req.ticket_id} not found")

    result = await processor.process_ticket(ticket)
    return result


@app.get("/run/status")
async def get_run_status():
    """Get current run status and progress."""
    audit_log = processor.audit_log
    processed = len(audit_log)
    total = len(get_all_tickets())

    return {
        **_run_status,
        "processed": processed,
        "total": total,
        "progress_pct": round((processed / total) * 100, 1) if total else 0,
        "recent_events": _progress_events[-10:],
    }


@app.get("/run/export")
async def export_audit_log():
    """Save the full audit log to a JSON file in the project root."""
    log_path = os.path.join(os.getcwd(), "audit_log.json")
    with open(log_path, "w") as f:
        json.dump(processor.audit_log, f, indent=2)
    
    return {"success": True, "path": log_path, "count": len(processor.audit_log)}


@app.get("/run/stream")
async def stream_progress():
    """Server-Sent Events stream for real-time progress updates."""
    async def event_generator():
        last_idx = 0
        while True:
            if len(_progress_events) > last_idx:
                for event in _progress_events[last_idx:]:
                    yield f"data: {json.dumps(event)}\n\n"
                last_idx = len(_progress_events)

            if not _run_status["running"] and last_idx > 0:
                yield f"data: {json.dumps({'type': 'complete', 'stats': processor.get_stats()})}\n\n"
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── AUDIT & STATS ───

@app.get("/audit")
async def get_audit_log(
    status: Optional[str] = Query(None),
    resolution: Optional[str] = Query(None),
    min_confidence: Optional[float] = Query(None),
):
    """Get full audit log with optional filters."""
    log = processor.get_audit_log()

    if status:
        log = [e for e in log if e.get("status") == status]
    if resolution:
        log = [e for e in log if e.get("resolution") == resolution]
    if min_confidence is not None:
        log = [e for e in log if (e.get("confidence") or 0) >= min_confidence]

    return {"audit_log": log, "total": len(log)}


@app.get("/stats")
async def get_stats():
    """Get aggregate statistics across all processed tickets."""
    return processor.get_stats()


@app.delete("/audit")
async def reset_audit():
    """Reset audit log and processor state (for re-runs)."""
    processor.audit_log.clear()
    _progress_events.clear()
    _run_status.update({"running": False, "started_at": None, "completed_at": None})
    return {"message": "Audit log cleared"}


# ─── DATA MANAGEMENT ───

@app.get("/data/files/{filename}")
async def get_data_file(filename: str):
    """Retrieve raw content of a data file."""
    valid_files = ["tickets.json", "orders.json", "customers.json", "products.json"]
    if filename not in valid_files:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    file_path = os.path.join(os.getcwd(), "data", filename)
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {e}")

@app.post("/data/files")
async def update_data_file(req: DataUpdateRequest):
    """Overwrite a data file with new content."""
    valid_files = ["tickets.json", "orders.json", "customers.json", "products.json"]
    if req.filename not in valid_files:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    file_path = os.path.join(os.getcwd(), "data", req.filename)
    try:
        with open(file_path, "w") as f:
            json.dump(req.content, f, indent=2)
        return {"success": True, "message": f"Updated {req.filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error writing file: {e}")


# ─── DATA ENDPOINTS ───

@app.get("/data/orders/{order_id}")
async def get_order_data(order_id: str):
    orders = get_all_orders()
    order = orders.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@app.get("/data/customers/{email}")
async def get_customer_data(email: str):
    customers = get_all_customers()
    customer = customers.get(email)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
