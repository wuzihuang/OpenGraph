import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const gitIdentityCommands = [
  ["init", "-b", "main"],
  ["config", "user.email", "graph@example.test"],
  ["config", "user.name", "Graph Demo"],
] as const;

/** Demo target repo lives outside the workspace so only the opengraph project .git remains. */
export function demoRepositoryRoot(): string {
  return (
    process.env.OPENGRAPH_DEMO_REPO ??
    join(homedir(), ".cache", "opengraph", "sample-repo")
  );
}

function runGit(root: string, args: readonly string[]): void {
  execFileSync("git", [...args], { cwd: root, stdio: "ignore" });
}

export function ensureDemoRepository(root: string): void {
  if (existsSync(join(root, ".git"))) {
    return;
  }

  mkdirSync(root, { recursive: true });
  const files: Record<string, string> = {
    "package.json":
      '{"name":"graph-sample","private":true,"scripts":{"test":"node --test"}}\n',
    "test.mjs":
      "import test from 'node:test';import assert from 'node:assert/strict';test('sample',()=>assert.ok(true));\n",
    "src/runtime/index.ts": "export const runtimeReady = true;\n",
    "src/dashboard/index.ts": "export const dashboardReady = true;\n",
  };

  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    if (!existsSync(target)) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
  }

  for (const args of gitIdentityCommands) {
    runGit(root, args);
  }
  runGit(root, ["add", "."]);
  runGit(root, ["commit", "-m", "chore: initialize graph demo"]);
}

export function flappyBirdRepositoryRoot(): string {
  return process.env.OPENGRAPH_FLAPPY_REPO ?? join(homedir(), "flappy-bird");
}

export function ensureFlappyBirdRepository(root: string): void {
  mkdirSync(root, { recursive: true });
  if (existsSync(join(root, ".git"))) {
    return;
  }

  for (const args of gitIdentityCommands) {
    runGit(root, args);
  }
  writeFileSync(
    join(root, "README.md"),
    "# Flappy Bird\n\nOpenGraph Claude Code target repository.\n",
  );
  runGit(root, ["add", "."]);
  runGit(root, ["commit", "-m", "chore: init flappy bird workspace"]);
}
