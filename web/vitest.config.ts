import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Unit tier. Pure-logic tests live next to the code as *.test.ts. Playwright
// owns *.spec.ts under e2e/ (integration/E2E) — kept separate so the two runners
// never pick up each other's files.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
