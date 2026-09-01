---
name: graph
description: >-
  Plan graphs (Goal Charter + three loop bodies) or act on an existing draft.
  Infer from conversation whether to plan, amend, or start — do not rely on fixed
  trigger phrases. Dashboard is display-only; graph_start_run starts runs.
---

# Graph

## Intent (read first — use judgment, not keyword lists)

Before any tool call, infer what the user wants **from the full conversation**, not from matching specific words.

**Gather context:**

- Did this thread already publish a Draft (`graphId` in prior tool results)?
- Is a run already active (`runId`, `graph_tail_run_events`)?
- If unsure what exists: call **`graph_list_graphs`** (newest first).

**Three intents — pick one:**

| Intent      | User is trying to…                                                                                                                             | Do                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Execute** | Proceed with the **current** published graph — run workers, approve the draft as-is, “let’s go”, “开干”, short follow-up after reviewing Draft | **`graph_start_run`** → **`graph_tail_run_events`**. Do **not** validate/publish a new spec.           |
| **Revise**  | Change goals, nodes, charter, or fix something in the **current** graph                                                                        | Read comments → **`graph_propose_amendment`** (or re-confirm Goal Charter if strategic layer changed). |
| **Plan**    | Describe **new** work not covered by the existing Draft                                                                                        | Full planner loop below (Sense → Goal Charter → … → Publish).                                          |

**Judgment rules:**

- Short or informal messages after a Draft usually mean **Execute**, not Plan — unless they introduce a **new** goal or scope change.
- Do **not** require exact phrases; understand meaning in context (Chinese, English, typos, slang all fine).
- Ask **one** clarifying question only when Execute vs Plan vs Revise is genuinely ambiguous **and** `graph_list_graphs` did not resolve it.
- Never auto-start without the user clearly wanting to proceed with the existing Draft.

---

Treat the text supplied with this invocation as a **seed** when **Plan** intent applies — not when **Execute** or **Revise** applies.
If Plan intent but no seed, ask for one concise outcome and stop until you have it.

Design and planning are one skill. The planner does **not** run a linear workflow
(step1→step2→done). It runs a **bounded planner loop**:

1. Confirm **three mutually constraining goals** with the human (Goal Charter).
2. Propose a graph as **three loop bodies** (fast / medium / strategic), each with
   workers + adversarial review — not a single KPI self-loop.
3. Critique → Validate → revise until gates pass or the attempt budget is exhausted.
4. Publish and open Dashboard for **review only** — then stop until the user asks to start.

**Approval / start boundary:** Dashboard is **display-only** (no Approve/Start). The user's explicit Execute message in agent chat is the approval. In that same turn, call **`graph_start_run`** directly — it records approval and starts the run atomically. Never redirect to Dashboard buttons. Never auto-start without clear user intent to proceed.

If `graph_start_run` is absent from the available Graph tools, report a stale
Graph installation/session and ask the user to reload the agent session after
reinstalling the plugin. **Never** invent a Dashboard approval button or claim
the user must click one.

## Planner loop

```text
        ┌──────────────────────────────────────────────────────────────┐
        │                                                              │
 Sense ─┴─► Goal Charter (human confirm) ─► Propose ─► Critique ─► Validate ─┬─► Publish
                 ▲                              ▲                      │         │
                 │                              └── revise (fail) ─────┘         ▼
                 └── re-confirm if goals change              max 3 rounds   Review in Dashboard
                                                                            (stop; start only on ask)
```

Publish refuses the draft when shadow-run fails (`SHADOW_FAILED`); revise and re-publish.

### 1. Sense (once)

1. Call `graph_discover_environment`, then `graph_inspect_repository` for the current repository root.
2. **Startup brief:** read `plannerBrief` first. Also use `availableCapabilities`, `agentsByCapability`, and `plannerNotes`.
3. Planner tools auto-ensure local graphd is healthy before API calls; if ensure fails, surface the tool error instead of handing the user a dead URL.

### 2. Goal Charter (mandatory — stop and confirm with the human)

**Do not call `graph_validate_spec` or `graph_publish_draft` until the human has confirmed the charter** (or explicitly said “use your best judgment and proceed”).

