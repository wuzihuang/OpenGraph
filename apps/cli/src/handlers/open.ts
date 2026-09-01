import type { CliContext } from "../context.ts";

export function printDashboardUrl(context: CliContext): void {
  console.log(`${context.baseUrl}/?token=${context.token()}`);
}
