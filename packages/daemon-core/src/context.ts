import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

export function resolveProjectRoot(): string {
  if (process.env.GRAPH_PLUGIN_ROOT) {
    return process.cwd();
  }

  return resolve(moduleDirectory, "../../..");
}

export function resolveRuntimeDirectory(): string {
  if (process.env.GRAPH_PLUGIN_ROOT) {
    return join(process.env.GRAPH_PLUGIN_ROOT, "runtime");
  }

  return moduleDirectory;
}