From the seed + repo sense, draft **exactly three goals** that **constrain each other**. Present them in chat and wait for confirmation / edits. Re-confirm if Critique later shows the goals were wrong.

| Layer                  | Name in charter | What the human must lock                                                            | Default question to ask                                       |
| ---------------------- | --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Strategic (大目标)** | `strategicGoal` | Why this work matters; what must _not_ be sacrificed                                | “What is success beyond the delivery metric?”                 |
| **Medium (中速目标)**  | `mediumGoal`    | Health / quality / method / non-gaming outcome that can **veto** a green fast score | “What second signal proves we didn’t cheat the first metric?” |
| **Fast (小目标)**      | `fastGoal`      | The quick iterate target workers chase this run                                     | “What concrete artifact/metric should the fast loop improve?” |

**Mutual constraint rule (write this into the charter text the user confirms):**

- Fast success that harms Medium → **reject** (Medium supervises Fast).
- Medium success that violates Strategic intent → **reject / amend** (Strategic supervises Medium).
- Strategic does **not** rewrite Fast’s exam mid-run; it forces a new version via amend + human.

Also lock in the charter (short bullets the user can edit):

1. **Primary metric / artifact** for Fast (what workers optimize).
2. **Adversarial evidence** for Medium (different from the Fast metric — tests, retention proxy, rationale audit, holdout set, lint reality, …).
3. **Frozen exam** — what workers must never soften (acceptance commands, eval suite, “do not delete hard cases”).
4. **Human gate** — what only the user may decide (ship, scope cut, change of Strategic goal).

If the user only gives one sentence, **propose** all three layers yourself and ask them to confirm or correct — do not silently collapse to one KPI.

Tiny exceptions (`single_agent` / ≤2 meaningful steps): still state Fast + at least one Medium constraint in chat; Strategic may be “same as Fast, human confirms ship.” Skip a full three-body graph only when the user agrees the change is trivial.

### 3. Propose (build three loop bodies)

After charter confirmation, invent a `GraphSpecV1` whose topology is literally **three loop bodies watching each other**, not a flat workflow with a verifier glued on.

#### Canonical shape (default for non-trivial graphs)

```text
                         □ fast_analyze
                       ↙                  ↘
              □ fast_worker_a       □ fast_worker_b
                       ↘                  ↙
                         □ fast_verifier
                               ⇅ veto

       MEDIUM LOOP                              STRATEGIC LOOP
       □ mid_analyze                            □ strat_review
        ↘        ↖                                ↘        ↖
          □ mid_verifier       ⇄ □ guard_arbiter ⇄  □ strat_acceptance
        ↗        ↙
       □ mid_integrity

 Fast optimizes delivery. Medium challenges Fast with different evidence.
 Governance arbitrates conflicts and protects frozen evaluation.
 Strategic/human decides whether the direction remains worth pursuing.
```

This is a **semantic multi-loop map**, not decorative branching. Prefer a
top-center Fast loop, lower-left Medium loop, lower-right Strategic loop, and
central Governance/Anchor nodes. The Dashboard recognizes these regions from
stable node prefixes and renders each node as a draggable square card. The
overall topology may form diamonds and rings; the card silhouette stays square.

#### Visual topology contract (required)

For every non-trivial graph:

1. Prefix every node id with exactly one semantic region:
   - `fast_`: delivery, optimization, integration, Fast verification
   - `mid_`: health, method, holdout, anti-Goodhart, integrity verification
   - `strat_`: human direction review and frozen final acceptance
   - `guard_`: cross-loop arbitration, immutable benchmark, external anchor
2. Create real **fan-out and fan-in** inside Fast whenever two independent
   artifacts or write scopes exist: one analysis/source → 2–4 parallel workers
   → reducer/integration → `fast_verifier`.
3. Give Medium its own 2–4-node review body when risk is non-trivial. It must
   consume Fast artifacts and emit a distinct audit/holdout artifact.
4. Put conflict handling or exam integrity in the visual center as `guard_*`.
   It must consume evidence from at least two regions; it is not a decorative
   node.
5. End through `strat_human` and/or `strat_acceptance`. Strategic owns value and
   amendment; it never silently edits Fast's metric during a run.
