import dotenv from "dotenv";
dotenv.config();

import { createUser, getUserByEmail, updateUser, hashPassword } from "./auth.ts";
import * as kv from "./kv.ts";

async function setupQaUsers() {
  console.log("🛠️ Setting up QA Users...");

  const qaUsers = [
    {
      email: "qa.free@vorea.studio",
      password: "VoreaQA2026!",
      displayName: "QA Free",
      username: "@qa_free",
      tier: "FREE"
    },
    {
      email: "qa.pro@vorea.studio",
      password: "VoreaQA2026!",
      displayName: "QA Pro",
      username: "@qa_pro",
      tier: "PRO"
    },
    {
      email: "qa.studiopro@vorea.studio",
      password: "VoreaQA2026!",
      displayName: "QA Studio Pro",
      username: "@qa_studiopro",
      tier: "STUDIO_PRO"
    }
  ];

  for (const qa of qaUsers) {
    let authUser = await getUserByEmail(qa.email);
    if (!authUser) {
      console.log(`Creating ${qa.email}...`);
      authUser = await createUser(qa.email, qa.password, {
        displayName: qa.displayName,
        username: qa.username,
        tier: qa.tier,
        role: "user"
      });
    } else {
      console.log(`Updating ${qa.email}...`);
      const passwordHash = await hashPassword(qa.password);
      await updateUser(authUser.id, {
        tier: qa.tier,
        password_hash: passwordHash
      });
      authUser.tier = qa.tier; // for kv setup below
    }

    // Set profile in KV
    const profile = {
      id: authUser.id,
      displayName: qa.displayName,
      username: qa.username,
      email: qa.email,
      tier: qa.tier,
      createdAt: authUser.created_at || new Date().toISOString(),
    };
    await kv.set(`user:${authUser.id}:profile`, profile);

    // Set credits in KV
    await kv.set(`user:${authUser.id}:credits`, {
      freeUsed: 0,
      purchasedCredits: 0,
      totalExported: 0,
    });

    console.log(`✅ Ready: ${qa.email} (Tier: ${qa.tier}) (Pass: ${qa.password})`);
  }

  console.log("🎉 All QA users are ready!");
  process.exit(0);
}

setupQaUsers().catch(e => {
  console.error(e);
  process.exit(1);
});
