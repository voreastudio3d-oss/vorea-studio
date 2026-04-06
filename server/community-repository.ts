import pg from "pg";
import * as kv from "./kv.js";

export type CommunityDbMode = "kv" | "dual" | "prisma";

type CommunityLike = {
  userId: string;
  modelId: string;
  at?: string;
};

export interface CommunityRepository {
  getAllModels(): Promise<any[]>;
  getAllModelsRaw(): Promise<any[]>;
  getModel(id: string): Promise<any | null>;
  upsertModel(id: string, model: any): Promise<void>;
  deleteModel(id: string): Promise<void>;

  getTag(tag: string): Promise<any | null>;
  upsertTag(tag: string, data: any): Promise<void>;
  listTags(): Promise<any[]>;

  getLike(modelId: string, userId: string): Promise<CommunityLike | null>;
  upsertLike(modelId: string, userId: string, data: CommunityLike): Promise<void>;
  deleteLike(modelId: string, userId: string): Promise<void>;
  listLikesByModel(modelId: string): Promise<CommunityLike[]>;

  getUserProfile(userId: string): Promise<any | null>;
  upsertUserProfile(userId: string, profile: any): Promise<void>;
}

const CORE_MODEL_FIELDS = new Set([
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

function normalizeText(input: unknown): string {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function parseTime(input: unknown): number {
  if (!input) return 0;
  const t = new Date(String(input)).getTime();
  return Number.isFinite(t) ? t : 0;
}

function modelSourceRank(id: string): number {
  if (id.startsWith("cm_")) return 3;
  if (id.startsWith("c_")) return 2;
  return 1;
}

function modelStatusRank(status: string): number {
  const s = normalizeText(status);
  if (s === "published") return 3;
  if (s === "draft") return 2;
  if (s === "archived") return 1;
  return 0;
}

function modelDedupeKey(model: any): string {
  const authorId = normalizeText(model?.authorId || model?.userId);
  const title = normalizeText(model?.title);
  const modelType = normalizeText(
    model?.modelType || (model?.reliefConfig ? "relief" : "parametric")
  );
  return `${authorId}::${title}::${modelType}`;
}

function shouldPreferModel(candidate: any, current: any): boolean {
  const cStatus = modelStatusRank(candidate?.status);
  const curStatus = modelStatusRank(current?.status);
  if (cStatus !== curStatus) return cStatus > curStatus;

  const cSource = modelSourceRank(String(candidate?.id || ""));
  const curSource = modelSourceRank(String(current?.id || ""));
  if (cSource !== curSource) return cSource > curSource;

  const cUpdated = parseTime(candidate?.updatedAt);
  const curUpdated = parseTime(current?.updatedAt);
  if (cUpdated !== curUpdated) return cUpdated > curUpdated;

  const cPopularity = Number(candidate?.likes || 0) + Number(candidate?.downloads || 0);
  const curPopularity = Number(current?.likes || 0) + Number(current?.downloads || 0);
  if (cPopularity !== curPopularity) return cPopularity > curPopularity;

  return String(candidate?.id || "") > String(current?.id || "");
}

function dedupeCommunityModels(models: any[]): any[] {
  const byKey = new Map<string, any>();
  for (const model of models || []) {
    if (!model?.id) continue;
    const key = modelDedupeKey(model);
    const current = byKey.get(key);
    if (!current || shouldPreferModel(model, current)) {
      byKey.set(key, model);
    }
  }
  return [...byKey.values()];
}

function toApiStatus(dbStatus: string | null | undefined): string {
  if (dbStatus === "Draft") return "draft";
  if (dbStatus === "Archived") return "archived";
  return "published";
}

function toDbStatus(apiStatus: string | null | undefined): string {
  if ((apiStatus || "").toLowerCase() === "draft") return "Draft";
  if ((apiStatus || "").toLowerCase() === "archived") return "Archived";
  return "Published";
}

function toApiTier(dbTier: string | null | undefined): string {
  if (!dbTier) return "FREE";
  if (dbTier === "STUDIO_PRO") return "STUDIO PRO";
  return dbTier;
}

function toDbTier(apiTier: string | null | undefined): string {
  if (!apiTier) return "FREE";
  if (apiTier === "STUDIO PRO") return "STUDIO_PRO";
  return apiTier;
}

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function extractModelMeta(model: any): Record<string, unknown> {
  const meta: Record<string, unknown> = { isCommunity: true };
  for (const [key, value] of Object.entries(model || {})) {
    if (!CORE_MODEL_FIELDS.has(key)) {
      meta[key] = value;
    }
  }
  return meta;
}

class KvCommunityRepository implements CommunityRepository {
  async getAllModels(): Promise<any[]> {
    const models = await this.getAllModelsRaw();
    return dedupeCommunityModels(models || []);
  }

  async getAllModelsRaw(): Promise<any[]> {
    const models = await kv.getByPrefix("community:model:");
    return models || [];
  }

  async getModel(id: string): Promise<any | null> {
    return kv.get(`community:model:${id}`);
  }

  async upsertModel(id: string, model: any): Promise<void> {
    await kv.set(`community:model:${id}`, model);
  }

  async deleteModel(id: string): Promise<void> {
    await kv.del(`community:model:${id}`);
  }

  async getTag(tag: string): Promise<any | null> {
    return kv.get(`community:tag:${tag.toLowerCase()}`);
  }

  async upsertTag(tag: string, data: any): Promise<void> {
    await kv.set(`community:tag:${tag.toLowerCase()}`, data);
  }

  async listTags(): Promise<any[]> {
    return kv.getByPrefix("community:tag:");
  }

  async getLike(modelId: string, userId: string): Promise<CommunityLike | null> {
    return kv.get(`community:like:${modelId}:${userId}`);
  }

  async upsertLike(modelId: string, userId: string, data: CommunityLike): Promise<void> {
    await kv.set(`community:like:${modelId}:${userId}`, data);
  }

  async deleteLike(modelId: string, userId: string): Promise<void> {
    await kv.del(`community:like:${modelId}:${userId}`);
  }

  async listLikesByModel(modelId: string): Promise<CommunityLike[]> {
    const likes = await kv.getByPrefix(`community:like:${modelId}:`);
    return (likes || []) as CommunityLike[];
  }

  async getUserProfile(userId: string): Promise<any | null> {
    return kv.get(`user:${userId}:profile`);
  }

  async upsertUserProfile(userId: string, profile: any): Promise<void> {
    await kv.set(`user:${userId}:profile`, profile);
  }
}

class PrismaCommunityRepository implements CommunityRepository {
  private pool: pg.Pool;
  private ready = false;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio";
    this.pool = new pg.Pool({ connectionString, max: 5 });
  }

  private async ensureReady(): Promise<void> {
    if (this.ready) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS community_model_likes (
        model_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        liked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (model_id, user_id)
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS community_tags (
        name TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        model_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    this.ready = true;
  }

  private rowToModel(row: any): any {
    const params = row.params || {};
    const meta = params?.communityMeta || {};
    const modelType = meta.modelType === "relief" ? "relief" : "parametric";

    const model: any = {
      id: row.id,
      title: row.title,
      authorId: row.userId,
      authorName: meta.authorName || row.authorName || "Usuario",
      authorUsername: meta.authorUsername || row.authorUsername || "@user",
      authorAvatarUrl: meta.authorAvatarUrl ?? row.authorAvatarUrl ?? null,
      scadSource: row.scadSource || "",
      modelType,
      tags: row.tags || [],
      thumbnailUrl: row.thumbnailUrl || null,
      likes: row.likes || 0,
      downloads: row.downloads || 0,
      featured: !!row.featured,
      status: toApiStatus(row.status),
      license: meta.license || "CC-BY-SA-4.0",
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      forkCount: meta.forkCount || 0,
      commentCount: Number(meta.commentCount || 0),
      slug: meta.slug || null,
      canonicalPath: meta.canonicalPath || null,
    };

    if (meta.reliefConfig) model.reliefConfig = meta.reliefConfig;
    if (meta.media) model.media = meta.media;
    if (meta.forkedFromId) model.forkedFromId = meta.forkedFromId;
    if (meta.forkedFromTitle) model.forkedFromTitle = meta.forkedFromTitle;
    if (meta.forkedFromAuthor) model.forkedFromAuthor = meta.forkedFromAuthor;
    if (meta.forkChain) model.forkChain = meta.forkChain;

    return model;
  }

  private async ensureUserFromModel(model: any): Promise<void> {
    const userId = model?.authorId;
    if (!userId) return;

    const displayName = model.authorName || "Usuario";
    const username = (model.authorUsername || `@${String(userId).slice(0, 8)}`).startsWith("@")
      ? (model.authorUsername || `@${String(userId).slice(0, 8)}`)
      : `@${model.authorUsername}`;
    const email = `${userId}@community.local`;
    const avatarUrl = model.authorAvatarUrl || null;
    const tier = toDbTier(model.tier || "FREE");
    const role = model.role || "user";
    const createdAt = model.createdAt ? new Date(model.createdAt) : new Date();

    await this.pool.query(
      `INSERT INTO users (id, email, "displayName", username, tier, role, "avatarUrl", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE
         SET "displayName" = EXCLUDED."displayName",
             username = EXCLUDED.username,
             "avatarUrl" = COALESCE(EXCLUDED."avatarUrl", users."avatarUrl"),
             "updatedAt" = NOW()`,
      [userId, email, displayName, username, tier, role, avatarUrl, createdAt]
    );
  }

  async getAllModels(): Promise<any[]> {
    const models = await this.getAllModelsRaw();
    return dedupeCommunityModels(models);
  }

  async getAllModelsRaw(): Promise<any[]> {
    await this.ensureReady();
    const { rows } = await this.pool.query(
      `SELECT
         m.id,
         m."userId",
         m.title,
         m."scadSource",
         m.status,
         m.likes,
         m.downloads,
         m."thumbnailUrl",
         m.tags,
         m.featured,
         m.params,
         m."createdAt",
         m."updatedAt",
         u."displayName" AS "authorName",
         u.username AS "authorUsername",
         u."avatarUrl" AS "authorAvatarUrl"
       FROM models m
       LEFT JOIN users u ON u.id = m."userId"
       WHERE m.id LIKE 'c_%' OR m.id LIKE 'cm_%' OR COALESCE((m.params->'communityMeta'->>'isCommunity')::boolean, false) = true`
    );
    return rows.map((row) => this.rowToModel(row));
  }

  async getModel(id: string): Promise<any | null> {
    await this.ensureReady();
    const { rows } = await this.pool.query(
      `SELECT
         m.id,
         m."userId",
         m.title,
         m."scadSource",
         m.status,
         m.likes,
         m.downloads,
         m."thumbnailUrl",
         m.tags,
         m.featured,
         m.params,
         m."createdAt",
         m."updatedAt",
         u."displayName" AS "authorName",
         u.username AS "authorUsername",
         u."avatarUrl" AS "authorAvatarUrl"
       FROM models m
       LEFT JOIN users u ON u.id = m."userId"
       WHERE m.id = $1
       LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;
    return this.rowToModel(rows[0]);
  }

  async upsertModel(id: string, model: any): Promise<void> {
    await this.ensureReady();
    await this.ensureUserFromModel(model);

    const now = new Date();
    const createdAt = model.createdAt ? new Date(model.createdAt) : now;
    const updatedAt = model.updatedAt ? new Date(model.updatedAt) : now;
    const status = toDbStatus(model.status);
    const meta = extractModelMeta(model);
    const params = { communityMeta: meta };

    await this.pool.query(
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
        id,
        model.authorId,
        model.title || "Untitled",
        model.scadSource || "",
        status,
        JSON.stringify(params),
        false,
        model.likes || 0,
        model.downloads || 0,
        model.thumbnailUrl || null,
        model.tags || [],
        !!model.featured,
        createdAt,
        updatedAt,
      ]
    );
  }

  async deleteModel(id: string): Promise<void> {
    await this.ensureReady();
    await this.pool.query(`DELETE FROM models WHERE id = $1`, [id]);
    await this.pool.query(`DELETE FROM community_model_likes WHERE model_id = $1`, [id]);
  }

  async getTag(tag: string): Promise<any | null> {
    await this.ensureReady();
    const normalized = tag.toLowerCase();
    const { rows } = await this.pool.query(
      `SELECT name, slug, model_count AS "modelCount", created_at AS "createdAt"
       FROM community_tags
       WHERE name = $1 OR slug = $1
       LIMIT 1`,
      [normalized]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async upsertTag(tag: string, data: any): Promise<void> {
    await this.ensureReady();
    const normalized = tag.toLowerCase();
    await this.pool.query(
      `INSERT INTO community_tags (name, slug, model_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (name) DO UPDATE SET
         slug = EXCLUDED.slug,
         model_count = EXCLUDED.model_count,
         updated_at = NOW()`,
      [
        normalized,
        data?.slug || normalized,
        data?.modelCount || 0,
        data?.createdAt ? new Date(data.createdAt) : new Date(),
      ]
    );
  }

  async listTags(): Promise<any[]> {
    await this.ensureReady();
    const { rows } = await this.pool.query(
      `SELECT name, slug, model_count AS "modelCount", created_at AS "createdAt"
       FROM community_tags`
    );
    return rows;
  }

  async getLike(modelId: string, userId: string): Promise<CommunityLike | null> {
    await this.ensureReady();
    const { rows } = await this.pool.query(
      `SELECT user_id AS "userId", model_id AS "modelId", liked_at AS "at"
       FROM community_model_likes
       WHERE model_id = $1 AND user_id = $2
       LIMIT 1`,
      [modelId, userId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async upsertLike(modelId: string, userId: string, data: CommunityLike): Promise<void> {
    await this.ensureReady();
    await this.pool.query(
      `INSERT INTO community_model_likes (model_id, user_id, liked_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (model_id, user_id) DO NOTHING`,
      [modelId, userId, data?.at ? new Date(data.at) : new Date()]
    );
  }

  async deleteLike(modelId: string, userId: string): Promise<void> {
    await this.ensureReady();
    await this.pool.query(
      `DELETE FROM community_model_likes WHERE model_id = $1 AND user_id = $2`,
      [modelId, userId]
    );
  }

  async listLikesByModel(modelId: string): Promise<CommunityLike[]> {
    await this.ensureReady();
    const { rows } = await this.pool.query(
      `SELECT user_id AS "userId", model_id AS "modelId", liked_at AS "at"
       FROM community_model_likes
       WHERE model_id = $1`,
      [modelId]
    );
    return rows as CommunityLike[];
  }

  async getUserProfile(userId: string): Promise<any | null> {
    await this.ensureReady();
    const { rows } = await this.pool.query(
      `SELECT id, email, "displayName", username, tier, role, "avatarUrl", "createdAt", "updatedAt"
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      username: row.username,
      tier: toApiTier(row.tier),
      role: row.role,
      avatarUrl: row.avatarUrl || null,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  }

  async upsertUserProfile(userId: string, profile: any): Promise<void> {
    await this.ensureReady();
    const displayName = profile?.displayName || "Usuario";
    const username = (profile?.username || `@${String(userId).slice(0, 8)}`).startsWith("@")
      ? (profile?.username || `@${String(userId).slice(0, 8)}`)
      : `@${profile?.username}`;
    const email = profile?.email || `${userId}@community.local`;
    const tier = toDbTier(profile?.tier || "FREE");
    const role = profile?.role || "user";
    const avatarUrl = profile?.avatarUrl || null;
    const createdAt = profile?.createdAt ? new Date(profile.createdAt) : new Date();

    await this.pool.query(
      `INSERT INTO users (id, email, "displayName", username, tier, role, "avatarUrl", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         "displayName" = EXCLUDED."displayName",
         username = EXCLUDED.username,
         tier = EXCLUDED.tier,
         role = EXCLUDED.role,
         "avatarUrl" = EXCLUDED."avatarUrl",
         "updatedAt" = NOW()`,
      [userId, email, displayName, username, tier, role, avatarUrl, createdAt]
    );
  }
}

class DualCommunityRepository implements CommunityRepository {
  constructor(
    private readonly readRepo: CommunityRepository,
    private readonly writeRepos: CommunityRepository[]
  ) {}

  private async writeAll(fn: (repo: CommunityRepository) => Promise<void>): Promise<void> {
    for (const repo of this.writeRepos) {
      try {
        await fn(repo);
      } catch (e: any) {
        console.log(`[community:dual] write replica failed: ${e?.message || e}`);
      }
    }
  }

  getAllModels(): Promise<any[]> {
    return this.readRepo.getAllModels();
  }

  getAllModelsRaw(): Promise<any[]> {
    return this.readRepo.getAllModelsRaw();
  }

  getModel(id: string): Promise<any | null> {
    return this.readRepo.getModel(id);
  }

  upsertModel(id: string, model: any): Promise<void> {
    return this.writeAll((repo) => repo.upsertModel(id, model));
  }

  deleteModel(id: string): Promise<void> {
    return this.writeAll((repo) => repo.deleteModel(id));
  }

  getTag(tag: string): Promise<any | null> {
    return this.readRepo.getTag(tag);
  }

  upsertTag(tag: string, data: any): Promise<void> {
    return this.writeAll((repo) => repo.upsertTag(tag, data));
  }

  listTags(): Promise<any[]> {
    return this.readRepo.listTags();
  }

  getLike(modelId: string, userId: string): Promise<CommunityLike | null> {
    return this.readRepo.getLike(modelId, userId);
  }

  upsertLike(modelId: string, userId: string, data: CommunityLike): Promise<void> {
    return this.writeAll((repo) => repo.upsertLike(modelId, userId, data));
  }

  deleteLike(modelId: string, userId: string): Promise<void> {
    return this.writeAll((repo) => repo.deleteLike(modelId, userId));
  }

  listLikesByModel(modelId: string): Promise<CommunityLike[]> {
    return this.readRepo.listLikesByModel(modelId);
  }

  getUserProfile(userId: string): Promise<any | null> {
    return this.readRepo.getUserProfile(userId);
  }

  upsertUserProfile(userId: string, profile: any): Promise<void> {
    return this.writeAll((repo) => repo.upsertUserProfile(userId, profile));
  }
}

export function createCommunityRepository(mode: string | undefined): CommunityRepository {
  const normalized = ((mode || "kv").toLowerCase() as CommunityDbMode);
  const kvRepo = new KvCommunityRepository();
  const prismaRepo = new PrismaCommunityRepository();

  if (normalized === "prisma") return prismaRepo;
  if (normalized === "dual") return new DualCommunityRepository(kvRepo, [kvRepo, prismaRepo]);
  return kvRepo;
}