6. Every displayed edge carries a named artifact or a bounded conditional veto.
   Add cross-loop edges that express supervision, not merely execution order.
7. Use cycles only when the runtime condition is explicitly bounded
   (`max_iterations`, `give_up`, or `dry_round_limit`). Otherwise represent a
   retry as a verifier rejection plus bounded node attempts; never add fake
   arrows just to make the picture circular.
8. Use concise, human-readable titles. Node titles should describe decisions
   such as “Challenge benchmark integrity”, not generic steps such as “Task 4”.

The visual target is recognizably **several loops watching one another** at a
glance. A long left-to-right or top-to-bottom chain fails Critique even if it
passes schema validation.

#### Under every loop body: Worker + Adversarial Review

Each loop body is a **mini execute→supervise cycle**, not a lonely node:

| Loop          | Typical nodes (name them clearly)                    | Worker job                                                      | Adversarial review job                                                                 |
| ------------- | ---------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Fast**      | `fast_analyze?` → `fast_worker(+)` → `fast_verifier` | Deliver / raise `fastGoal` artifacts                            | Refuse weak claims with **physical** evidence for that delivery                        |
| **Medium**    | `mid_worker?` or `mid_analyze` → `mid_verifier`      | Produce health/method/audit artifacts (or consume Fast outputs) | **Kill** Fast success when Medium evidence fails (Goodhart / overfit / exam tampering) |
| **Strategic** | `strat_human` and/or `strat_acceptance`              | N/A — value & frozen criteria                                   | Confirm charter; final accept against frozen anchors; no in-run thaw                   |

Rules for building the bodies:

1. **≥1 writer under Fast** with named outputs; **≥1 independent `verifier` under Fast** (`freshSession`, readonly).
2. **≥1 independent `verifier` (or acceptance checks) under Medium** whose objective cites the **Medium goal** and **different evidence** than Fast’s KPI. Prefer a second verifier node over “the same verifier re-reads accuracy.”
3. **Strategic** appears as `human` and/or terminal `acceptance` with `acceptanceFrozen: true`. Put `human` **before** irreversible commit when Strategic is ambiguous.
4. Wire edges so Medium consumes Fast artifacts; Strategic/acceptance consumes Medium (and Fast) artifacts. No completion-only edges.
5. Bound Fast retries (`retryPolicy.maxAttempts`, optional evaluator–optimizer edges). Medium/Strategic must be able to force Fast redo without thawing the exam.
6. If gaming the exam is plausible, add an explicit Medium (or Fast-adjacent) verifier whose objective is **eval-set / acceptance integrity** (“did anyone drop hard cases / soften checks?”).
7. Parallel Fast writers only on **disjoint** `writeGlobs`. Prefer `nestedSubagents: false`.
8. Put charter goals into `goalCharter` (required), summarize Strategic in `goal`, and mirror Medium/Strategic in `acceptanceCriteria`.
9. Assign agents via `agentSelector.requiredCapabilities` / `preferredAgents` — never paste raw MCP schemas or full skill bodies into objectives.

Node ids must follow the Visual topology contract. Use `guard_` for shared
anchors and arbitration; do not leave meaningful nodes ungrouped.

### 4. Critique (soft verifier — adversarial)

Before validate, run the **Pre-validate rubric**. Soft fails → revise Propose (or return to Goal Charter if the goals themselves are wrong). Do not cheerlead your own draft.

### 5. Validate (hard gate) + revise loop

1. Call `graph_validate_spec`.
2. On any error: edit the spec, return to **Critique** then **Validate** again.
3. Cap at **3 validate rounds**. If still red: simplify **Fast writers**, never delete Medium/Strategic supervision just to pass lint — or stop and ask the human with blocking errors.
4. Exit only when validate is clean.

### 6. Publish (after green)

1. Call `graph_publish_draft`. `repository.root` must be a real git repo (never `$HOME`). On `SHADOW_FAILED`, revise and retry — do not claim Draft ready.
2. Call `graph_open_dashboard` for **review only**. Dashboard does not start runs.
3. Open `dashboardUrl` with the host opener when available. Never claim open unless `reachable: true` (and `opened: true` when an opener ran).
4. Tell the user Draft is ready; include clickable `dashboardUrl`. Mention shadow-certified only when `shadowCertification.ok` is true. Keep the response short — but remind which three goals the graph encodes.

