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
      include: [
        "src/app/engine/**",
        "src/app/services/**",
        "src/app/components/**",
        "src/app/pages/**",
        "src/app/data/**",
        "src/app/models/**",
        "src/app/store/**",
        "server/**",
      ],
      exclude: [
        "**/__tests__/**",
        "**/*.test.*",
        "server/seed-*.ts",
        "server/seed-*.cjs",
        "server/create-qa-users.ts",
        "server/drop-news.ts",
        "server/reset-admin-pwd.ts",
        "server/backfill-*.ts",
        "server/list-users.ts",
      ],
      thresholds: {
        lines: 25,
        branches: 20,
        functions: 20,
        statements: 25,
      },
    },
  },
});
