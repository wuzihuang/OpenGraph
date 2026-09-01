import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { safeEnvironment } from "../../acp-client/src/index.ts";

const RULE_FILE_NAMES = ["AGENTS.md", "CLAUDE.md"] as const;
const MAX_RULE_FILE_LENGTH = 8_000;

type JsonObject = Record<string, unknown>;

export type RepositoryInspection = {
  root: string;
  git: {
    available: boolean;
    status: string;
    dirty: boolean;
  };
  packageManager: unknown;
  scripts: unknown;
  rules: string[];
};

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readPackageJson(root: string): Promise<JsonObject | null> {
  try {
    const contents = await readFile(join(root, "package.json"), "utf8");
    const parsed: unknown = JSON.parse(contents);
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readRepositoryRules(root: string): Promise<string[]> {
  const rules: string[] = [];

  for (const fileName of RULE_FILE_NAMES) {
    try {
      const contents = await readFile(join(root, fileName), "utf8");
      rules.push(`${fileName}:\n${contents.slice(0, MAX_RULE_FILE_LENGTH)}`);
    } catch {
      // A repository rule file is optional.
    }
  }

  return rules;
}

export async function inspectRepository(
  root: string,
): Promise<RepositoryInspection> {
  const gitResult = await execa("git", ["status", "--short", "--branch"], {
    cwd: root,
    env: safeEnvironment(),
    reject: false,
  });
  const packageJson = await readPackageJson(root);
  const rules = await readRepositoryRules(root);

  return {
    root,
    git: {
      available: gitResult.exitCode === 0,
      status: gitResult.stdout,
      dirty: gitResult.stdout.split("\n").slice(1).some(Boolean),
    },
    packageManager: packageJson?.packageManager ?? null,
    scripts: packageJson?.scripts ?? {},
    rules,
  };
}
