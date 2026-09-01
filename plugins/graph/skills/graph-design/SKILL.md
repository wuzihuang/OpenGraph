---
name: graph-design
description: >-
  Design doctrine for GraphSpecV1 topology: loops-watching-loops supervision,
  artifact edges, parallel blast-radius isolation, anchors/frozen acceptance,
  control-flow patterns, and a pre-validate quality rubric. Use when inferring
  or amending a GraphSpec, choosing fan-out vs serial plans, or reviewing
  whether a draft graph is well-shaped before validation.
---

# Graph Design

Teach the planner how to shape a good graph. Deterministic lint remains the hard
gate; this skill is soft guidance so drafts need fewer validate/fix cycles.

Graph Engineering is **not** “workflow with prettier nodes.” A workflow is a fixed
pipeline. A graph is an organization of **loops watching loops**: writers optimize,
verifiers adversarially refuse weak evidence, acceptance stays frozen, and humans
anchor value. Prefer structure over “a smarter single agent.”

## Why graph (single-loop failure modes)

Design against these; do not rely on the model to “be careful”:

| Failure | Graph countermeasure in OpenGraph |
|---------|-----------------------------------|
| **Goodhart** — metric rises, reality falls | Independent `verifier` + physical `acceptanceChecks` (commands/artifacts), not self-score |
| **Upward blindness** — cannot question the goal | `human` / approval boundary; amend via new version, not in-run thaw |
| **Conflict** — speed vs quality loops fight | Explicit topology + `maxParallel`; integration/reducer arbitration, not nested free-for-all |
| **Measurement decay** — soften the exam | `acceptanceFrozen: true`; workers must not rewrite checks or swap easier suites |

## Non-negotiables (Perez triad + OpenGraph)

1. **Anchors** — Prefer `acceptanceChecks` of type `command` / `artifact` that touch
   external facts (test exit code, build, diff present). “Model says pass” is not an anchor.
2. **Frozen evaluation** — `policies.acceptanceFrozen: true`; keep checks `frozen: true`
   on workers. Change criteria only via `graph_propose_amendment` + new human approval.
3. **External judgment** — Humans decide what is worth pursuing and approve versions.
   Planner tools never approve or start runs.
4. Dependencies are **named artifacts**, never completion-only edges.
5. Parallel writers must have **non-overlapping** `writeGlobs` (blast-radius split).
6. Every code-writing node needs `verifierPolicy.required` + `freshSession`, and a
   path to an independent `verifier` node (`MISSING_SUPERVISOR_PATH` otherwise).
7. Prefer `nestedSubagents: false`. Bound retries, timeouts, and discovery loops.
8. Ask the human only when a missing choice would materially change the topology.

## Decompose the goal

1. Restate the goal as one outcome plus measurable `acceptanceCriteria`.
2. Split work by **write scope / blast radius** and **artifact**, not by job title.
3. One node = one objective a fresh agent can finish without inventing sibling work.
4. **Redo-cost boundary**: draw a node where you would accept re-running that work
   after a later failure (expensive compile/test/fetch ends at a checkpointable node).
5. Prefer fewer, clearer nodes over a wide “do everything” worker.
6. Use `single_agent` when the change is tiny (roughly ≤2 meaningful steps) **or**
   steps are strictly sequential with no fake edges to collapse. Use `graph` when
   analysis, parallel writers, integration, supervision, or irreversible anchors matter.

### Kind cheat sheet

| kind | supervision | typical workspace | notes |
|------|-------------|-------------------|-------|
| `analysis` | execute | `readonly` | map / plan; emit artifacts, not patches |
| `worker` | execute | `worktree` + narrow writes | implement; never self-accept |
| `reducer` | execute | `readonly` or narrow | Prefer **deterministic merge** (dedupe/sort/concat). Do not spend an LLM on pure reduce |
| `integration` | execute | `integration` | combine isolated patches/worktrees |
| `verifier` | supervise | `readonly` | **Adversarial**: find objective reasons to refuse; fresh session; no shared worker transcript |
| `acceptance` | accept | `readonly` | final pass against frozen criteria + anchors |
| `human` | anchor | n/a | irreversible / value choice — not a mid-pipeline reading bottleneck |

Flow of roles: execute → supervise → accept → (optional) human anchor.

### Verifier objectives

Write verifier `objective` text to **reject** weak claims: demand physical evidence
(diff scope, command exit, artifact schema). Never “confirm the worker did a good job.”

## Artifact edges (dependency test)

For every edge ask: **what concrete artifact crosses this edge?**

- If the answer is only “B needs A to have finished,” that is a **fake edge** — remove
  it or replace with a real artifact. Fake edges hide parallelism and fail lint.
- Every edge lists ≥1 artifact produced by `from` and consumed by `to`.
- Name artifacts after content (`repo-map.json`, `runtime.patch`), not hopes.
- Prefer types: `json`, `git_patch`, `diff`, `text`, `test_report`, `directory`.
- Do not leave unused producer outputs (except terminal verifier/acceptance).
- Special input `"repo"` means repository context; everything else needs a producer.
- Keep planner-visible contracts small: paths, ids, flags, artifact names — bulky
  transcripts stay in the artifact store, not in objectives.

