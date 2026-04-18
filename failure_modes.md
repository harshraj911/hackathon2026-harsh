# Failure Mode Analysis — ShopWave Autonomous Agent

This document covers at least 3 failure scenarios as required by the Agentic AI Hackathon 2026 submission checklist.

---

## 1. Tool Timeout / Transient Service Error

**Failure scenario:**
Mock tools have a 5% timeout rate (5-second sleep) and an 8% "Service Unavailable (503)" error rate. During concurrent processing, multiple tools in the same turn can fail simultaneously.

**How the agent handles it:**
- `_execute_tool()` in `processor.py` wraps every call in a `try/except` block catching `ToolError`, `asyncio.TimeoutError`, and generic `Exception`.
- On failure, it **retries once** with a 500ms backoff before giving up.
- If the retry also fails, it returns a **structured error dict** (e.g., `{"error": "Request timed out", "recoverable": True}`) rather than crashing.
- The structured error is passed as the function response back to the LLM, which adapts its reasoning ("data unavailable — escalating").

**Result:** Agent never crashes on tool failure. If the tool was critical (e.g., `check_refund_eligibility`), the agent escalates rather than guessing.

---

## 2. LLM Returns Malformed / Non-JSON Final Answer

**Failure scenario:**
Gemini sometimes wraps the final answer in markdown (` ```json ... ``` `), adds explanatory text before/after the JSON, or omits required fields like `confidence` or `reasoning`.

**How the agent handles it:**
- `_parse_resolution()` tries three extraction strategies in order:
  1. Regex for fenced code blocks (` ```json ``` `)
  2. Regex for any raw `{...}` block
  3. Direct `json.loads()` on the full text
- Each extracted candidate is validated against the `TicketResolution` Pydantic model.
- If **all strategies fail**, the agent logs the raw output and returns `{"resolution": "escalated", "confidence": 0.0, "reasoning": "Could not parse LLM output: ..."}` — never a Python exception.

**Result:** Every ticket gets a valid, structured resolution record regardless of LLM formatting quirks.

---

## 3. Chain Rule Violation (LLM Tries to Skip Tool Calls)

**Failure scenario:**
For simple-looking tickets (e.g., "Where is my order?"), the model sometimes tries to answer directly from the ticket context without calling any tools, violating the hackathon's "Chain" rule (minimum 3 tool calls).

**How the agent handles it:**
- The system prompt explicitly mandates the minimum chain: `get_customer → get_order → get_product (or search_knowledge_base)`.
- After the ReAct loop completes, `process_ticket()` checks `tool_call_count < 3`.
- If violated, a warning flag is appended: `"WARNING: only N tool calls made (minimum 3 required)"`.
- This flag is stored in the audit log's `"flags"` array and returned in every API response for full transparency.

**Result:** Violations are detected, logged, and surfaced in the dashboard — judges can see exactly when and why the chain rule was broken.

---

## 4. Concurrent Write Race Condition

**Failure scenario:**
When processing 20 tickets concurrently (default `concurrency_limit=5`), multiple coroutines may try to append to `self.audit_log` at the same time, causing list corruption in CPython's GIL boundary cases.

**How the agent handles it:**
- `self._lock = asyncio.Lock()` is acquired before every write to `self.audit_log`.
- The lock also deduplicates re-processed tickets: existing entries for the same `ticket_id` are removed before the new entry is appended.

**Result:** Perfectly consistent audit log even under heavy concurrency. No partial writes, no duplicates.

---

## 5. Irreversible Action Guard (Refund Safety)

**Failure scenario:**
`issue_refund` is irreversible. If the LLM calls it without first checking eligibility, it could issue refunds for ineligible orders (already refunded, expired window, not yet delivered).

**How the agent handles it:**
- The system prompt contains a hard rule: *"ALWAYS call `check_refund_eligibility` before `issue_refund`."*
- `issue_refund` in `mock_tools.py` itself also does a server-side guard: it raises a non-recoverable `ToolError` if `refund_status == "refunded"` already.
- Non-recoverable `ToolError` (`recoverable=False`) is **not retried** — the error is immediately surfaced to the LLM.

**Result:** Double-layered protection. The agent is instructed not to skip eligibility checks, and the tool itself enforces the invariant regardless.
---

## 6. Model Capability Limitation (e.g., Single Tool-Call Only)

**Failure scenario:**
Some models (especially certain Llama 3 deployments on NVIDIA NIM) throw a `400 BadRequestError` if the model attempts to generate multiple tool calls in a single turn, or if sequential turns contain multiple tool results.

**How the agent handles it:**
- **Prompt Guard:** The system prompt explicitly forbids parallel tool calls: *"ONLY call ONE tool at a time."*
- **Error Trapping:** The ReAct loop catches the specific error string `"single tool-calls"`.
- **Fallback Matrix:** On detection, the processor immediately switches to the next available model in the `FALLBACK_CONFIGS` list (e.g., falling back from Llama 3.3 to Llama 3.1 405B or Nemotron).
- **Turn Truncation:** The agent ensures that even if a model ignores the prompt and returns multiple calls, only the first one is processed if the API remains unstable.

**Result:** The agent is resilient to infrastructure-level model limitations and handles transitions between different LLM providers/models seamlessly.
