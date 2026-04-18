"""
ShopWave Mock Tools — realistic implementations with timeouts, failures, and malformed data.
Each tool has a chance to fail, timeout, or return partial data to test agent resilience.
"""

import json
import asyncio
import random
import re
from datetime import datetime
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent.parent / "data"

# Shared Data Accessors
def load_data(filename: str):
    try:
        with open(DATA_DIR / filename) as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filename}: {e}")
        return []

def get_all_tickets():
    return {t["ticket_id"]: t for t in load_data("tickets.json")}

def get_all_orders():
    return {o["order_id"]: o for o in load_data("orders.json")}

def get_all_customers():
    return {c["email"]: c for c in load_data("customers.json")}

def get_all_products():
    return {p["product_id"]: p for p in load_data("products.json")}

def get_kb_content():
    try:
        with open(DATA_DIR / "knowledge-base.md") as f:
            return f.read()
    except:
        return ""

# These are now helper functions to maintain compatibility
def TICKETS(): return get_all_tickets()
def ORDERS(): return get_all_orders()
def CUSTOMERS(): return get_all_customers()
def PRODUCTS(): return get_all_products()

TOOL_FAILURE_RATE = 0.08   # 8% random tool failures for realism
TOOL_TIMEOUT_RATE = 0.05   # 5% timeout simulation


class ToolError(Exception):
    def __init__(self, tool: str, reason: str, recoverable: bool = True):
        self.tool = tool
        self.reason = reason
        self.recoverable = recoverable
        super().__init__(f"[{tool}] {reason}")


async def _simulate_latency(base_ms: int = 150):
    """Simulate realistic network latency."""
    jitter = random.uniform(0.5, 1.8)
    await asyncio.sleep((base_ms * jitter) / 1000)


async def _maybe_fail(tool_name: str):
    """Randomly inject failures and timeouts."""
    r = random.random()
    if r < TOOL_TIMEOUT_RATE:
        await asyncio.sleep(5)  # simulate timeout
        raise ToolError(tool_name, "Request timed out after 5s", recoverable=True)
    if r < TOOL_FAILURE_RATE + TOOL_TIMEOUT_RATE:
        raise ToolError(tool_name, "Service temporarily unavailable (503)", recoverable=True)


# ─────────────────────────── READ TOOLS ───────────────────────────

async def get_order(order_id: str) -> dict:
    """Fetch order details, status, and timestamps."""
    await _simulate_latency(120)
    await _maybe_fail("get_order")

    order = get_all_orders().get(order_id)
    if not order:
        return {"error": f"Order {order_id} not found", "order_id": order_id, "found": False}

    return {
        "found": True,
        "order_id": order["order_id"],
        "customer_id": order["customer_id"],
        "product_id": order["product_id"],
        "quantity": order["quantity"],
        "amount": order["amount"],
        "status": order["status"],
        "order_date": order["order_date"],
        "delivery_date": order["delivery_date"],
        "return_deadline": order["return_deadline"],
        "refund_status": order["refund_status"],
        "notes": order["notes"],
    }


async def get_customer(email: str) -> dict:
    """
    Fetch customer profile, tier (standard/premium/vip), and history.
    IMPORTANT: Always check 'notes' for special pre-approvals or VIP exceptions.
    """
    await _simulate_latency(100)
    await _maybe_fail("get_customer")

    customer = get_all_customers().get(email)
    if not customer:
        return {"error": f"No customer found for email: {email}", "email": email, "found": False}

    return {
        "found": True,
        "customer_id": customer["customer_id"],
        "name": customer["name"],
        "email": customer["email"],
        "tier": customer["tier"],
        "member_since": customer["member_since"],
        "total_orders": customer["total_orders"],
        "total_spent": customer["total_spent"],
        "notes": customer["notes"],
    }


async def get_product(product_id: str) -> dict:
    """Fetch product metadata, category, and warranty info."""
    await _simulate_latency(80)
    await _maybe_fail("get_product")

    product = get_all_products().get(product_id)
    if not product:
        return {"error": f"Product {product_id} not found", "product_id": product_id, "found": False}

    return {
        "found": True,
        "product_id": product["product_id"],
        "name": product["name"],
        "category": product["category"],
        "price": product["price"],
        "warranty_months": product["warranty_months"],
        "return_window_days": product["return_window_days"],
        "returnable": product["returnable"],
        "notes": product["notes"],
    }


