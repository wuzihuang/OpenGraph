import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

export interface OpenDashboardResult {
  opened: boolean;
  method?: string;
  error?: string;
}

interface OpenCandidate {
  method: string;
  command: string;
  args: string[];
}

export async function openDashboard(url: string): Promise<OpenDashboardResult> {
  if (process.env.GRAPH_OPEN_DASHBOARD === "false") {
    return { opened: false, method: "disabled" };
  }

  const candidates = resolveOpenCandidates(url);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      await spawnDetached(candidate.command, candidate.args);
      return { opened: true, method: candidate.method };
    } catch (error) {
      errors.push(
        `${candidate.method}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    opened: false,
    error: errors.join("; ") || "No browser opener available",
  };
}

function resolveOpenCandidates(url: string): OpenCandidate[] {
  const candidates: OpenCandidate[] = [];
  const seen = new Set<string>();

  function addCandidate(candidate: OpenCandidate): void {
    const key = `${candidate.command}\0${candidate.args.join("\0")}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(candidate);
  }

  const browserEnv = process.env.BROWSER?.trim();
  if (browserEnv && !isHeadlessBrowserCommand(browserEnv)) {
    for (const candidate of parseBrowserEnv(browserEnv, url)) {
      addCandidate(candidate);
    }
  }

  if (process.platform === "darwin") {
    addCandidate({ method: "open", command: "open", args: [url] });
    return candidates;
  }

  if (process.platform === "win32") {
    addCandidate({
      method: "cmd",
      command: "cmd",
      args: ["/c", "start", "", url],
    });
    return candidates;
  }

  const omarchyLauncher = findOnPath("omarchy-launch-browser");
  if (omarchyLauncher) {
    addCandidate({
      method: "omarchy-launch-browser",
      command: omarchyLauncher,
      args: [url],
    });
  }

  addCandidate({ method: "xdg-open", command: "xdg-open", args: [url] });
  return candidates;
}

function parseBrowserEnv(browserEnv: string, url: string): OpenCandidate[] {
  if (browserEnv.includes("%s")) {
    const expanded = browserEnv.replaceAll("%s", url);
    const parts = splitCommandLine(expanded);
    if (parts.length === 0) {
      return [];
    }
    return [
      {
        method: "BROWSER",
        command: parts[0]!,
        args: parts.slice(1),
      },
    ];
  }

  const parts = splitCommandLine(browserEnv);
  if (parts.length === 0) {
    return [];
  }
  return [
    {
      method: "BROWSER",
      command: parts[0]!,
      args: [...parts.slice(1), url],
    },
  ];
}

function splitCommandLine(value: string): string[] {
  const matches = value.match(/(?:[^\s"]+|"[^"]*")+/g);
  if (!matches) {
    return [];
  }
  return matches.map(function stripQuotes(part) {
    return part.replaceAll(/^"|"$/g, "");
  });
}

function isHeadlessBrowserCommand(command: string): boolean {
  return /headless|playwright|puppeteer|chrome-headless/i.test(command);
}

function findOnPath(binary: string): string | undefined {
  const pathEnv = process.env.PATH;
  if (!pathEnv) {
    return undefined;
  }

  for (const directory of pathEnv.split(delimiter)) {
    if (!directory) {
      continue;
    }
    const candidate = join(directory, binary);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // keep looking
    }
  }

  return undefined;
}

async function spawnDetached(command: string, args: string[]): Promise<void> {
  await new Promise<void>(function runSpawn(resolve, reject) {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      env: process.env,
    });

    let settled = false;

    child.once("error", function onSpawnError(error) {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });
    child.once("spawn", function onSpawned() {
      if (settled) {
        return;
      }
      settled = true;
      child.unref();
      resolve();
    });
  });
}
