# Development guide

OpenGraph separates hand-written source, local verification assets, and vendored plugin output.

## Repository boundaries

- `apps/**/src` contains application entry points and UI composition.
- `packages/**/src` contains reusable contracts, services, runtime logic, and adapters.
- `tests/**`, `vitest.config.ts`, and `playwright.config.ts` are local-only verification assets.
- `plugins/graph/runtime/**` is generated release output. Do not edit it by hand.
- `.graph-engineer*/`, `test-results/`, and `artifacts/` are disposable local state.

Application entry points should stay thin. Business logic belongs in a package or a focused module,
and package `index.ts` files should expose stable public APIs without containing implementations.

## Quality checks

Run these checks after changing source:

```bash
pnpm format
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Changes to the daemon or dashboard should also pass `pnpm e2e`. Changes included in the installable
plugin must finish with `pnpm plugin:build`.

## Plugin build

`pnpm plugin:build` builds the Vite dashboard, copies it into
`plugins/graph/runtime/dashboard`, and bundles the MCP entry point into
`plugins/graph/runtime/server.mjs`. The runtime directory is committed for self-contained installs,
but its files are reviewed as generated output rather than maintained as source.
