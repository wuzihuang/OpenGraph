import { z } from "zod";

export const ArtifactContract = z.object({
  name: z.string().min(1),
  type: z.enum([
    "json",
    "text",
    "git_patch",
    "test_report",
    "diff",
    "directory",
  ]),
  schema: z.record(z.string(), z.unknown()).optional(),
});

export const AcceptanceCheck = z.object({
  type: z.enum(["command", "artifact", "schema", "human"]),
  command: z.string().optional(),
  description: z.string().min(1),
  /** Workers must not weaken or rewrite frozen checks; amend via a new graph version. */
  frozen: z.boolean().default(true),
});