async def search_knowledge_base(query: str) -> dict:
    """
    Semantic search over policy & FAQ knowledge base.
    Use this for ANY questions about return windows, warranty duration, or general ShopWave rules.
    """
    await _simulate_latency(200)
    await _maybe_fail("search_knowledge_base")

    query_lower = query.lower()
    sections = get_kb_content().split("\n## ")
    relevant = []

    keywords = query_lower.split()
    for section in sections:
        score = sum(1 for kw in keywords if kw in section.lower())
        if score > 0:
            relevant.append((score, section[:800]))

    relevant.sort(key=lambda x: -x[0])
    top = relevant[:3]

    return {
        "query": query,
        "results": [{"relevance_score": s, "excerpt": e} for s, e in top],
        "source": "knowledge-base.md",
    }


async def get_orders_by_email(email: str) -> dict:
    """Find all orders for a customer by email (useful when no order ID given)."""
    await _simulate_latency(150)
    await _maybe_fail("get_orders_by_email")

    customer = get_all_customers().get(email)
    if not customer:
        return {"found": False, "email": email, "orders": []}

    customer_id = customer["customer_id"]
    customer_orders = [o for o in get_all_orders().values() if o["customer_id"] == customer_id]

    return {
        "found": True,
        "email": email,
        "customer_id": customer_id,
        "orders": customer_orders,
    }


# ─────────────────────────── WRITE TOOLS ───────────────────────────

async def check_refund_eligibility(order_id: str) -> dict:
    """Check if order is eligible for refund. May return errors — handle gracefully."""
    await _simulate_latency(300)
    await _maybe_fail("check_refund_eligibility")

    order = get_all_orders().get(order_id)
    if not order:
        return {
            "eligible": False,
            "order_id": order_id,
            "reason": "Order not found in system",
            "confidence": 1.0,
        }

    today = datetime.now().date()

    # Already refunded
    if order["refund_status"] == "refunded":
        return {
            "eligible": False,
            "order_id": order_id,
            "reason": "Refund already processed for this order",
            "refund_date": order.get("notes", ""),
            "confidence": 1.0,
        }

    # Not yet delivered
    if order["status"] in ("processing", "shipped"):
        return {
            "eligible": False,
            "order_id": order_id,
            "reason": f"Order is in '{order['status']}' status — cannot refund before delivery",
            "confidence": 0.95,
        }

    # Check return deadline
    if order["return_deadline"]:
        deadline = datetime.strptime(order["return_deadline"], "%Y-%m-%d").date()
        if today > deadline:
            return {
                "eligible": False,
                "order_id": order_id,
                "reason": f"Return window expired on {order['return_deadline']}",
                "deadline": order["return_deadline"],
                "confidence": 0.95,
            }

    return {
        "eligible": True,
        "order_id": order_id,
        "amount": order["amount"],
        "reason": "Order is within return window and eligible for refund",
        "confidence": 0.98,
    }


async def issue_refund(order_id: str, amount: float) -> dict:
    """
    IRREVERSIBLE — issue a refund. Must check eligibility first.
    Updates in-memory state (in production this would hit payment gateway).
    """
    await _simulate_latency(500)
    await _maybe_fail("issue_refund")

    ORDERS_MAP = get_all_orders()
    order = ORDERS_MAP.get(order_id)
    if not order:
        raise ToolError("issue_refund", f"Cannot refund unknown order: {order_id}", recoverable=False)

    if order.get("refund_status") == "refunded":
        raise ToolError("issue_refund", "Refund already issued for this order", recoverable=False)

    # Note: In a real system we would write this back to the JSON file
    # For the hackathon, we update the in-memory cache if we want to preserve state
    # or you can write a 'save_order' helper.
    # We will update the global mock state briefly
    order["refund_status"] = "refunded"
    order["notes"] += f" | REFUND ISSUED: ${amount} on {datetime.now().isoformat()}"

    return {
        "success": True,
        "order_id": order_id,
        "amount_refunded": amount,
        "refund_id": f"REF-{order_id}-{int(datetime.now().timestamp())}",
        "message": f"Refund of ${amount} initiated. Will appear in account within 5–7 business days.",
        "timestamp": datetime.now().isoformat(),
    }


