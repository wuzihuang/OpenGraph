import { defineConfig } from '@playwright/test';

const port = 14_317;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 20_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    launchOptions: { executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] },
  },
  webServer: {
    command:
      `npx pnpm@10.15.0 --filter @graph-engineer/web build && ` +
      `env -u GRAPH_PLUGIN_ROOT GRAPHD_PORT=${port} GRAPH_ENGINEER_HOME=.graph-engineer-e2e ` +
      `node_modules/.bin/tsx apps/daemon/src/index.ts`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  reporter: 'list',
});
