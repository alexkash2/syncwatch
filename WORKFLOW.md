# WORKFLOW.md — SyncWatch dev process

> **Mandatory reading for Claude before any coding task in this repo.** Follow it
> literally; don't improvise. If a step should change, update this file FIRST,
> then act.

Adapted from the TerrorShop workflow (2026-05-07 lineage) and tailored to
SyncWatch on **2026-05-29**. Core idea: no single model pass is enough — layer
delegation + multi-angle independent review + a final independent model (Codex).

---

## §0. Roles

| Role | Who | Does | Never does |
|---|---|---|---|
| **Orchestrator** | main Claude (Opus) | recon, planning, delegation, self-review, applying review fixes, CHANGELOG, git, prepares Codex prompts | delegate architecture / spec reading / final review / CHANGELOG / destructive git |
| **Implementer** | `Agent` `general-purpose` `model:sonnet` | write code from a precise plan | architectural decisions, final review |
| **Reviewers** | `Agent` `model:opus` | code (`final-reviewer`), security + a11y (`general-purpose`) | implement |
| **Codex** | manual, run by the **user** | final independent review pass | — (orchestrator only prepares the prompt; user runs it, pastes findings back) |

---

## §1. Severity scale

- **P1** — runtime crash / broken core flow / security hole / typecheck-or-build break. **Must fix.**
- **P2** — race / contract drift / a11y blocker / edge case breaking a normal scenario / resource leak. **Must fix.**
- **P3** — style / dead code / naming / minor perf / defence-in-depth. **Fix too** (short fix → fix now; architectural → backlog with a code `TODO`). Do NOT "accept as scope" silently.

---

## §2. Quality gates (run ALL after every fix batch)

- **Backend:** `cd backend && PYTHONPATH=. .venv/Scripts/python -m pytest -q`
- **Frontend:** `cd frontend && npx tsc --noEmit && npm run lint && npm run build && npm run test:run`

Note: SyncWatch's frontend `tsconfig` is standard, so `tsc --noEmit` is valid here
(unlike TerrorShop). Still run lint + build + tests — typecheck alone misses lint
and build-only failures.

---

## §3. Core loop for one unit of work (~6–10 files)

```
0. PLAN — orchestrator authors a plan (or `Plan` agent) → run it through a plan
   reviewer (`Plan` / `final-reviewer`). Loop until P1=0, P2=0, ≤2-3 P3.
1. RECON — read the relevant docs/ section + the exact code in scope (whole
   files via Read, not grep). Confirm contracts; don't trust the plan blindly.
2. DELEGATE TO SONNET — Agent(model:sonnet) with the full plan, contracts,
   constraints, code style, and required output format.
3. SELF-REVIEW + CHANGELOG — read EVERY changed file, fix obvious P1/P2 inline,
   write a CHANGELOG entry (decisions log).
4. REVIEW PASS (parallel, one assistant message, multiple Agent calls):
     - final-reviewer (Opus) — CODE angle
     - general-purpose model:opus — SECURITY angle
     - general-purpose model:opus — A11Y angle (only if UI surface in scope)
   Each report ≤800 words, P1/P2/P3 numbered, file:line + repro + fix.
5. APPLY FIXES — dedup overlapping findings (severity = worst-case wins),
   fix P1+P2+P3, run ALL quality gates, add a CHANGELOG "round N" entry.
6. Repeat 4–5 until every reviewer is clean (P1=0, P2=0, only minor P3).
7. COMMIT + PUSH (+ PR via `gh` if requested).
8. MANUAL CODEX ROUNDS — orchestrator prepares the prompt; user runs Codex and
   pastes findings; orchestrator applies per "P3 тоже фиксим", NEW commit each
   round. Loop until Codex returns clean / "APPROVED FOR MERGE".
```

**Chunk size:** 6–10 files. Smaller = overhead; larger = shallow review.

---

## §4. SyncWatch improvement over TerrorShop — parallel project-wide audit

At the start of a finalization push, spawn **independent background reviewers**
(Opus, `run_in_background: true`) that audit the WHOLE project and write reports
to `reviews/`:

- `reviews/backend-check.md` — backend correctness / bugs
- `reviews/frontend-check.md` — frontend correctness / bugs
- `reviews/security-check.md` — whole-project security
- `reviews/a11y-check.md` — frontend WCAG 2.1 AA

Do NOT wait on them. Do the focused feature work in the foreground; once it's
done, read the report files, triage P1/P2/P3, fix submission-relevant items, and
fold non-feature findings into the Codex prompt or separate fix batches. This
gives a broad independent safety net in parallel with targeted work — cheap,
because it runs while the orchestrator does the real task.

---

## §5. Git safety

Never `reset --hard`, `push --force`, `checkout -- .`, `restore .`, `clean -f`,
`branch -D` without explicit user OK. Prefer NEW commits over `--amend`. Never
skip hooks (`--no-verify`) unless the user asks.

---

## §6. When the workflow changes

If a step can be improved, **edit this file first**, then apply. Record the
change (with date) in the project memory `workflow.md`. Keep it short and load-bearing.