### 7. Execute (when intent = proceed with current Draft)

When the user wants to **run the graph you already published** (infer from context — not a fixed phrase list):

1. **Do not** Sense / Goal Charter / Propose / Validate / Publish again.
2. Call **`graph_start_run`** (`graphId` from thread, or omit to pick newest draft; pass `repositoryRoot` when known).
3. Open returned `dashboardUrl`; poll **`graph_tail_run_events`** while active.
4. Read **`graph_list_node_comments`** before any later **Revise**.
5. Poll **`graph_tail_run_events`** and stream notable lines into chat while the run is active.
6. Read **`graph_list_node_comments`** before any amendment.

**Never** tell the user to click Approve/Start in the Dashboard — those controls do not exist.

Never claim a run started unless `graph_start_run` returned `started: true`. Use `graph_propose_amendment` for later changes (versions are immutable). If Medium/Strategic findings imply the charter is wrong, **re-run Goal Charter** with the human before amending.

## Design doctrine

Deterministic lint is the hard gate; this doctrine is how Propose must think.

Graph Engineering ≠ prettier workflow. A workflow is a fixed pipeline. A graph is **loops watching loops**: several **goals** constrain each other; under each goal, **workers iterate** and **adversarial reviewers refuse** weak evidence; acceptance stays frozen; humans own Strategic value.

### Why single-loop / single-goal fails

| Failure               | What happens              | Countermeasure in this skill                          |
| --------------------- | ------------------------- | ----------------------------------------------------- |
| **Goodhart**          | Fast metric↑, reality↓    | Medium loop with **different** evidence can veto Fast |
| **Upward blindness**  | Never question the target | Strategic Goal Charter + `human` / amend              |
| **Conflict**          | Speed vs quality fight    | Explicit Fast vs Medium goals + arbiter topology      |
| **Measurement decay** | Soften the exam           | Frozen acceptance + integrity verifier                |

### Goal Charter ↔ OpenGraph fields

| Charter     | Spec fields                                                                        |
| ----------- | ---------------------------------------------------------------------------------- |
| Strategic   | `goalCharter.strategic` + `goal` summary + human/acceptance boundary               |
| Medium      | `goalCharter.medium` + ≥1 `acceptanceCriteria` + `mid_verifier` objective / checks |
| Fast        | `goalCharter.fast` + worker objectives + Fast artifacts + `fast_verifier`          |
| Frozen exam | `policies.acceptanceFrozen: true`, checks `frozen: true`                           |
| Mutual veto | edges Fast → Medium → Strategic/acceptance; Medium may fail the run                |

### Non-negotiables (Perez triad)

1. **Anchors** — command/artifact checks that touch external facts. “Model says pass” is not an anchor.
2. **Frozen evaluation** — workers never rewrite checks or drop hard cases in-run; change only via amend + human.
3. **External judgment** — Goal Charter + human approves via explicit chat request → `graph_start_run`; never auto-start.
4. Named artifact edges; no fake completion edges.
5. Parallel writers: non-overlapping `writeGlobs`.
6. Every code-writing node: `verifierPolicy.required` + `freshSession` + path to independent `verifier`.
7. Bound retries / timeouts / discovery loops.
8. **Confirm goals with the human before Propose** — this is not optional chatter.

### Decompose work (inside Fast; supervised by Medium/Strategic)

1. Split Fast by **write scope / blast radius** and **artifact**, not job title.
2. One node = one objective a fresh agent can finish.
3. **Redo-cost boundary**: checkpoint where re-running after Medium veto is acceptable.
4. Never collapse away Medium/Strategic to look smaller.
5. Use `single_agent` only when the user agrees the change is trivial after a thin charter. Otherwise use `graph` with three loop bodies.

### Kind cheat sheet

| kind                      | role in loop bodies                                        |
| ------------------------- | ---------------------------------------------------------- |
| `analysis`                | map/plan inside a loop; emit artifacts                     |
| `worker`                  | Fast (or Mid) execute; never self-accept                   |
| `reducer` / `integration` | merge Fast fan-out; prefer deterministic reduce            |
| `verifier`                | **Adversarial** review for that loop body; fresh; readonly |
| `acceptance`              | Strategic/frozen final pass                                |
| `human`                   | Strategic value / irreversible gate                        |

