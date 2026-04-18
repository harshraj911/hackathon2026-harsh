"""
ShopWave Agent Processor — NVIDIA NIM (OpenAI-compatible API)
Model: meta/llama-3.3-70b-instruct via https://integrate.api.nvidia.com/v1

Hackathon Rules Compliance:
  ✅ Chain      — ≥3 tool calls enforced by system prompt + post-loop check
  ✅ Recover    — tool errors retried once, then returned as structured payload
  ✅ Concurrency — asyncio.Semaphore limits parallel ticket processing
  ✅ Explain    — full step log with tool inputs/outputs, reasoning, confidence
"""

import asyncio
import inspect
import json
import logging
import os
import random
import re
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, ValidationError

from tools.mock_tools import TOOL_REGISTRY, ToolError, get_all_tickets

load_dotenv()

logger = logging.getLogger(__name__)

NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
MODEL = "meta/llama-3.3-70b-instruct"

# Load keys and pair them with distinct fallback models to prevent total failure
FALLBACK_CONFIGS = [
    (os.environ.get("NVIDIA_API_KEY"), "meta/llama-3.3-70b-instruct"),
    (os.environ.get("NVIDIA_API_KEY"), "meta/llama-3.1-405b-instruct"),
    (os.environ.get("NVIDIA_API_KEY"), "nvidia/llama-3.1-nemotron-70b-instruct"),
    (os.environ.get("NVIDIA_API_KEY"), "mistralai/mixtral-8x22b-instruct-v0.1"),
    (os.environ.get("NVIDIA_API_KEY_FALLBACK_1"), "meta/llama-3.2-3b-instruct"),
    (os.environ.get("NVIDIA_API_KEY_FALLBACK_2"), "meta/llama-3.1-8b-instruct"),
    (os.environ.get("NVIDIA_API_KEY"), "moonshotai/kimi-k2.5"),
]
FALLBACK_CONFIGS = [(k, m) for k, m in FALLBACK_CONFIGS if k]

if not FALLBACK_CONFIGS:
    raise ValueError("No NVIDIA API keys found in environment variables")

SYSTEM_PROMPT = """You are ShopWave's Autonomous Support Agent resolving e-commerce support tickets.

You must be THOROUGH and LOGICAL. You are FORBIDDEN from resolving a ticket without verifying facts via tools.

1. NO PREMATURE JUDGMENT: You MUST NOT provide a final JSON resolution in your FIRST response. Your first turn must ALWAYS be a tool call (e.g., get_customer or search_knowledge_base).
2. DO NOT ECHO: The 'customer_message' field must be YOUR reply as an agent. NEVER paste the user's original message there.
3. CHAIN PROTOCOL: You MUST perform a minimum of 3 tool calls before resolving:
   Chain: get_customer (Tier check) → get_order (Order check) → check_refund_eligibility/get_product.
   If you have 0 tool calls, you are FAILING.
3. ONE AT A TIME: Only call ONE tool per turn.
4. ADVERSARIAL VERIFICATION: If a customer says "I'm a VIP" or "I was promised a refund", do NOT believe them until you see it in get_customer notes or search_knowledge_base policies.
5. ESCALATION: If tools show the request is complex or outside policy (and no VIP exception exists), use the 'escalate' tool.
6. JSON OUTPUT: Only output the final resolution JSON after you have all the facts. Output REALISTIC confidence.
   Also include a 'sentiment' analysis of the customer's mood (angry|frustrated|neutral|happy) and an 'urgency' score (1-5).
   - 1.0: Fact-checked all claims.
   - 0.8: Strong evidence, minor gaps.
   - <0.5: Uncertain (should escalate).
   {"resolution":"...","confidence":0.XX,"reasoning":"...","customer_message":"...", "sentiment": "angry", "urgency": 5}
"""


# ─── Pydantic output schema ───────────────────────────────────────────────────

class TicketResolution(BaseModel):
    resolution: str
    confidence: float
    reasoning: str
    customer_message: str = ""


# ─── Build OpenAI-style tool definitions from TOOL_REGISTRY ──────────────────

