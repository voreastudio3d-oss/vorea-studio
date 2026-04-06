/**
 * Prisma 7 Configuration — Vorea Studio
 *
 * In Prisma 7, connection URLs are configured here instead of in schema.prisma.
 * See: https://pris.ly/d/config-datasource
 */
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),

  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },

  datasource: {
    url: process.env.DATABASE_URL ||
      "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio",
  },
});
