// Unit tests for the pure modules (Node environment, no DOM). Kept apart from vite.config.ts so
// tests don't load the dev-server API plugin.
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify("test") },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
