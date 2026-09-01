import { startDaemon } from "./server.ts";
const daemon = await startDaemon({
  port: Number(process.env.GRAPHD_PORT ?? 4317),
  ...(process.env.GRAPH_ENGINEER_HOME
    ? { dataDir: process.env.GRAPH_ENGINEER_HOME }
    : {}),
});
console.log(`graphd listening at ${daemon.url}`);
console.log(`Dashboard: ${daemon.url}/?token=${daemon.token}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await daemon.app.close();
    daemon.store.close();
    process.exit(0);
  });
