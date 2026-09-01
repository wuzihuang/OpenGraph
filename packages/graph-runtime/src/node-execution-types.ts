import type { GraphNode } from "../../contracts/src/index.ts";
import type { WorktreeManager } from "../../worktree-manager/src/index.ts";
import type { GraphExecutionContext } from "./types.ts";

export type Worktree = Awaited<ReturnType<WorktreeManager["create"]>>;

export interface NodeExecutionContext extends GraphExecutionContext {
  node: GraphNode;
}
