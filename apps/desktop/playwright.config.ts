import { defineConfig } from "@playwright/test";

/** End-to-end tests run against the browser build, the test backend (real API, fake Riot, port 8788) and the League client simulator. Data Dragon is faked (see e2e/helpers.ts). */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: 1, // the League client simulator is shared state
  use: { baseURL: "http://localhost:1420", viewport: { width: 1280, height: 900 }, trace: "retain-on-failure" },
  webServer: [
    { command: "pnpm dev", cwd: "../..", url: "http://localhost:1420", reuseExistingServer: true, timeout: 60_000 },
    { command: "pnpm lcu-mock", cwd: "../..", url: "http://127.0.0.1:8765/lol-gameflow/v1/gameflow-phase", reuseExistingServer: true, timeout: 60_000 },
    { command: "pnpm --filter @apex/api exec tsx src/fake-server.ts", cwd: "../..", url: "http://127.0.0.1:8788/health", reuseExistingServer: true, timeout: 60_000 },
  ],
});
