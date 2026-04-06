import dotenv from "dotenv";
dotenv.config();

import pg from "pg";
import * as kv from "../server/kv.ts";
import {
  COMMUNITY_MODELS,
  getCommunitySeedUsers,
  getCommunityTagCounts,
  type CommunityModel,
} from "../src/app/data/community-data.ts";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio?schema=public";

const pool = new pg.Pool({ connectionString, max: 5 });

const OWNER_ID = "a1eb2953-9d04-4430-93b7-da956de8889e";
const COMMUNITY_ACTIVITY_ACTIONS = new Set([
  "community_image_uploaded",
  "relief_thumbnail_uploaded",
  "comment_added",
]);

function isCommunityModelId(value: unknown): boolean {
  return typeof value === "string" && /^(c_|cm_)/.test(value);
}

function toDbStatus(status: string): "Draft" | "Published" {
  return status === "draft" ? "Draft" : "Published";
}

function toDbTier(tier: string): "FREE" | "PRO" | "STUDIO_PRO" {
  if (tier === "STUDIO PRO") return "STUDIO_PRO";
  if (tier === "PRO") return "PRO";
  return "FREE";
}

function buildCommunityMeta(model: CommunityModel) {
  return {
    isCommunity: true,
    authorName: model.authorName,
    authorUsername: model.authorUsername,
    authorAvatarUrl: model.authorAvatarUrl ?? null,
    modelType: model.modelType,
    media: model.media,
    reliefConfig: model.reliefConfig ?? null,
    license: "CC-BY-SA-4.0",
    commentCount: 0,
  };
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_model_likes (
      model_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      liked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (model_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_tags (
      name TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      model_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}',
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function resetCommunityTables() {
  await pool.query(`DELETE FROM community_model_likes`);
  await pool.query(`DELETE FROM community_tags`);
  await pool.query(`
    DELETE FROM models
    WHERE id LIKE 'c_%'
       OR id LIKE 'cm_%'
       OR COALESCE((params->'communityMeta'->>'isCommunity')::boolean, false) = true
  `);
}

async function resetKvData() {
  await pool.query(`
    DELETE FROM kv_store
    WHERE key LIKE 'community:model:%'
       OR key LIKE 'community:tag:%'
       OR key LIKE 'community:like:%'
       OR key LIKE 'thumbnail:%'
       OR key LIKE 'community:image:%'
  `);

  const { rows } = await pool.query(
    `SELECT key, value FROM kv_store WHERE key LIKE 'user:%:activity_log'`
  );
  for (const row of rows) {
    const log = Array.isArray(row.value) ? row.value : [];
    const filtered = log.filter((entry: any) => {
      if (COMMUNITY_ACTIVITY_ACTIONS.has(String(entry?.action || ""))) return false;
      if (isCommunityModelId(entry?.modelId)) return false;
      if (isCommunityModelId(entry?.forkedFromId)) return false;
      if (isCommunityModelId(entry?.originalModelId)) return false;
      if (isCommunityModelId(entry?.metadata?.modelId)) return false;
      return true;
    });

    if (filtered.length === 0) {
      await kv.del(row.key);
    } else {
      await kv.set(row.key, filtered);
    }
  }
}

async function seedProfiles() {
  const users = getCommunitySeedUsers("vorea.studio").map((user) => {
    if (user.id === OWNER_ID) {
      return {
        ...user,
        email: "qa.studiopro@vorea.studio",
        tier: "STUDIO PRO",
        role: "user",
      };
    }
    return {
      ...user,
      email: `${user.username.replace(/^@/, "")}@vorea.studio`,
      tier: "FREE",
      role: "user",
    };
  });

  for (const user of users) {
    await pool.query(
      `INSERT INTO users (id, email, "displayName", username, tier, role, "avatarUrl", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         "displayName" = EXCLUDED."displayName",
         username = EXCLUDED.username,
         tier = EXCLUDED.tier,
         role = EXCLUDED.role,
         "avatarUrl" = EXCLUDED."avatarUrl",
         "updatedAt" = NOW()`,
      [
        user.id,
        user.email,
        user.displayName,
        user.username,
        toDbTier((user as any).tier),
        (user as any).role,
        null,
      ]
    );

    await kv.set(`user:${user.id}:profile`, {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      tier: (user as any).tier,
      role: (user as any).role,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const existingUsers = ((await kv.get("users_list")) || []) as any[];
  const byId = new Map<string, any>(existingUsers.map((entry) => [entry.id, entry]));
  for (const user of users) {
    byId.set(user.id, {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      tier: (user as any).tier,
      role: (user as any).role,
    });
  }
  await kv.set("users_list", [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id))));
}

async function seedModels() {
  for (const model of COMMUNITY_MODELS) {
    await pool.query(
      `INSERT INTO models (
        id, "userId", title, "scadSource", status, params, wireframe, likes, downloads,
        "thumbnailUrl", tags, featured, "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        "userId" = EXCLUDED."userId",
        title = EXCLUDED.title,
        "scadSource" = EXCLUDED."scadSource",
        status = EXCLUDED.status,
        params = EXCLUDED.params,
        likes = EXCLUDED.likes,
        downloads = EXCLUDED.downloads,
        "thumbnailUrl" = EXCLUDED."thumbnailUrl",
        tags = EXCLUDED.tags,
        featured = EXCLUDED.featured,
        "updatedAt" = EXCLUDED."updatedAt"`,
      [
        model.id,
        model.authorId,
        model.title,
        model.scadSource || "",
        toDbStatus(model.status),
        JSON.stringify({ communityMeta: buildCommunityMeta(model) }),
        false,
        model.likes,
        model.downloads,
        model.thumbnailUrl,
        model.tags,
        model.featured,
        new Date(model.createdAt),
        new Date(model.updatedAt),
      ]
    );

    await kv.set(`community:model:${model.id}`, {
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
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });

    await kv.set(`community:model:${model.id}:comments`, []);
  }
}

async function seedTags() {
  const tagCounts = getCommunityTagCounts(COMMUNITY_MODELS);
  for (const [tag, count] of tagCounts.entries()) {
    await pool.query(
      `INSERT INTO community_tags (name, slug, model_count, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (name) DO UPDATE SET
         slug = EXCLUDED.slug,
         model_count = EXCLUDED.model_count,
         updated_at = NOW()`,
      [tag, tag, count]
    );
    await kv.set(`community:tag:${tag}`, {
      name: tag,
      slug: tag,
      modelCount: count,
      createdAt: new Date().toISOString(),
    });
  }
}

async function main() {
  console.log("Resetting local community development data...");
  await ensureTables();
  await resetCommunityTables();
  await resetKvData();
  await seedProfiles();
  await seedModels();
  await seedTags();

  console.log(`Seeded ${COMMUNITY_MODELS.length} community models.`);
  console.log("Owner fixture:", OWNER_ID);
  console.log("Published gallery fixture:", "cm_mmwk9htxc096q5");
}

main()
  .catch((error) => {
    console.error("Community reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
