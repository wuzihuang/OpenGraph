#!/usr/bin/env node
import { createProgram } from "./commands/register-commands.ts";
import { createCliContext } from "./context.ts";

const program = createProgram(createCliContext());
await program.parseAsync();
