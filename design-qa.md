# Graph Dashboard Design QA

- Source visual truth: `/home/zeph/Pictures/screenshot-2026-09-01_05-41-00.png`
- Implementation screenshot: `/home/zeph/graph-engineer/artifacts/graph-dashboard-browser-after-1482x1020.png`
- Combined comparison: `/home/zeph/graph-engineer/artifacts/graph-dashboard-before-after.png`
- Viewport: 1482 × 1020 CSS px
- Source pixels: 1482 × 1020
- Implementation pixels: 1482 × 1020
- Device scale factor: 1 for the implementation; no density normalization was required because both comparison images have identical pixel dimensions.
- State: Graph Draft review, six-node code-review graph, inventory node selected.

## Full-view comparison evidence

The source shows all six nodes sharing the same canvas position, with only the human-review card visible and every incoming/outgoing edge stacked behind it. The implementation shows six distinct cards arranged in five dependency layers. The two review nodes share one layer and occupy separate vertical lanes. Browser geometry inspection reported six nodes, six edges, and zero overlapping node rectangles.

## Focused region comparison evidence

A separate crop was not needed: the full-size 1482 × 1020 comparison clearly exposes the affected graph region, the parallel branch, the merge point, and the terminal human-review node. The implementation screenshot remains available at full resolution for card-level inspection.

## Required fidelity surfaces

- Fonts and typography: Existing Inter and DM Mono usage, weights, hierarchy, wrapping, and compact card labels are unchanged. No typography regression was observed.
- Spacing and layout rhythm: Fixed demo-only coordinates were replaced with deterministic dependency layers, 340 px horizontal spacing, and 290 px parallel-lane spacing. The graph is centered by Fit View and no cards overlap.
- Colors and visual tokens: Existing dark surfaces, blue edges, state dots, borders, shadows, and semantic colors are unchanged.
- Image quality and asset fidelity: This screen has no product imagery. Existing Lucide icons remain vector-rendered and sharp.
- Copy and content: Goal, node titles, objectives, artifact labels, validation status, and inspector content are unchanged.

## Interaction and runtime checks

- Clicking the correctness-review card updated the inspector heading to `审查正确性与可靠性`.
- Six nodes and six edges rendered.
- No overlapping node rectangles were detected.
- No `Runtime.exceptionThrown` or browser log errors were observed.
- The active server returned the dashboard JavaScript with the correct MIME type after the installed-cache compatibility update.

## Findings

- No actionable P0, P1, or P2 findings remain for the reported node-overlap problem.
- P3: Large graphs with substantially more dependency layers may initially fit at a small zoom. The existing zoom and Fit View controls provide an acceptable escape hatch for this six-node graph.

## Comparison history

1. Initial source evidence: P0 layout failure. Six arbitrary node IDs fell back to `{x: 0, y: 0}`, making the graph unreadable.
2. Fix: Added deterministic dependency-layer layout, separate parallel lanes, and a React Flow remount/Fit View when the loaded graph identity changes.
3. First browser verification exposed a deployment-cache issue: the running static server had registered only the old hashed JavaScript route, so the new hash returned HTML and the root stayed blank.
4. Fix: Updated the already-registered installed bundle route for the live server while retaining the normal new-hash output for future plugin starts.
5. Final browser evidence: six nodes, six edges, zero overlaps, working node selection, and zero runtime errors at the source-sized viewport.

## Final result

final result: passed
