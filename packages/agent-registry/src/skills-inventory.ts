import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, relative } from "node:path";

export type SkillRef = {
  name: string;
  /** One-line description from SKILL.md frontmatter (truncated). */
  description: string;
  /** Path relative to home. */
  relPath: string;
};

/** Skill roots under $HOME for each candidate agent id. */
const SKILL_ROOTS_BY_AGENT: Record<string, string[]> = {
  cursor: [".cursor/skills", ".agents/skills"],
  claude: [".claude/skills", ".agents/skills"],
  codex: [".codex/skills", ".agents/skills"],
  kimi: [".kimi/skills", ".agents/skills"],
  gemini: [".gemini/skills", ".agents/skills"],
  qwen: [".qwen/skills", ".agents/skills"],
  openclaw: [".openclaw/skills", ".agents/skills"],
  hermes: [".hermes/skills"],
  qoder: [".qoder/skills", ".agents/skills"],
  zcode: [".zcode/skills", ".agents/skills"],
};

const MAX_SKILL_DEPTH = 4;
const MAX_DESCRIPTION_CHARS = 160;
const MAX_SKILLS_PER_AGENT = 48;

function truncateDescription(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MAX_DESCRIPTION_CHARS) {
    return collapsed;
  }
  return `${collapsed.slice(0, MAX_DESCRIPTION_CHARS - 1)}…`;
}

function parseFrontmatterField(raw: string, field: string): string | null {
  const blockMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!blockMatch?.[1]) {
    return null;
  }

  const lines = blockMatch[1].split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const currentLine = lines[index];
    if (currentLine === undefined) {
      continue;
    }
    const header = currentLine.match(new RegExp(`^${field}:\\s*(.*)$`));
    if (!header) {
      continue;
    }

    const value = (header[1] ?? "").trim();
    if (/^[>|][-+]?$/.test(value)) {
      const parts: string[] = [];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const line = lines[cursor];
        if (line === undefined) {
          break;
        }
        if (/^[A-Za-z0-9_-]+:\s*/.test(line)) {
          break;
        }
        if (/^[ \t]+/.test(line)) {
          parts.push(line.replace(/^[ \t]+/, ""));
          continue;
        }
        if (line.trim() === "") {
          break;
        }
        break;
      }
      return truncateDescription(parts.join(" "));
    }

    if (value.length > 0) {
      return truncateDescription(value.replace(/^["']|["']$/g, ""));
    }
  }

  return null;
}

function skillNameFromPath(skillFile: string, frontmatterName: string | null): string {
  if (frontmatterName && frontmatterName.length > 0) {
    return frontmatterName;
  }
  const parts = skillFile.split(/[/\\]/);
  const skillDir = parts.length >= 2 ? parts[parts.length - 2] : undefined;
  return skillDir && skillDir.length > 0 ? skillDir : "skill";
}

async function listSkillMarkdownFiles(
  root: string,
  depth: number,
): Promise<string[]> {
  if (depth > MAX_SKILL_DEPTH) {
    return [];
  }

  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const absolute = join(root, entry.name);
    if (entry.isDirectory() || entry.isSymbolicLink()) {
      files.push(...(await listSkillMarkdownFiles(absolute, depth + 1)));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase() === "skill.md") {
      files.push(absolute);
    }
  }
  return files;
}

export async function listSkillsForAgent(
  agentId: string,
  homeDir: string = homedir(),
): Promise<SkillRef[]> {
  const roots = SKILL_ROOTS_BY_AGENT[agentId] ?? [];
  const seen = new Set<string>();
  const skills: SkillRef[] = [];

  for (const relRoot of roots) {
    const absoluteRoot = join(homeDir, relRoot);
    const skillFiles = await listSkillMarkdownFiles(absoluteRoot, 0);
    for (const skillFile of skillFiles) {
      let raw: string;
      try {
        raw = await readFile(skillFile, "utf8");
      } catch {
        continue;
      }

      const name = skillNameFromPath(
        skillFile,
        parseFrontmatterField(raw, "name"),
      );
      const key = name.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      skills.push({
        name,
        description:
          parseFrontmatterField(raw, "description") ??
          "Agent skill (no description in frontmatter).",
        relPath: relative(homeDir, skillFile).split("\\").join("/"),
      });

      if (skills.length >= MAX_SKILLS_PER_AGENT) {
        return skills.sort((left, right) => left.name.localeCompare(right.name));
      }
    }
  }

  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

export function capabilitiesFromSkill(skillName: string): string[] {
  const normalized = skillName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!normalized) {
    return [];
  }
  return [`skill:${normalized}`];
}

export function knownSkillAgentIds(): string[] {
  return Object.keys(SKILL_ROOTS_BY_AGENT).sort();
}
