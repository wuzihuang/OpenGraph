import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { WorktreeManager } from "../../worktree-manager/src/index.ts";
import type { NodeExecutionContext, Worktree } from "./node-execution-types.ts";

export async function createNodeWorktree(
  context: NodeExecutionContext,
  manager: WorktreeManager,
): Promise<Worktree | null> {
  const { node, projectId, spec, state } = context;

  if (node.workspace.mode === "readonly") {
    return null;
  }

  const workspaceName =
    node.workspace.mode === "integration" ? "integration" : node.id;

  return manager.create(
    projectId,
    state.runId,
    workspaceName,
    spec.repository.baseRef,
  );
}

export async function integrateExistingCommits(
  context: NodeExecutionContext,
  manager: WorktreeManager,
  worktree: Worktree | null,
): Promise<void> {
  const { node, state } = context;

  if (!worktree || node.workspace.mode !== "integration") {
    return;
  }

  const commitArtifacts = Object.entries(state.artifactIndex).filter(
    function isCommitArtifact([name]): boolean {
      return name.startsWith("commit:");
    },
  );
  const commits = await Promise.all(
    commitArtifacts.map(async function readCommitArtifact([
      ,
      artifact,
    ]): Promise<string> {
      return readFile(artifact.path, "utf8");
    }),
  );
  const integration = await manager.integrate(
    worktree.path,
    commits.map(function trimCommit(commit): string {
      return commit.trim();
    }),
  );

  if (!integration.success) {
    throw new Error(`INTEGRATION_CONFLICT:${integration.conflict}`);
  }
}

export async function collectWorktreeEvidence(
  context: NodeExecutionContext,
  manager: WorktreeManager,
  worktree: Worktree | null,
  attempt: number,
): Promise<boolean> {
  const { emit, graphId, node, projectId, state, store } = context;

  if (!worktree) {
    return true;
  }

  const changedFiles = await manager.changedFiles(worktree.path);
  const scope = manager.verifyWriteGlobs(
    changedFiles,
    node.workspace.writeGlobs,
  );
  const diffPath = join(store.root, state.runId, "diffs", `${node.id}.patch`);

  await manager.collectDiff(worktree.path, diffPath);

  const diffArtifact = store.writeArtifact(
    state.runId,
    node.id,
    `${node.id}.patch`,
    await readFile(diffPath, "utf8"),
  );
  state.artifactIndex[`diff:${node.id}`] = diffArtifact;

  emit({
    projectId,
    graphId,
    runId: state.runId,
    nodeId: node.id,
    attempt,
    agentId: "git",
    agentSessionId: null,
    type: "agent.diff",
    payload: {
      changedFiles,
      outsideWriteScope: scope.outside,
      patch: diffArtifact.path,
    },
  });

  return scope.valid;
}

export async function commitSuccessfulWorktree(
  context: NodeExecutionContext,
  manager: WorktreeManager,
  worktree: Worktree | null,
  attempt: number,
): Promise<void> {
  const { node, state, store } = context;

  if (!worktree) {
    return;
  }

  const commit = await manager.commit(
    worktree.path,
    `graph(${node.id}): attempt ${attempt}`,
  );
  const commitArtifact = store.writeArtifact(
    state.runId,
    node.id,
    `${node.id}.commit`,
    commit,
  );

  state.artifactIndex[`commit:${node.id}`] = commitArtifact;
  await manager.cleanup(worktree.path);
}
