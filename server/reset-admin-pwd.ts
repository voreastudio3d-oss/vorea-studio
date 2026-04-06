import dotenv from "dotenv";
dotenv.config();

import pg from "pg";
import { hashPassword } from "./auth.ts";

const connectionString = process.env.DATABASE_URL || "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio?schema=public";
const pool = new pg.Pool({ connectionString });

async function resetAdminPassword() {
  const email = "vorea.studio3d@gmail.com";
  const newPassword = "OwnerVorea2026!";
  const passwordHash = await hashPassword(newPassword);

  try {
    // Insert or update the 'auth_users' table (since password isn't in Prisma User)
    await pool.query(
      `INSERT INTO auth_users (id, email, password_hash, display_name, username, tier, role)
       VALUES ('u_owner', $2, $1, 'Owner', '@owner', 'STUDIO_PRO', 'superadmin')
       ON CONFLICT (email) DO UPDATE SET password_hash = $1`,
      [passwordHash, email]
    );

    console.log(`✅ Success! Password for ${email} reset to: ${newPassword}`);
  } catch (err) {
    console.error("SQL Error:", err);
  }
  process.exit(0);
}

resetAdminPassword();
