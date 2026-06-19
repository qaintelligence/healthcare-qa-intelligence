# 🤖 Selenium AI Agent Loop

An autonomous browser agent built on **Selenium + Python**. It pursues a natural-language
goal by repeating a **perception → decision → action** loop — the core pattern behind
agentic browser automation.

```
 ┌─────────────┐   elements    ┌────────────┐   action json   ┌────────────┐
 │  PERCEIVE   │ ────────────▶ │   DECIDE   │ ──────────────▶ │    ACT     │
 │ (DOM → tree)│               │  (Claude)  │                 │ (Selenium) │
 └─────────────┘ ◀──────────── └────────────┘ ◀────────────── └────────────┘
        ▲                  observe again                            │
        └────────────────────────────────────────────────────────-┘
                       loop until `finish` or --max-steps
```

Each step the agent:
1. **Perceives** — tags every visible interactive element with a stable `data-ai-id` and
   builds a compact accessibility-tree observation.
2. **Decides** — sends the goal, current URL, observation, and recent history to Claude,
   which returns the single next action as JSON (a ReAct-style loop).
3. **Acts** — executes that action (`click` / `type` / `select` / `navigate`) via Selenium.
4. **Repeats** until the model emits `finish` or the step cap is reached.

## Safety guards

- **Same-origin only** — navigation off the starting host is refused.
- **Bounded** — `--max-steps` caps the loop (default 15).
- **No secret leakage** — typed values are masked in logs; passwords are never sent to logs.
- **Headless by default** — add `--headed` to watch it work.

## Run it

```bash
cd selenium-agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Start the bundled mock patient portal first (from the repo root):
#   npm run mock        # http://127.0.0.1:4300

# Heuristic mode (no API key needed) — demonstrates the full loop:
python agent.py "log in and request a prescription refill"

# AI mode — Claude drives the decisions:
export ANTHROPIC_API_KEY=sk-ant-...
python agent.py --headed "Log in and book a cardiology appointment"
```

### Example goals

```bash
python agent.py "log in and refill a prescription"
python agent.py "log in and open the billing page"
python agent.py --url https://staging.example.com "log in and submit an insurance claim"
```

## Modes

| Mode | When | Behaviour |
|---|---|---|
| **Claude** | `ANTHROPIC_API_KEY` set | The model chooses each action from the live observation. |
| **Heuristic** | no key | A transparent rule-based policy runs the same loop (login → goal keyword). |

## Responsible use

Point `--url` only at the bundled mock app or systems you are **authorized** to automate.
Autonomous agents can take real actions — never aim this at production or third-party sites
without permission. See the repo's [security testing notes](../docs/security-testing.md).