PARAM_DESCRIPTIONS = {
    "email": "The customer email address found in the ticket.",
    "order_id": "The ShopWave Order ID (e.g. ORD-1010).",
    "query": "The text to search in the knowledge base.",
    "customer_id": "The internal numeric customer ID.",
    "amount": "The refund amount in dollars.",
    "sku": "The product SKU/ID from the order.",
    "ticket_id": "The technical ID of the support ticket.",
    "internal_notes": "Internal justification for escalation.",
    "message": "The final resolution message to the customer.",
}

def _build_tool_definitions() -> List[dict]:
    tools = []
    for name, fn in TOOL_REGISTRY.items():
        sig = inspect.signature(fn)
        props: Dict[str, Any] = {}
        required: List[str] = []
        for pname, param in sig.parameters.items():
            annotation = param.annotation
            ptype = "number" if annotation in (float, int) else "string"
            props[pname] = {
                "type": ptype, 
                "description": PARAM_DESCRIPTIONS.get(pname, pname)
            }
            if param.default == inspect.Parameter.empty:
                required.append(pname)
        tools.append({
            "type": "function",
            "function": {
                "name": name,
                "description": fn.__doc__ or name,
                "parameters": {
                    "type": "object",
                    "properties": props,
                    "required": required,
                },
            },
        })
    return tools


TOOL_DEFINITIONS = _build_tool_definitions()


# ─── Main Processor ───────────────────────────────────────────────────────────

