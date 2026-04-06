import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL || "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio?schema=public";
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function listUsers() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true }});
  console.log("Users in DB:", users);
  process.exit(0);
}

listUsers().catch(e => {
  console.error(e);
  process.exit(1);
});
