import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

let prismaSingleton: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (prismaSingleton) {
    return prismaSingleton;
  }

  const connectionString = process.env.DATABASE_URL || "";
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  prismaSingleton = new PrismaClient({ adapter });
  return prismaSingleton;
}