## Topology patterns (compose these)

### 1. Chaining (serial)

`analyze` → `worker` → `verifier` → `acceptance`

One write scope. Checkpoints between expensive steps.

### 2. Diamond / parallel feature

`analyze` → (`worker_a` ∥ `worker_b`) → `integration`|`reducer` → `verifier` → `acceptance`

- Fan-out only on **disjoint blast radii** (`writeGlobs`).
- Cap ready width with `policies.maxParallel` (width budget).
- Reduce/integration should compress artifacts before a heavy synthesize/verify step.

### 3. Routing (conditional)

Upstream emits a decision artifact; downstream edges use `condition` sparingly.
Prefer deterministic routing on artifact fields over model improvisation mid-graph.

### 4. Evaluator–optimizer (bounded)

`worker` ⇄ `verifier` with hard `retryPolicy.maxAttempts` and `freshSession`.
No unbounded “until perfect.” Optional edge conditions:
`max_iterations` / `give_up` / `dry_round_limit` for discovery loops.

### 5. Research then act

`analyze` → `human?` → `worker(s)` → `verifier` → `acceptance`

Insert `human` on irreversible or product-ambiguous forks — as an **approval/
anchor boundary**, not as a chatty node in the middle of every hop.

### When not to graph

Stay on `single_agent` / a short chain when: one-file tweak; pure serial data
dependency with no parallel gain; or early exploration where topology would freeze
the wrong plan. Graph cost must buy supervision or parallelism.

## Agent capabilities

At startup, `graph_discover_environment` builds a condensed packet for the
**main planner agent** so it can decide node→agent assignment:

| Field | Meaning |
|-------|---------|
| `plannerBrief` | Condensed MCP + skills per usable agent + assignment hints — **read this first** |
| `availableCapabilities` | Union of stable tags across usable agents |
| `agentsByCapability` | Which agent ids advertise each tag |
| per-agent `mcpServers` | Server **names only** (no env/args/tokens) |
| per-agent `skills` | Skill **name + short description** only |
| `plannerNotes` | Extra hints |

Rules:

1. Put needs in `agentSelector.requiredCapabilities` using those tags
   (`filesystem.read`, `terminal`, `browser`, `github`, `mcp:sentry`,
   `skill:omarchy`, …). Set `preferredAgents` when several agents match.
2. Do **not** paste raw MCP tool schemas or full skill markdown into node
   `objective` text — that bloats the plan and goes stale.
3. Prefer domain tags (`browser`, `github`) over `mcp:<server>` when both exist.
4. If a needed capability is missing from discovery, either pick a weaker plan
   that base workers can do, or ask the human — do not invent tools.
5. Inventory is a planning hint; runtime auth may still fail.

## Defaults that usually validate

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

## Pre-validate rubric

Score the draft mentally before `graph_validate_spec`. Fix soft fails first.

| Check | Pass means |
|-------|------------|
| Outcome | Goal + ≥1 acceptance criterion, criteria frozen |
| Anchors | At least one physical check (command/artifact), not only prose |
| Granularity | No node spans design+frontend+backend+test+deploy; redo-cost boundaries clear |
| Artifacts | Dependency test passes; every non-repo input has a producer |
| Isolation | Parallel writers’ write globs / blast radii do not overlap |
| Supervision | Each writer reaches an adversarial fresh verifier |
| Capabilities | requiredCapabilities ⊆ discovered availableCapabilities (or human-confirmed) |
| Width | Ready-set size ≤ `maxParallel` |
| Bounds | Retries/timeouts/discovery loops hard-capped; no eternal optimize |
| Safety | Irreversible work needs approval/human anchor; no planner approve/run |
| Economy | Graph not oversized for a one-file tweak |

If several rubric rows fail, simplify topology before fighting lint errors.

Design-time intent for later run metrics (do not invent dashboards in the spec):
critical-path length, retry rate, **verifier kill rate** (0% ≈ rubber stamp;
very high ≈ bad worker brief), fan-out usefulness, human intervention rate.

## Anti-patterns

- Fake edges (`artifacts: []`) used only for ordering
- One mega-worker that “implements the feature”
- Parallel workers both writing `src/**` or `**` (shared blast radius)
- Self-scoring loops / verifier that shares the worker’s context or cheerleads
- Thawing acceptance checks or shrinking the exam to hit a number (Goodhart)
- LLM `reducer` for pure merge/dedupe/sort work
- Human as a slow ordinary node on every hop instead of an irreversible boundary
- Deep nested subagent trees instead of explicit graph nodes
- Unbounded discover/optimize cycles without dry-round or attempt caps
- Asking clarifying questions that do not change the graph shape

## After design

Return to the `graph` skill workflow: `graph_validate_spec` → fix →
`graph_publish_draft` → `graph_open_dashboard`. Never approve or start a run.

Out of scope for this planner skill (do not invent nodes for them): long-lived
multi-cadence org graphs, temporal knowledge-graph memory stacks, cloud control
planes. Keep drafts as supervised **single-goal** execution graphs.
