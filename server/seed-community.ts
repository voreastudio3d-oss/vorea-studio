/**
 * Seed Community Models — Populates KV store from shared community-data.ts
 *
 * Run with: npx tsx server/seed-community.ts
 */

import * as kv from "./kv.js";
import {
  COMMUNITY_MODELS,
  getCommunitySeedUsers,
  getCommunityTagCounts,
} from "../src/app/data/community-data.ts";

async function seed() {
  console.log("🌱 Seeding community models...");
  const now = new Date().toISOString();

  for (const model of COMMUNITY_MODELS) {
    const doc = {
      id: model.id,
      title: model.title,
      authorId: model.authorId,
      authorName: model.authorName,
      authorUsername: model.authorUsername,
      authorAvatarUrl: model.authorAvatarUrl ?? null,
      scadSource: model.scadSource || "",
      modelType: model.modelType,
      reliefConfig: model.reliefConfig ?? null,
      tags: model.tags,
      thumbnailUrl: model.thumbnailUrl,
      media: model.media,
      likes: model.likes,
      downloads: model.downloads,
      featured: model.featured,
      status: model.status,
      createdAt: model.createdAt || now,
      updatedAt: model.updatedAt || now,
    };

    await kv.set(`community:model:${model.id}`, doc);
    console.log(`  ✅ ${model.title}`);
  }

  // Seed tags
  console.log("\n🏷️  Seeding tags...");
  const tagCounts = getCommunityTagCounts(COMMUNITY_MODELS);
  for (const [tag, count] of tagCounts) {
    await kv.set(`community:tag:${tag}`, {
      name: tag,
      slug: tag,
      modelCount: count,
      createdAt: now,
    });
    console.log(`  ✅ ${tag} (${count} models)`);
  }

  // Seed demo user profiles (so public profile links work)
  console.log("\n👤 Seeding demo user profiles...");
  const demoUsers = getCommunitySeedUsers("demo.vorea.studio");

  for (const user of demoUsers) {
    await kv.set(`user:${user.id}:profile`, {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      tier: "FREE",
      createdAt: now,
    });
    console.log(`  ✅ ${user.displayName}`);
  }

  console.log(`\n✨ Seed complete: ${COMMUNITY_MODELS.length} models, ${tagCounts.size} tags, ${demoUsers.length} users`);
  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