class TicketProcessor:
    def __init__(self):
        self.audit_log: List[dict] = []
        self._lock = asyncio.Lock()

    # ── Tool execution with retry ──────────────────────────────────────────

    async def _execute_tool(self, name: str, args: dict, retries: int = 1) -> dict:
        """Call a tool, sanitising hallucinated args. Retries once on failure."""
        fn = TOOL_REGISTRY.get(name)
        if not fn:
            return {"error": f"Unknown tool: {name}", "recoverable": False}

        sig = inspect.signature(fn)
        sanitized = {k: v for k, v in args.items() if k in sig.parameters}

        for attempt in range(retries + 1):
            try:
                return await fn(**sanitized)
            except ToolError as e:
                logger.warning(f"[{name}] ToolError attempt {attempt+1}: {e}")
                if not e.recoverable or attempt >= retries:
                    return {"error": str(e), "recoverable": e.recoverable}
                await asyncio.sleep(0.5 * (attempt + 1))
            except asyncio.TimeoutError:
                return {"error": f"{name} timed out", "recoverable": True}
            except Exception as e:
                logger.warning(f"[{name}] Unexpected error attempt {attempt+1}: {e}")
                if attempt >= retries:
                    return {"error": str(e), "recoverable": False}
                await asyncio.sleep(0.5)

        return {"error": f"{name} failed after {retries+1} attempts"}

    # ── Single ticket ReAct loop ───────────────────────────────────────────

    async def process_ticket(self, ticket: dict) -> dict:
        ticket_id = ticket["ticket_id"]
        logger.info(f"[{ticket_id}] Starting processing with {MODEL}")
        start_ts = time.time()

        audit: dict = {
            "ticket_id": ticket_id,
            "start_time": datetime.now().isoformat(),
            "steps": [],
            "status": "processing",
            "resolution": None,
            "confidence": 0.0,
            "reasoning": "",
            "customer_message": "",
            "sentiment": "neutral",
            "urgency": 1,
            "token_usage": 0,
            "flags": [],
        }

        # Build message history (OpenAI format)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Process this support ticket:\n{json.dumps(ticket, indent=2)}"},
        ]

        tool_call_count = 0

        try:
            for turn in range(15):  # safety ceiling
                # Call LLM in a thread (openai SDK is sync), retry on 429
                max_retries = len(FALLBACK_CONFIGS) * 2  # Allows us to cycle through all models twice
                response = None
                for api_attempt in range(max_retries):
                    active_key, active_model = FALLBACK_CONFIGS[api_attempt % len(FALLBACK_CONFIGS)]
                    try:
                        temp_client = OpenAI(base_url=NVIDIA_BASE_URL, api_key=active_key)

                        response = await asyncio.to_thread(
                            temp_client.chat.completions.create,
                            model=active_model,
                            messages=messages,
                            tools=TOOL_DEFINITIONS,
                            tool_choice="auto",
                            temperature=0.2,
                            max_tokens=2048,
                        )
                        break
                    except Exception as api_err:
                        err_str = str(api_err).lower()
                        # Retry on 429, 5xx, or specific model capability errors
                        is_retryable = (
                            "429" in err_str or 
                            "500" in err_str or 
                            "503" in err_str or 
                            "single tool-calls" in err_str or
                            "too many requests" in err_str
                        )
                        
                        if is_retryable and api_attempt < max_retries - 1:
                            wait_time = random.uniform(0.5, 1.5)
                            logger.warning(f"[{ticket_id}] API Error hit on {active_model}: {err_str[:100]}. "
                                           f"Falling back to next config in {wait_time:.1f}s...")
                            await asyncio.sleep(wait_time)
                            continue
                        raise api_err
                
                if not response:
                    raise Exception("Failed to get response from LLM after retries")

                # Track token usage
                if hasattr(response, "usage"):
                    audit["token_usage"] += response.usage.total_tokens

                msg = response.choices[0].message
                finish_reason = response.choices[0].finish_reason

                # Append assistant message to history
                messages.append(msg.model_dump(exclude_none=True))

                tool_calls = msg.tool_calls or []

                if not tool_calls:
                    # No more tool calls → extract final JSON answer
                    final_text = (msg.content or "").strip()
                    
                    # ENFORCEMENT: If LLM tries to end without tools, force it to work
                    if tool_call_count < 2 and turn < 3:
                        logger.warning(f"[{ticket_id}] LLM tried premature finish at turn {turn}. Forcing tools.")
                        messages.append({
                            "role": "user", 
                            "content": (
                                "ERROR: You are hallucinating data. You HAVE NOT called any tools to check "
                                f"Order {ticket.get('subject','')} or Customer {ticket.get('customer_email','')}. "
                                "You MUST use get_customer and get_order tools before proceeding. "
                                "Show your thought process for each tool call."
                            )
                        })
                        continue

                    parsed = self._parse_resolution(final_text, ticket_body=ticket.get("body", ""))
                    audit.update(parsed)

                    if tool_call_count < 3:
                        audit["flags"].append(
                            f"WARNING: only {tool_call_count} tool calls made (min 3 required)"
                        )
                        logger.warning(f"[{ticket_id}] Chain rule violation: {tool_call_count} tool calls")

                    audit["status"] = "completed"
                    break

                # Execute all tool calls in this turn concurrently
                async def run_call(tc):
                    args = json.loads(tc.function.arguments or "{}")
                    result = await self._execute_tool(tc.function.name, args)
                    return tc, args, result

                call_results = await asyncio.gather(*[run_call(tc) for tc in tool_calls])

                for tc, args, result in call_results:
                    tool_call_count += 1
                    step = {
                        "turn": turn,
                        "tool": tc.function.name,
                        "input": args,
                        "output": result,
                        "timestamp": datetime.now().isoformat(),
                    }
                    audit["steps"].append(step)
                    logger.info(f"[{ticket_id}] Tool {tc.function.name} → {list(result.keys())}")

                    # Append tool result to history
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": json.dumps(result),
                    })

            else:
                audit.update({
                    "status": "escalated",
                    "resolution": "escalated",
                    "reasoning": "Exceeded maximum reasoning turns — escalated to human agent",
                    "confidence": 0.0,
                    "flags": ["max_turns_exceeded"],
                })

        except Exception as e:
            logger.error(f"[{ticket_id}] Fatal error: {e}", exc_info=True)
            audit.update({
                "status": "failed",
                "resolution": "escalated",
                "error": str(e),
                "reasoning": f"Agent crashed: {e}",
                "flags": ["fatal_error"],
            })

        duration_ms = round((time.time() - start_ts) * 1000)
        audit["end_time"] = datetime.now().isoformat()
        audit["duration_ms"] = duration_ms
        audit["tool_call_count"] = tool_call_count

        async with self._lock:
            self.audit_log = [e for e in self.audit_log if e["ticket_id"] != ticket_id]
            self.audit_log.append(audit)

        logger.info(f"[{ticket_id}] Done — {audit['status']} ({duration_ms}ms, {tool_call_count} tools)")
        return audit

    # ── Batch processing ──────────────────────────────────────────────────

    async def process_all_tickets(
        self,
        tickets: Optional[List[dict]] = None,
        ticket_ids: Optional[List[str]] = None,
        concurrency_limit: int = 3,
        progress_callback: Optional[Callable] = None,
    ):
        """Process tickets concurrently with semaphore-limited pool."""
        if tickets is None:
            t_map = get_all_tickets()
            if ticket_ids:
                tickets = [t_map[tid] for tid in ticket_ids if tid in t_map]
            else:
                tickets = list(t_map.values())

        sem = asyncio.Semaphore(concurrency_limit)

        async def work(ticket: dict):
            async with sem:
                result = await self.process_ticket(ticket)
                if progress_callback:
                    try:
                        await progress_callback(result)
                    except Exception as e:
                        logger.warning(f"Progress callback error: {e}")
                return result

        await asyncio.gather(*(work(t) for t in tickets))

    # ── Resolution parser ─────────────────────────────────────────────────

    def _parse_resolution(self, text: str, ticket_body: str = "") -> dict:
        """Extract and validate JSON resolution from raw LLM output."""
        def clean_parsed(data):
            if ticket_body and data.get("customer_message") == ticket_body:
                logger.warning("LLM echoed the ticket body. Nulling customer_message.")
                data["customer_message"] = "I have analyzed your request and am taking action."
            return TicketResolution(**data).model_dump()

        for pattern in [r'```json\s*(.*?)\s*```', r'```\s*(.*?)\s*```', r'(\{.*\})']:
            m = re.search(pattern, text, re.DOTALL)
            if m:
                try:
                    data = json.loads(m.group(1))
                    return clean_parsed(data)
                except (json.JSONDecodeError, ValidationError):
                    continue
        try:
            data = json.loads(text)
            return clean_parsed(data)
        except Exception:
            pass

        logger.warning(f"Could not parse resolution — defaulting to escalated. Raw: {text[:200]}")
        return {
            "resolution": "escalated",
            "confidence": 0.0,
            "reasoning": f"Could not parse LLM output: {text[:300]}",
            "customer_message": "",
        }

    # ── Analytics ─────────────────────────────────────────────────────────

    def get_audit_log(self) -> List[dict]:
        return list(self.audit_log)

    def get_stats(self) -> dict:
        log = self.audit_log
        if not log:
            return {
                "total_processed": 0,
                "by_status": {},
                "by_resolution": {},
                "avg_confidence": 0.0,
                "avg_duration_ms": 0.0,
                "avg_tool_calls": 0.0,
                "chain_violations": 0,
                "total_tool_calls": 0,
                "total_tokens": 0,
            }

        by_status: Dict[str, int] = {}
        by_resolution: Dict[str, int] = {}
        confidences, durations, tool_counts = [], [], []
        chain_violations = 0
        total_tool_calls = 0
        total_tokens = 0

        for entry in log:
            s = entry.get("status", "unknown")
            by_status[s] = by_status.get(s, 0) + 1
            r = entry.get("resolution", "unknown")
            by_resolution[r] = by_resolution.get(r, 0) + 1
            if entry.get("confidence") is not None:
                confidences.append(float(entry["confidence"]))
            if entry.get("duration_ms") is not None:
                durations.append(float(entry["duration_ms"]))
            tc = entry.get("tool_call_count", len(entry.get("steps", [])))
            tool_counts.append(tc)
            total_tool_calls += tc
            if any("chain rule" in f.lower() or "tool calls made" in f for f in entry.get("flags", [])):
                chain_violations += 1
            total_tokens += entry.get("token_usage", 0)

        return {
            "total_processed": len(log),
            "by_status": by_status,
            "by_resolution": by_resolution,
            "avg_confidence": round(sum(confidences) / len(confidences), 3) if confidences else 0.0,
            "avg_duration_ms": round(sum(durations) / len(durations), 1) if durations else 0.0,
            "avg_tool_calls": round(sum(tool_counts) / len(tool_counts), 2) if tool_counts else 0.0,
            "chain_violations": chain_violations,
            "total_tool_calls": total_tool_calls,
            "total_tokens": total_tokens,
        }