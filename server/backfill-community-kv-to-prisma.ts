/**
 * Backfill Community KV -> Prisma
 *
 * Usage:
 *   npx tsx server/backfill-community-kv-to-prisma.ts --dry-run
 *   npx tsx server/backfill-community-kv-to-prisma.ts --apply
 *
 * Defaults to --dry-run when no flag is provided.
 */

import "dotenv/config";
import pg from "pg";

type KvRow = { key: string; value: any };

type NormalizedUser = {
  id: string;
  email: string;
  displayName: string;
  username: string;
  tier: "FREE" | "PRO" | "STUDIO_PRO";
  role: "user" | "admin" | "superadmin";
  avatarUrl: string | null;
  createdAt: Date;
};

type NormalizedModel = {
  id: string;
  userId: string;
  title: string;
  scadSource: string;
  status: "Draft" | "Published" | "Archived";
  params: Record<string, unknown>;
  wireframe: boolean;
  likes: number;
  downloads: number;
  thumbnailUrl: string | null;
  tags: string[];
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type NormalizedTag = {
  name: string;
  slug: string;
  modelCount: number;
  createdAt: Date;
};

type NormalizedLike = {
  modelId: string;
  userId: string;
  at: Date;
};

type BackfillStats = {
  kvModels: string[];
  prismaModels: string[];
  kvTags: string[];
  prismaTags: string[];
  kvLikes: string[];
  prismaLikes: string[];
};

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio?schema=public";

const args = new Set(process.argv.slice(2));
const applyMode = args.has("--apply");
const dryRunMode = args.has("--dry-run") || !applyMode;

function sanitizeId(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "user";
}

function syntheticEmail(id: string): string {
  return `${sanitizeId(id)}@community.local`;
}

function normalizeTier(input: any): "FREE" | "PRO" | "STUDIO_PRO" {
  const raw = String(input || "FREE").trim().toUpperCase().replace(/\s+/g, "_");
  if (raw === "PRO") return "PRO";
  if (raw === "STUDIO_PRO") return "STUDIO_PRO";
  return "FREE";
}

function normalizeRole(input: any): "user" | "admin" | "superadmin" {
  const raw = String(input || "user").trim().toLowerCase();
  if (raw === "admin") return "admin";
  if (raw === "superadmin") return "superadmin";
  return "user";
}

function normalizeStatus(input: any): "Draft" | "Published" | "Archived" {
  const raw = String(input || "published").trim().toLowerCase();
  if (raw === "draft") return "Draft";
  if (raw === "archived") return "Archived";
  return "Published";
}

function normalizeUsername(input: any, userId: string): string {
  const baseRaw = String(input || "").trim();
  const fallback = `@${sanitizeId(userId).slice(0, 24)}`;
  if (!baseRaw) return fallback;
  const withAt = baseRaw.startsWith("@") ? baseRaw : `@${baseRaw}`;
  const normalized = withAt.replace(/\s+/g, "_").replace(/[^@a-zA-Z0-9._-]/g, "");
  return normalized.length > 1 ? normalized : fallback;
}

function toValidDate(input: any, fallback: Date): Date {
  if (!input) return fallback;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function toInt(input: any, fallback = 0): number {
  const n = Number(input);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function uniqueLowercase(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const n = v.toLowerCase().trim();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function setDiff(a: string[], b: string[]): string[] {
  const bSet = new Set(b);
  return a.filter((x) => !bSet.has(x));
}

async function ensureCommunityTables(client: pg.Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS community_model_likes (
      model_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      liked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (model_id, user_id)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS community_tags (
      name TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      model_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function loadKvRows(client: pg.Client): Promise<{
  models: KvRow[];
  tags: KvRow[];
  likes: KvRow[];
  profiles: KvRow[];
}> {
  const models = await client.query(
    `SELECT key, value FROM kv_store WHERE key LIKE 'community:model:%' ORDER BY key`
  );
  const tags = await client.query(
    `SELECT key, value FROM kv_store WHERE key LIKE 'community:tag:%' ORDER BY key`
  );
  const likes = await client.query(
    `SELECT key, value FROM kv_store WHERE key LIKE 'community:like:%' ORDER BY key`
  );
  const profiles = await client.query(
    `SELECT key, value FROM kv_store WHERE key LIKE 'user:%:profile' ORDER BY key`
  );

  return {
    models: models.rows as KvRow[],
    tags: tags.rows as KvRow[],
    likes: likes.rows as KvRow[],
    profiles: profiles.rows as KvRow[],
  };
}

async function loadExistingUsers(
  client: pg.Client
): Promise<{
  emailOwner: Map<string, string>;
  usernameOwner: Map<string, string>;
}> {
  const users = await client.query(`SELECT id, email, username FROM users`);
  const emailOwner = new Map<string, string>();
  const usernameOwner = new Map<string, string>();
  for (const row of users.rows) {
    if (row.email) emailOwner.set(String(row.email).toLowerCase(), String(row.id));
    if (row.username) usernameOwner.set(String(row.username), String(row.id));
  }
  return { emailOwner, usernameOwner };
}

function normalizeUsers(
  kvModels: KvRow[],
  kvProfiles: KvRow[],
  ownership: { emailOwner: Map<string, string>; usernameOwner: Map<string, string> },
  warnings: string[]
): NormalizedUser[] {
  const profileById = new Map<string, any>();
  for (const p of kvProfiles) {
    const v = p.value || {};
    if (v.id) profileById.set(String(v.id), v);
  }

  const firstModelByAuthor = new Map<string, any>();
  for (const row of kvModels) {
    const v = row.value || {};
    const authorId = v.authorId ? String(v.authorId) : "";
    if (!authorId || firstModelByAuthor.has(authorId)) continue;
    firstModelByAuthor.set(authorId, v);
  }

  const authorIds = [...firstModelByAuthor.keys()].sort();
  const users: NormalizedUser[] = [];

  for (const authorId of authorIds) {
    const profile = profileById.get(authorId) || {};
    const modelFallback = firstModelByAuthor.get(authorId) || {};

    const displayName = String(
      profile.displayName || modelFallback.authorName || "Usuario"
    ).trim();

    let email = String(
      profile.email || syntheticEmail(authorId)
    ).trim().toLowerCase();
    const emailTakenBy = ownership.emailOwner.get(email);
    if (emailTakenBy && emailTakenBy !== authorId) {
      const replacement = syntheticEmail(authorId);
      warnings.push(
        `Email collision for author "${authorId}": "${email}" belongs to "${emailTakenBy}". Using "${replacement}".`
      );
      email = replacement;
    }
    ownership.emailOwner.set(email, authorId);

    let username = normalizeUsername(
      profile.username || modelFallback.authorUsername,
      authorId
    );
    const usernameTakenBy = ownership.usernameOwner.get(username);
    if (usernameTakenBy && usernameTakenBy !== authorId) {
      const replacement = `@${sanitizeId(authorId).slice(0, 20)}_${sanitizeId(authorId).slice(-4)}`;
      warnings.push(
        `Username collision for author "${authorId}": "${username}" belongs to "${usernameTakenBy}". Using "${replacement}".`
      );
      username = replacement;
    }
    ownership.usernameOwner.set(username, authorId);

    const createdAt = toValidDate(profile.createdAt, new Date());
    users.push({
      id: authorId,
      email,
      displayName: displayName || "Usuario",
      username,
      tier: normalizeTier(profile.tier),
      role: normalizeRole(profile.role),
      avatarUrl: profile.avatarUrl ? String(profile.avatarUrl) : null,
      createdAt,
    });
  }

  return users;
}

function normalizeModels(kvModels: KvRow[], warnings: string[]): NormalizedModel[] {
  const coreFields = new Set([
    "id",
    "title",
    "authorId",
    "authorName",
    "authorUsername",
    "authorAvatarUrl",
    "scadSource",
    "tags",
    "thumbnailUrl",
    "likes",
    "downloads",
    "featured",
    "status",
    "createdAt",
    "updatedAt",
  ]);

  const out: NormalizedModel[] = [];
  for (const row of kvModels) {
    const keyId = row.key.replace("community:model:", "");
    const v = row.value || {};
    const id = String(v.id || keyId).trim();
    const userId = String(v.authorId || "").trim();
    if (!id || !userId) {
      warnings.push(`Skipping invalid model row "${row.key}" (missing id or authorId).`);
      continue;
    }

    const now = new Date();
    const createdAt = toValidDate(v.createdAt, now);
    const updatedAt = toValidDate(v.updatedAt, createdAt);
    const tags = Array.isArray(v.tags)
      ? uniqueLowercase(v.tags.map((t: any) => String(t || "")))
      : [];

    const extra: Record<string, unknown> = {};
    for (const [k, value] of Object.entries(v)) {
      if (!coreFields.has(k)) extra[k] = value;
    }
    extra.isCommunity = true;

    out.push({
      id,
      userId,
      title: String(v.title || "Untitled"),
      scadSource: String(v.scadSource || ""),
      status: normalizeStatus(v.status),
      params: { communityMeta: extra },
      wireframe: false,
      likes: Math.max(0, toInt(v.likes)),
      downloads: Math.max(0, toInt(v.downloads)),
      thumbnailUrl: v.thumbnailUrl ? String(v.thumbnailUrl) : null,
      tags,
      featured: Boolean(v.featured),
      createdAt,
      updatedAt,
    });
  }
  return out;
}

function normalizeTags(kvTags: KvRow[]): NormalizedTag[] {
  const out: NormalizedTag[] = [];
  for (const row of kvTags) {
    const keyName = row.key.replace("community:tag:", "").toLowerCase();
    const v = row.value || {};
    const name = String(v.name || keyName).toLowerCase().trim();
    if (!name) continue;
    out.push({
      name,
      slug: String(v.slug || name).toLowerCase().trim() || name,
      modelCount: Math.max(0, toInt(v.modelCount)),
      createdAt: toValidDate(v.createdAt, new Date()),
    });
  }
  return out;
}

function normalizeLikes(kvLikes: KvRow[], warnings: string[]): NormalizedLike[] {
  const out: NormalizedLike[] = [];
  const seen = new Set<string>();

  for (const row of kvLikes) {
    const parts = row.key.split(":");
    const keyModelId = parts.length >= 4 ? parts[2] : "";
    const keyUserId = parts.length >= 4 ? parts[3] : "";
    const v = row.value || {};
    const modelId = String(v.modelId || keyModelId).trim();
    const userId = String(v.userId || keyUserId).trim();
    if (!modelId || !userId) {
      warnings.push(`Skipping invalid like row "${row.key}" (missing modelId/userId).`);
      continue;
    }
    const key = `${modelId}::${userId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      modelId,
      userId,
      at: toValidDate(v.at, new Date()),
    });
  }

  return out;
}

async function upsertUsers(client: pg.Client, users: NormalizedUser[]): Promise<number> {
  let count = 0;
  for (const u of users) {
    await client.query(
      `INSERT INTO users (id, email, "displayName", username, tier, role, "avatarUrl", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::"MembershipTier", $6::"UserRole", $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         "displayName" = EXCLUDED."displayName",
         username = EXCLUDED.username,
         tier = EXCLUDED.tier,
         role = EXCLUDED.role,
         "avatarUrl" = COALESCE(EXCLUDED."avatarUrl", users."avatarUrl"),
         "updatedAt" = NOW()`,
      [u.id, u.email, u.displayName, u.username, u.tier, u.role, u.avatarUrl, u.createdAt]
    );
    count++;
  }
  return count;
}

async function upsertModels(client: pg.Client, models: NormalizedModel[]): Promise<number> {
  let count = 0;
  for (const m of models) {
    await client.query(
      `INSERT INTO models (
         id, "userId", title, "scadSource", status, params, wireframe, likes, downloads,
         "thumbnailUrl", tags, featured, "createdAt", "updatedAt"
       )
       VALUES (
         $1, $2, $3, $4, $5::"ModelStatus", $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14
       )
       ON CONFLICT (id) DO UPDATE SET
         "userId" = EXCLUDED."userId",
         title = EXCLUDED.title,
         "scadSource" = EXCLUDED."scadSource",
         status = EXCLUDED.status,
         params = EXCLUDED.params,
         wireframe = EXCLUDED.wireframe,
         likes = EXCLUDED.likes,
         downloads = EXCLUDED.downloads,
         "thumbnailUrl" = EXCLUDED."thumbnailUrl",
         tags = EXCLUDED.tags,
         featured = EXCLUDED.featured,
         "updatedAt" = EXCLUDED."updatedAt"`,
      [
        m.id,
        m.userId,
        m.title,
        m.scadSource,
        m.status,
        JSON.stringify(m.params),
        m.wireframe,
        m.likes,
        m.downloads,
        m.thumbnailUrl,
        m.tags,
        m.featured,
        m.createdAt,
        m.updatedAt,
      ]
    );
    count++;
  }
  return count;
}

async function upsertTags(client: pg.Client, tags: NormalizedTag[]): Promise<number> {
  let count = 0;
  for (const t of tags) {
    await client.query(
      `INSERT INTO community_tags (name, slug, model_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (name) DO UPDATE SET
         slug = EXCLUDED.slug,
         model_count = EXCLUDED.model_count,
         updated_at = NOW()`,
      [t.name, t.slug, t.modelCount, t.createdAt]
    );
    count++;
  }
  return count;
}

async function upsertLikes(client: pg.Client, likes: NormalizedLike[]): Promise<number> {
  let count = 0;
  for (const like of likes) {
    await client.query(
      `INSERT INTO community_model_likes (model_id, user_id, liked_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (model_id, user_id) DO UPDATE SET liked_at = EXCLUDED.liked_at`,
      [like.modelId, like.userId, like.at]
    );
    count++;
  }
  return count;
}

async function collectStats(client: pg.Client): Promise<BackfillStats> {
  const kvModels = await client.query(
    `SELECT key FROM kv_store WHERE key LIKE 'community:model:%' ORDER BY key`
  );
  const prismaModels = await client.query(`
      SELECT id
      FROM models
      WHERE id LIKE 'c_%'
         OR id LIKE 'cm_%'
         OR COALESCE((params->'communityMeta'->>'isCommunity')::boolean, false) = true
      ORDER BY id
    `);
  const kvTags = await client.query(
    `SELECT key FROM kv_store WHERE key LIKE 'community:tag:%' ORDER BY key`
  );
  const prismaTags = await client.query(`SELECT name FROM community_tags ORDER BY name`);
  const kvLikes = await client.query(
    `SELECT key FROM kv_store WHERE key LIKE 'community:like:%' ORDER BY key`
  );
  const prismaLikes = await client.query(
    `SELECT model_id, user_id FROM community_model_likes ORDER BY model_id, user_id`
  );

  return {
    kvModels: kvModels.rows.map((r: any) => String(r.key).replace("community:model:", "")),
    prismaModels: prismaModels.rows.map((r: any) => String(r.id)),
    kvTags: kvTags.rows.map((r: any) => String(r.key).replace("community:tag:", "")),
    prismaTags: prismaTags.rows.map((r: any) => String(r.name)),
    kvLikes: kvLikes.rows.map((r: any) => {
      const p = String(r.key).split(":");
      return p.length >= 4 ? `${p[2]}::${p[3]}` : String(r.key);
    }),
    prismaLikes: prismaLikes.rows.map((r: any) => `${r.model_id}::${r.user_id}`),
  };
}

function printReport(
  label: string,
  stats: BackfillStats,
  warnings: string[],
  actions?: { users: number; models: number; tags: number; likes: number }
): void {
  const modelMissingInPrisma = setDiff(stats.kvModels, stats.prismaModels);
  const modelExtraInPrisma = setDiff(stats.prismaModels, stats.kvModels);
  const tagMissingInPrisma = setDiff(stats.kvTags, stats.prismaTags);
  const tagExtraInPrisma = setDiff(stats.prismaTags, stats.kvTags);
  const likeMissingInPrisma = setDiff(stats.kvLikes, stats.prismaLikes);
  const likeExtraInPrisma = setDiff(stats.prismaLikes, stats.kvLikes);

  console.log(`\n=== ${label} ===`);
  if (actions) {
    console.log(
      `applied: users=${actions.users} models=${actions.models} tags=${actions.tags} likes=${actions.likes}`
    );
  }
  console.log(`kv.models=${stats.kvModels.length} prisma.models=${stats.prismaModels.length}`);
  console.log(`kv.tags=${stats.kvTags.length} prisma.tags=${stats.prismaTags.length}`);
  console.log(`kv.likes=${stats.kvLikes.length} prisma.likes=${stats.prismaLikes.length}`);
  console.log(
    `diff.models missing_in_prisma=${modelMissingInPrisma.length} extra_in_prisma=${modelExtraInPrisma.length}`
  );
  console.log(
    `diff.tags missing_in_prisma=${tagMissingInPrisma.length} extra_in_prisma=${tagExtraInPrisma.length}`
  );
  console.log(
    `diff.likes missing_in_prisma=${likeMissingInPrisma.length} extra_in_prisma=${likeExtraInPrisma.length}`
  );

  if (modelMissingInPrisma.length > 0) {
    console.log(`models.missing_in_prisma=${modelMissingInPrisma.join(",")}`);
  }
  if (modelExtraInPrisma.length > 0) {
    console.log(`models.extra_in_prisma=${modelExtraInPrisma.join(",")}`);
  }
  if (tagMissingInPrisma.length > 0) {
    console.log(`tags.missing_in_prisma=${tagMissingInPrisma.join(",")}`);
  }
  if (tagExtraInPrisma.length > 0) {
    console.log(`tags.extra_in_prisma=${tagExtraInPrisma.join(",")}`);
  }
  if (likeMissingInPrisma.length > 0) {
    console.log(`likes.missing_in_prisma=${likeMissingInPrisma.slice(0, 50).join(",")}`);
  }
  if (likeExtraInPrisma.length > 0) {
    console.log(`likes.extra_in_prisma=${likeExtraInPrisma.slice(0, 50).join(",")}`);
  }

  if (warnings.length > 0) {
    console.log(`warnings=${warnings.length}`);
    for (const w of warnings) console.log(`- ${w}`);
  } else {
    console.log("warnings=0");
  }
}

async function main(): Promise<void> {
  console.log(
    `Starting community backfill mode=${applyMode ? "apply" : "dry-run"} db=${DATABASE_URL}`
  );

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await ensureCommunityTables(client);

    const initialStats = await collectStats(client);
    printReport("PRE-CHECK", initialStats, []);

    const kv = await loadKvRows(client);
    const ownership = await loadExistingUsers(client);
    const warnings: string[] = [];

    const users = normalizeUsers(kv.models, kv.profiles, ownership, warnings);
    const models = normalizeModels(kv.models, warnings);
    const tags = normalizeTags(kv.tags);
    const likes = normalizeLikes(kv.likes, warnings);

    console.log(
      `prepared: users=${users.length} models=${models.length} tags=${tags.length} likes=${likes.length}`
    );

    if (dryRunMode && !applyMode) {
      const previewStats = await collectStats(client);
      printReport("DRY-RUN (no changes applied)", previewStats, warnings);
      return;
    }

    await client.query("BEGIN");
    const usersUpserted = await upsertUsers(client, users);
    const modelsUpserted = await upsertModels(client, models);
    const tagsUpserted = await upsertTags(client, tags);
    const likesUpserted = await upsertLikes(client, likes);
    await client.query("COMMIT");

    const finalStats = await collectStats(client);
    printReport("POST-APPLY", finalStats, warnings, {
      users: usersUpserted,
      models: modelsUpserted,
      tags: tagsUpserted,
      likes: likesUpserted,
    });

    const modelsParityOk =
      setDiff(finalStats.kvModels, finalStats.prismaModels).length === 0 &&
      setDiff(finalStats.prismaModels, finalStats.kvModels).length === 0;
    const tagsParityOk =
      setDiff(finalStats.kvTags, finalStats.prismaTags).length === 0 &&
      setDiff(finalStats.prismaTags, finalStats.kvTags).length === 0;
    const likesParityOk =
      setDiff(finalStats.kvLikes, finalStats.prismaLikes).length === 0 &&
      setDiff(finalStats.prismaLikes, finalStats.kvLikes).length === 0;

    if (modelsParityOk && tagsParityOk && likesParityOk) {
      console.log("PARITY_STATUS=OK");
    } else {
      console.log("PARITY_STATUS=PARTIAL");
      process.exitCode = 2;
    }
  } catch (e: any) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    console.error(`Backfill failed: ${e?.message || e}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(`Fatal backfill error: ${e?.message || e}`);
  process.exit(1);
});
