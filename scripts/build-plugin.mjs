import { cp, mkdir, rm } from "node:fs/promises";
import { execa } from "execa";

await execa("./node_modules/.bin/vite", ["build"], {
  cwd: "apps/web",
  stdio: "inherit",
});
await rm("plugins/graph/runtime/dashboard", { recursive: true, force: true });
await mkdir("plugins/graph/runtime/dashboard", { recursive: true });
await cp("apps/web/dist", "plugins/graph/runtime/dashboard", {
  recursive: true,
  force: true,
});
await execa(
  "./node_modules/.bin/esbuild",
  [
    "packages/plugin-mcp/src/index.ts",
    "--bundle",
    "--platform=node",
    "--format=esm",
    "--target=node20",
    "--external:better-sqlite3",
    '--banner:js=import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
    "--outfile=plugins/graph/runtime/server.mjs",
  ],
  { stdio: "inherit" },
);
