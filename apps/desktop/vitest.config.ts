import { defineConfig } from "vitest/config";

// Unit tests live next to the code in src/. The Playwright specs in e2e/ are run by `test:e2e`, not here.
export default defineConfig({ test: { include: ["src/**/*.test.ts"], environment: "node" } });
