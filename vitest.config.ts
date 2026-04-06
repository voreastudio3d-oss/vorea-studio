import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    testTimeout: 30000,
    hookTimeout: 30000,
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "server/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["node_modules", "dist", "supabase"],
    setupFiles: ["./src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/app/engine/**", "src/app/services/**"],
      exclude: ["**/__tests__/**", "**/*.test.*"],
    },
  },
});
