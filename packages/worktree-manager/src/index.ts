import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { minimatch } from "minimatch";
import { safeEnvironment } from "../../acp-client/src/index.ts";

type Worktree = {
  path: string;
  branch: string;
};

type WriteGlobVerification = {
  valid: boolean;
  outside: string[];
};

type IntegrationResult =
  { success: true; conflict: null } | { success: false; conflict: string };

function runGit(root: string, args: string[]) {
  return execa("git", args, {
    cwd: root,
    env: safeEnvironment(),
  });
}

async function branchExists(
  repoRoot: string,
  branch: string,
): Promise<boolean> {
  const result = await execa(
    "git",
    ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
    {
      cwd: repoRoot,
      env: safeEnvironment(),
      reject: false,
    },
  );

  return result.exitCode === 0;
}

function isWorktreeListed(listOutput: string, path: string): boolean {
  return listOutput.split("\n").includes(`worktree ${path}`);
}

function isAllowedByAnyGlob(file: string, globs: string[]): boolean {
  return globs.some((glob) => minimatch(file, glob, { dot: true }));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class WorktreeManager {
  constructor(
    readonly repoRoot: string,
    readonly stateRoot = join(repoRoot, ".graph-engineer"),
  ) {}

  async dirtyBase(): Promise<boolean> {
    const result = await runGit(this.repoRoot, [
      "status",
      "--porcelain",
      "--",
      ".",
      ":(exclude).graph-engineer/**",
    ]);
    return result.stdout.trim().length > 0;
  }

  path(projectId: string, runId: string, nodeId: string): string {
    return join(this.stateRoot, "worktrees", projectId, runId, nodeId);
  }

  async create(
    projectId: string,
    runId: string,
    nodeId: string,
    baseRef: string,
  ): Promise<Worktree> {
    if (await this.dirtyBase()) {
      throw new Error("DIRTY_BASE_REPOSITORY");
    }

    const path = this.path(projectId, runId, nodeId);
    const branch = `graph/${runId}/${nodeId}`;
    const listedWorktrees = await runGit(this.repoRoot, [
      "worktree",
      "list",
      "--porcelain",
    ]);

    if (isWorktreeListed(listedWorktrees.stdout, path)) {
      return { path, branch };
    }

    await mkdir(join(path, ".."), { recursive: true });

    const addArguments = (await branchExists(this.repoRoot, branch))
      ? ["worktree", "add", path, branch]
      : ["worktree", "add", "-b", branch, path, baseRef];
    await runGit(this.repoRoot, addArguments);

    return { path, branch };
  }

  async cleanup(path: string): Promise<void> {
    await runGit(this.repoRoot, ["worktree", "remove", "--force", path]);
  }

  async changedFiles(path: string): Promise<string[]> {
    const result = await runGit(path, ["status", "--porcelain"]);
    return result.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => line.slice(3));
  }

  verifyWriteGlobs(files: string[], globs: string[]): WriteGlobVerification {
    const outside = files.filter((file) => !isAllowedByAnyGlob(file, globs));
    return {
      valid: outside.length === 0,
      outside,
    };
  }

  async collectDiff(path: string, artifactPath: string): Promise<string> {
    await runGit(path, ["add", "--intent-to-add", "."]);
    const result = await runGit(path, ["diff", "--binary", "HEAD"]);

    await mkdir(join(artifactPath, ".."), { recursive: true });
    await writeFile(artifactPath, result.stdout);
    return artifactPath;
  }

  async commit(path: string, message: string): Promise<string> {
    await runGit(path, ["add", "-A"]);
    await runGit(path, ["commit", "-m", message]);
    const result = await runGit(path, ["rev-parse", "HEAD"]);
    return result.stdout.trim();
  }

  async integrate(
    integrationPath: string,
    commits: string[],
  ): Promise<IntegrationResult> {
    for (const commit of commits) {
      const result = await execa("git", ["cherry-pick", commit], {
        cwd: integrationPath,
        env: safeEnvironment(),
        reject: false,
      });

      if (result.exitCode !== 0) {
        return {
          success: false,
          conflict: result.stderr,
        };
      }
    }

    return {
      success: true,
      conflict: null,
    };
  }
}

export async function terminateProcessGroup(
  pid: number,
  graceMs = 500,
): Promise<void> {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // The process group may already have exited.
  }

  await wait(graceMs);

  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // The process group may have exited during the grace period.
  }
}
