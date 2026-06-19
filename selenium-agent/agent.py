#!/usr/bin/env python3
"""
Selenium AI agent — an autonomous browser-driving loop.

The agent pursues a natural-language GOAL by repeating a perception → decision → action
cycle, the core pattern behind agentic browser automation:

    1. PERCEIVE  — snapshot the page's visible, interactive elements (a compact
                   "accessibility tree"), each tagged with a stable id.
    2. DECIDE    — ask Claude for the single next action as JSON, given the goal,
                   current URL, the observation, and a short history (a ReAct loop).
    3. ACT       — execute that action with Selenium (click / type / select / navigate).
    4. REPEAT    — until the model emits `finish`, or a step/guard limit is hit.

Safety: actions are confined to the starting origin, secrets are never echoed, and the
loop is bounded by --max-steps. Runs headless by default.

Without ANTHROPIC_API_KEY the agent falls back to a transparent heuristic policy so the
loop mechanics still run end-to-end (great for demos and offline development).

Usage:
    python agent.py "Log in and request a prescription refill"
    python agent.py --url http://127.0.0.1:4300 --max-steps 12 --headed "Book a cardiology appointment"
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
from dataclasses import dataclass, field
from urllib.parse import urlparse

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select

# --- Config -----------------------------------------------------------------------------

DEFAULT_URL = os.environ.get("BASE_URL", "http://127.0.0.1:4300")
MODEL = os.environ.get("AI_MODEL", "claude-opus-4-8")
API_URL = "https://api.anthropic.com/v1/messages"

# Demo credentials for the bundled mock patient portal (synthetic, no real PHI).
DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "patient@example.com")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "Test1234!")

# JS that tags every visible, interactive element with a stable data-ai-id and returns a
# compact description list. Re-run each step because the DOM changes between actions.
ANNOTATE_JS = r"""
const sel = 'a, button, input, select, textarea, [role=button], [onclick]';
const out = [];
let i = 0;
document.querySelectorAll(sel).forEach(el => {
  const r = el.getBoundingClientRect();
  const visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
                  && getComputedStyle(el).display !== 'none';
  if (!visible) return;
  el.setAttribute('data-ai-id', String(i));
  const label = (el.getAttribute('aria-label') || el.getAttribute('placeholder') ||
                 el.getAttribute('name') || el.innerText || el.value || '').trim().slice(0, 80);
  out.push({
    id: i,
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute('type') || '',
    testid: el.getAttribute('data-testid') || '',
    label: label,
    disabled: el.disabled === true,
  });
  i++;
});
return out;
"""


# --- Data types -------------------------------------------------------------------------

@dataclass
class Step:
    action: str
    target: int | None
    value: str | None
    reason: str


@dataclass
class AgentState:
    goal: str
    base_origin: str
    history: list[str] = field(default_factory=list)


# --- LLM decision -----------------------------------------------------------------------

def ai_enabled() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


SYSTEM_PROMPT = (
    "You are a careful web automation agent. Each turn you receive a GOAL, the current URL, "
    "a numbered list of interactive elements, and recent history. Respond with ONLY a JSON "
    "object for the single next action:\n"
    '{"action": "click|type|select|navigate|finish", "target": <element id or null>, '
    '"value": <text for type/select/navigate, else null>, "reason": "<one short sentence>"}\n'
    "Rules: prefer elements by their intent; to submit a form, type into the last field then "
    "click the submit button; emit finish only when the goal is clearly achieved."
)


def decide_with_ai(state: AgentState, url: str, elements: list[dict]) -> Step:
    obs = "\n".join(
        f'  [{e["id"]}] <{e["tag"]}{(" type="+e["type"]) if e["type"] else ""}>'
        f'{" testid="+e["testid"] if e["testid"] else ""}'
        f'{" (disabled)" if e["disabled"] else ""} "{e["label"]}"'
        for e in elements
    )
    history = "\n".join(f"  - {h}" for h in state.history[-6:]) or "  (none yet)"
    prompt = (
        f"GOAL: {state.goal}\n\nCURRENT URL: {url}\n\n"
        f"INTERACTIVE ELEMENTS:\n{obs}\n\nRECENT HISTORY:\n{history}\n\n"
        f"Demo credentials if a login is required: email={DEMO_EMAIL}, password={DEMO_PASSWORD}\n"
        "Return only the JSON action."
    )
    body = json.dumps({
        "model": MODEL,
        "max_tokens": 400,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(
        API_URL, data=body,
        headers={
            "content-type": "application/json",
            "x-api-key": os.environ["ANTHROPIC_API_KEY"],
            "anthropic-version": "2023-06-01",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
    text = next((b["text"] for b in data.get("content", []) if b.get("type") == "text"), "")
    raw = text[text.find("{"): text.rfind("}") + 1]
    obj = json.loads(raw)
    return Step(obj.get("action", "finish"), obj.get("target"), obj.get("value"), obj.get("reason", ""))


def decide_with_heuristic(state: AgentState, url: str, elements: list[dict]) -> Step:
    """Transparent rule-based fallback so the loop runs without an API key.

    It demonstrates the perception/action mechanics on the bundled portal: log in, then
    follow obvious goal keywords (refill / appointment / claim / billing)."""
    by_testid = {e["testid"]: e for e in elements if e["testid"]}
    goal = state.goal.lower()

    if "/login" in url:
        if "login.email-filled" not in state.history and "login-email" in by_testid:
            return Step("type", by_testid["login-email"]["id"], DEMO_EMAIL, "fill email")
        if "login.password-filled" not in state.history and "login-password" in by_testid:
            return Step("type", by_testid["login-password"]["id"], DEMO_PASSWORD, "fill password")
        if "login-submit" in by_testid:
            return Step("click", by_testid["login-submit"]["id"], None, "submit login")

    if "refill" in goal and "/prescriptions" not in url:
        return Step("navigate", None, "/prescriptions", "go to prescriptions")
    if "refill" in goal:
        btn = next((e for e in elements if e["testid"] == "rx-refill" and not e["disabled"]), None)
        if btn and "rx.refilled" not in state.history:
            return Step("click", btn["id"], None, "request first available refill")
        return Step("finish", None, None, "refill requested")

    if ("appointment" in goal or "book" in goal) and "/appointments" not in url:
        return Step("navigate", None, "/appointments", "go to appointments")
    if "claim" in goal or "billing" in goal:
        if "/billing" not in url:
            return Step("navigate", None, "/billing", "go to billing")

    return Step("finish", None, None, "reached target page (heuristic)")


# --- Action execution -------------------------------------------------------------------

def execute(driver: webdriver.Chrome, state: AgentState, step: Step) -> bool:
    """Run one action. Returns True when the agent is finished."""
    if step.action == "finish":
        return True

    if step.action == "navigate":
        dest = step.value or "/"
        if dest.startswith("/"):
            dest = f"{state.base_origin}{dest}"
        if urlparse(dest).netloc != urlparse(state.base_origin).netloc:
            raise RuntimeError(f"Refusing to navigate off-origin: {dest}")
        driver.get(dest)
        state.history.append(f"navigated to {dest}")
        return False

    if step.target is None:
        state.history.append(f"skipped {step.action}: no target")
        return False

    el = driver.find_element(By.CSS_SELECTOR, f'[data-ai-id="{step.target}"]')
    testid = el.get_attribute("data-testid") or ""

    if step.action == "type":
        el.clear()
        el.send_keys(step.value or "")
        # Track per-field progress for the heuristic policy (value itself is never logged).
        tag = "login.email-filled" if testid == "login-email" else (
            "login.password-filled" if testid == "login-password" else f"typed:{testid or step.target}")
        state.history.append(tag)
    elif step.action == "select":
        Select(el).select_by_visible_text(step.value or "")
        state.history.append(f"selected '{step.value}' in {testid or step.target}")
    elif step.action == "click":
        el.click()
        state.history.append("rx.refilled" if testid == "rx-refill" else f"clicked {testid or step.target}")
    else:
        state.history.append(f"unknown action {step.action}")
    time.sleep(0.4)  # let client-side JS settle before the next observation
    return False


# --- Loop -------------------------------------------------------------------------------

def run(goal: str, url: str, max_steps: int, headed: bool) -> int:
    opts = Options()
    if not headed:
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1280,900")
    opts.add_argument("--no-sandbox")
    driver = webdriver.Chrome(options=opts)
    state = AgentState(goal=goal, base_origin=f"{urlparse(url).scheme}://{urlparse(url).netloc}")

    mode = "Claude" if ai_enabled() else "heuristic (no API key)"
    print(f"🤖 Selenium AI agent — mode: {mode}")
    print(f"🎯 Goal: {goal}\n")

    try:
        driver.get(url)
        for n in range(1, max_steps + 1):
            elements = driver.execute_script(ANNOTATE_JS)
            current = driver.current_url
            decide = decide_with_ai if ai_enabled() else decide_with_heuristic
            step = decide(state, current, elements)
            print(f"[step {n}] {step.action} target={step.target} "
                  f"value={'***' if step.action == 'type' else step.value} — {step.reason}")
            if execute(driver, state, step):
                print(f"\n✅ Agent finished in {n} step(s): {step.reason}")
                return 0
        print(f"\n⏹️  Stopped after max {max_steps} steps without an explicit finish.")
        return 1
    finally:
        driver.quit()


def main() -> int:
    p = argparse.ArgumentParser(description="Selenium AI agent loop")
    p.add_argument("goal", help="Natural-language goal, e.g. 'log in and refill a prescription'")
    p.add_argument("--url", default=DEFAULT_URL, help=f"Starting URL (default: {DEFAULT_URL})")
    p.add_argument("--max-steps", type=int, default=15, help="Safety cap on loop iterations")
    p.add_argument("--headed", action="store_true", help="Show the browser window")
    args = p.parse_args()
    try:
        return run(args.goal, args.url, args.max_steps, args.headed)
    except Exception as exc:  # noqa: BLE001 - surface a clean message to the CLI
        print(f"❌ {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
