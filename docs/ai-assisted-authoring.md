# AI-assisted test authoring

Generate runnable tests from plain-English scenarios that already follow this repo's
conventions (data-testid selectors, the self-healing helpers, synthetic data factories).

## Generate a test from a sentence

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node --experimental-strip-types shared/ai/nl-to-steps.ts \
  --framework playwright \
  "Patient logs in, books a dermatology appointment, then submits an insurance claim"
```

The CLI feeds Claude an **authoring guide** (`shared/ai/nl-to-steps.ts`) listing the
available `data-testid`s, the demo credentials, and the factory helpers, so the generated
code drops into `playwright/tests/` (or `cypress/e2e/`) with minimal edits.

Without an API key it prints a ready-to-fill scaffold, so the workflow still works offline.

## Recommended human-in-the-loop flow

1. **Describe** the scenario in one or two sentences.
2. **Generate** a first draft with the CLI.
3. **Review** — AI output is a starting point, not ground truth. Check selectors and
   assertions against the actual app.
4. **Run** it; let self-healing surface any selector drift.
5. **Commit** the reviewed test.

## Prompt library

Reusable prompts for common authoring/maintenance tasks live alongside the code:

- *"Given this failing test output and the DOM, propose the minimal selector fix."*
- *"Convert this manual test case (Gherkin) into a Playwright spec using our fixtures."*
- *"Generate edge-case variants (boundary dates, max-length fields) for this workflow."*

> AI accelerates authoring; it does not replace review. Treat every generated assertion as a
> hypothesis until a human confirms it reflects real, intended behaviour.
