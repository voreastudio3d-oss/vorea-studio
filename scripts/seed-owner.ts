/**
 * Seed script — creates/resets the owner account in auth_users table.
 * Run once after the Phase B auth migration to bootstrap the owner.
 *
 * Usage: npx tsx --env-file=.env scripts/seed-owner.ts
 */

import * as auth from "../server/auth.ts";
import * as kv from "../server/kv.ts";

const OWNER_EMAIL = process.env.VITE_OWNER_EMAIL || "vorea.studio3d@gmail.com";

// Prompt for password
const readline = await import("node:readline");
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const password = await new Promise<string>((resolve) => {
  rl.question(`Enter password for ${OWNER_EMAIL} (min 8 chars, 1 uppercase, 1 number, 1 special): `, (ans) => {
    rl.close();
    resolve(ans.trim());
  });
});

if (!password || password.length < 8) {
  console.error("Password too short. Aborting.");
  process.exit(1);
}

console.log(`\n🔧 Seeding owner account for: ${OWNER_EMAIL}`);

// Check if owner exists
const existing = await auth.getUserByEmail(OWNER_EMAIL);

if (existing) {
  console.log("✓ Owner account found — resetting password...");
  const hash = await auth.hashPassword(password);
  await auth.updateUser(existing.id, { password_hash: hash, role: "superadmin", tier: "STUDIO_PRO" });
  
  // Ensure KV profile is in sync
  const profile = await kv.get(`user:${existing.id}:profile`);
  if (profile) {
    profile.role = "superadmin";
    profile.tier = "STUDIO PRO";
    await kv.set(`user:${existing.id}:profile`, profile);
  }
  
  console.log(`✅ Password updated for: ${existing.id}`);
  console.log(`✅ Role: superadmin`);
  
  // Issue a fresh JWT
  const token = auth.signJwt(existing.id, existing.email, "superadmin");
  console.log(`\n🔑 Fresh JWT token (paste in browser localStorage):`);
  console.log(`localStorage.setItem('vorea_token', '${token}')`);
} else {
  console.log("✓ Owner account not found — creating...");
  const newOwner = await auth.createUser(OWNER_EMAIL, password, {
    displayName: "Vorea Studio Owner",
    username: "@vorea-owner",
    tier: "STUDIO_PRO",
    role: "superadmin",
  });
  
  // Create KV profile
  const profile = {
    id: newOwner.id,
    displayName: "Vorea Studio Owner",
    username: "@vorea-owner",
    email: OWNER_EMAIL,
    tier: "STUDIO PRO",
    role: "superadmin",
    createdAt: newOwner.created_at,
  };
  await kv.set(`user:${newOwner.id}:profile`, profile);
  await kv.set(`user:${newOwner.id}:credits`, { freeUsed: 0, purchasedCredits: 0, totalExported: 0 });
  
  const token = auth.signJwt(newOwner.id, newOwner.email, "superadmin");
  console.log(`✅ Owner account created: ${newOwner.id}`);
  console.log(`✅ Email: ${newOwner.email}`);
  console.log(`✅ Role: superadmin`);
  console.log(`\n🔑 JWT token for immediate use (paste in browser console):`);
  console.log(`localStorage.setItem('vorea_token', '${token}')`);
  console.log(`\nThen reload the page.`);
}

process.exit(0);
