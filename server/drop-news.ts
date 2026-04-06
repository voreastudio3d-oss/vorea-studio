import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";

dotenv.config();
const connectionString = process.env.DATABASE_URL || "";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "news_articles" CASCADE;`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "news_ingestion_runs" CASCADE;`);
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "news_sources" CASCADE;`);
  console.log("Tables dropped successfully");
}

main().catch(console.error).finally(() => process.exit(0));