### Verifier objectives

Write every verifier `objective` to **reject** weak claims for **its loop’s goal**. Demand physical evidence. Never “confirm the worker did a good job.” Medium verifiers must say what Fast green they are allowed to kill and **on what different evidence**.

### Artifact edges

For every edge: **what concrete artifact crosses?** Completion-only = fake edge. Name after content. Types: `json`, `git_patch`, `diff`, `text`, `test_report`, `directory`. Special input `"repo"` = repository context.

### Topology patterns (always layered on three loop bodies)

1. **Chaining** — Fast chain → Mid verifier → Strat acceptance/human.
2. **Diamond** — Fast parallel workers (disjoint writes) → integrate → Mid → Strat.
3. **Routing** — sparse `condition` on artifact fields.
4. **Bounded evaluator–optimizer** — inside Fast: worker ⇄ `fast_verifier` with hard attempt caps; Mid still supervises the result with different evidence.
5. **Research then act** — optional analyze, then Fast; Mid/Strat still required for non-trivial work.

### Agent capabilities

Read `plannerBrief` first. Use `requiredCapabilities` tags from discovery. Do not paste raw MCP schemas or full skill markdown into objectives. Missing capability → weaker plan or ask human — do not invent tools.

### Defaults that usually validate

```text
policies.maxParallel: 2–4
policies.maxNodeAttempts: 2–3
policies.networkPolicy: approval_required
policies.nestedSubagents: false
policies.approvalPolicy: human_required
policies.acceptanceFrozen: true

worker.retryPolicy: maxAttempts 2, freshSession true
writer.verifierPolicy: required true, freshSession true, readonly true
writer.workspace.mode: worktree
analysis/verifier.workspace.mode: readonly
writer acceptanceChecks: prefer type command (lint/test) with frozen true
```

### Pre-validate rubric

| Check          | Pass means                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Charter        | Human confirmed Fast + Medium + Strategic (or explicit proceed); criteria encode ≥ Medium + Strategic, not Fast alone |
| Three bodies   | Topology has Fast workers+verifier, Mid adversarial path, Strat human/acceptance                                      |
| Mutual veto    | Medium can reject Fast green; Strategic/acceptance gates ship; edges carry artifacts                                  |
| Anchors        | ≥1 physical command/artifact check                                                                                    |
| Granularity    | No mega-worker; redo-cost boundaries clear                                                                            |
| Artifacts      | Dependency test passes                                                                                                |
| Isolation      | Parallel Fast write globs disjoint                                                                                    |
| Adversarial    | Verifiers reject; Mid evidence ≠ Fast KPI                                                                             |
| Frozen exam    | No in-run thaw / suite softening path                                                                                 |
| Capabilities   | tags ⊆ discovered (or human-confirmed)                                                                                |
| Width / Bounds | ready set ≤ maxParallel; retries capped                                                                               |
| Safety         | irreversible → human; start only via `graph_start_run` on explicit user ask — never Dashboard buttons                 |
| Economy        | simplify Fast writers first — never strip Mid/Strat supervision                                                       |

### Anti-patterns

- Skipping Goal Charter / inventing a single KPI and publishing
- Flat workflow with one verifier that only re-scores the Fast metric
- Fast-only graph (“automation”) with no Medium veto
- Medium verifier that shares worker context or cheerleads
- Thawing acceptance / dropping hard cases
- Mega-worker; overlapping parallel writes; fake edges
- Deleting Mid/Strat nodes to make the graph “look smaller”
- Publishing a **new** graph when intent was clearly **Execute** (proceed with existing Draft)
- Re-planning from scratch when intent was **Revise** (amend the current version)
- Telling the user to Approve/Start in the Dashboard (display-only — use `graph_start_run` when they ask)
- Auto-starting a run without the user explicitly requesting it
- Asking random clarifying questions that do **not** lock the three goals — Goal Charter questions are required; trivia is not

**In scope:** one approved single-goal **run version** that still encodes three mutually constraining loop bodies.

**Out of scope:** perpetual always-on org products, temporal KG memory stacks, cloud control planes.
