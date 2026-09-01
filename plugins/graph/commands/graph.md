---
description: Plan, revise, or execute a graph — infer intent from context, not fixed phrases
argument-hint: "<goal or follow-up>"
---

## Intent (first — your judgment)

Read the **conversation**, not a keyword list. Use **`graph_list_graphs`** if you need ground truth.

| Intent                                                    | Action                                                                             |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Execute** — user wants to run the published Draft as-is | **`graph_start_run`** → **`graph_tail_run_events`**. No replan.                    |
| **Revise** — user wants to change the current graph       | Comments → **`graph_propose_amendment`** (or re-charter if strategic goals shift). |
| **Plan** — new work / no relevant Draft                   | Full planner loop below.                                                           |

Short follow-ups after Publish usually mean **Execute**. Ask once only if truly ambiguous.

The Dashboard has no approval button. An explicit Execute request in this chat
is the human approval; call `graph_start_run` directly in the same turn. If that
tool is missing, report a stale plugin/session and ask for a reload — never send
the user to click the Dashboard.

---

When **Plan** intent: treat `$ARGUMENTS` as a seed goal. Follow the **graph** skill.

1. **Sense (once):** `graph_discover_environment`, then `graph_inspect_repository`. Read `plannerBrief` first.
2. **Goal Charter (mandatory):** Confirm Strategic / Medium / Fast with the human before validate/publish.
3. **Propose:** `GraphSpecV1` with `goalCharter` + three loop bodies (fast / mid / strat verifiers).
4. **Critique → Validate** (max 3 rounds).
5. **Publish:** `graph_publish_draft`, then `graph_open_dashboard` (review only).
6. Stop after Draft until user intent is **Execute** or **Revise**.

Never claim a run started unless `graph_start_run` returned `started: true`.
