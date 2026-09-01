import { Command } from "commander";
import type { CliContext } from "../context.ts";
import { runDemo } from "../handlers/demo.ts";
import {
  initializeState,
  inspectEnvironment,
  listAgents,
} from "../handlers/environment.ts";
import {
  approveGraph,
  listGraphs,
  planGraph,
  showGraph,
} from "../handlers/graphs.ts";
import { printDashboardUrl } from "../handlers/open.ts";
import { cancelRun, resumeRun, showRun } from "../handlers/runs.ts";
import type { DemoOptions } from "../types.ts";

export function createProgram(context: CliContext): Command {
  const program = new Command()
    .name("graphctl")
    .description("Local Graph Engineering compiler and runtime")
    .version("0.1.0");

  registerEnvironmentCommands(program, context);
  registerGraphCommands(program, context);
  registerRunCommands(program, context);
  registerUtilityCommands(program, context);

  return program;
}

function registerEnvironmentCommands(
  program: Command,
  context: CliContext,
): void {
  program
    .command("init")
    .description("Initialize local Graph Engineer state")
    .action(initializeState.bind(null, context));
  program
    .command("doctor")
    .description("Inspect repository, daemon, and available agents")
    .action(inspectEnvironment.bind(null, context));
  program.command("agents").action(listAgents);
}

function registerGraphCommands(program: Command, context: CliContext): void {
  program
    .command("plan")
    .argument("<goal>")
    .action(planGraph.bind(null, context));
  program.command("graphs").action(listGraphs.bind(null, context));

  const graph = program.command("graph");
  graph
    .command("show")
    .argument("<graph-id>")
    .action(showGraph.bind(null, context));
  graph
    .command("approve")
    .argument("<graph-id>")
    .action(approveGraph.bind(null, context));
}

function registerRunCommands(program: Command, context: CliContext): void {
  const run = program.command("run");
  run.command("show").argument("<run-id>").action(showRun.bind(null, context));
  run
    .command("cancel")
    .argument("<run-id>")
    .action(cancelRun.bind(null, context));
  run
    .command("resume")
    .argument("<run-id>")
    .action(resumeRun.bind(null, context));
}

function registerUtilityCommands(program: Command, context: CliContext): void {
  program.command("open").action(printDashboardUrl.bind(null, context));
  program
    .command("demo")
    .option("--approve", "approve the draft through the explicit CLI boundary")
    .option("--wait", "wait for completion and print the report")
    .action(
      runDemo.bind(null, context) as (options: DemoOptions) => Promise<void>,
    );
}