async def send_reply(ticket_id: str, message: str) -> dict:
    """Send a response to the customer."""
    await _simulate_latency(200)
    await _maybe_fail("send_reply")

    if ticket_id not in get_all_tickets():
        return {"success": False, "reason": f"Ticket {ticket_id} not found"}

    return {
        "success": True,
        "ticket_id": ticket_id,
        "message_sent": message,
        "timestamp": datetime.now().isoformat(),
        "channel": get_all_tickets().get(ticket_id, {}).get("source", "email"),
    }


async def escalate(ticket_id: str, summary: str, priority: str) -> dict:
    """Escalate ticket to human agent with full context."""
    await _simulate_latency(150)
    await _maybe_fail("escalate")

    valid_priorities = {"low", "medium", "high", "urgent"}
    if priority not in valid_priorities:
        priority = "medium"

    return {
        "success": True,
        "ticket_id": ticket_id,
        "escalated_to": "human_agent_queue",
        "priority": priority,
        "summary": summary,
        "escalation_id": f"ESC-{ticket_id}-{int(datetime.now().timestamp())}",
        "estimated_response": {
            "urgent": "< 1 hour",
            "high": "< 4 hours",
            "medium": "< 24 hours",
            "low": "< 48 hours",
        }[priority],
        "timestamp": datetime.now().isoformat(),
    }


# ─────────────────────────── TOOL REGISTRY ───────────────────────────

TOOL_REGISTRY = {
    "get_order": get_order,
    "get_customer": get_customer,
    "get_product": get_product,
    "search_knowledge_base": search_knowledge_base,
    "get_orders_by_email": get_orders_by_email,
    "check_refund_eligibility": check_refund_eligibility,
    "issue_refund": issue_refund,
    "send_reply": send_reply,
    "escalate": escalate,
}

TOOL_DEFINITIONS = [
    {
        "name": "get_order",
        "description": "Fetch order details, status, timestamps, and refund state by order ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string", "description": "The order ID, e.g. ORD-1001"}
            },
            "required": ["order_id"]
        }
    },
    {
        "name": "get_customer",
        "description": "Fetch customer profile including tier (standard/premium/vip), history, and special notes.",
        "input_schema": {
            "type": "object",
            "properties": {
                "email": {"type": "string", "description": "Customer email address"}
            },
            "required": ["email"]
        }
    },
    {
        "name": "get_product",
        "description": "Fetch product metadata: category, price, warranty months, return window, and policy notes.",
        "input_schema": {
            "type": "object",
            "properties": {
                "product_id": {"type": "string", "description": "Product ID, e.g. P001"}
            },
            "required": ["product_id"]
        }
    },
    {
        "name": "search_knowledge_base",
        "description": "Search the ShopWave policy and FAQ knowledge base. Use for policy questions, return rules, warranty terms, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Natural language policy question"}
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_orders_by_email",
        "description": "Look up all orders for a customer by their email. Use when customer hasn't provided an order ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "email": {"type": "string", "description": "Customer email address"}
            },
            "required": ["email"]
        }
    },
    {
        "name": "check_refund_eligibility",
        "description": "Check if an order is eligible for a refund. Returns eligibility status and reason. May throw errors — handle gracefully.",
        "input_schema": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string", "description": "The order ID to check"}
            },
            "required": ["order_id"]
        }
    },
    {
        "name": "issue_refund",
        "description": "IRREVERSIBLE — issue a refund to the customer. You MUST call check_refund_eligibility first and confirm eligibility before calling this.",
        "input_schema": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string", "description": "The order ID"},
                "amount": {"type": "number", "description": "Amount to refund in USD"}
            },
            "required": ["order_id", "amount"]
        }
    },
    {
        "name": "send_reply",
        "description": "Send a response message to the customer for a given ticket.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticket_id": {"type": "string", "description": "The ticket ID"},
                "message": {"type": "string", "description": "The message to send to the customer"}
            },
            "required": ["ticket_id", "message"]
        }
    },
    {
        "name": "escalate",
        "description": "Escalate ticket to a human agent with a structured summary and priority level.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ticket_id": {"type": "string", "description": "The ticket ID"},
                "summary": {"type": "string", "description": "Concise summary: issue, what was checked, recommended action"},
                "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"], "description": "Priority level"}
            },
            "required": ["ticket_id", "summary", "priority"]
        }
    },
]
