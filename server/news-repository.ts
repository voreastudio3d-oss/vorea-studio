import crypto from "node:crypto";
import pg from "pg";
import type { NewsSourceSeed } from "./news-sources.js";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio";

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function slugify(input: unknown): string {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export type NewsSourceRecord = {
  id: string;
  slug: string;
  name: string;
  type: string;
  language: "es" | "en";
  baseUrl: string;
  feedUrl: string | null;
  listingUrl: string | null;
  fetchMode: string;
  enabled: boolean;
  priority: number;
  editorialPolicy: "standard" | "brief_only";
  editorialNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewsArticleRecord = {
  id: string;
  slug: string;
  sourceId: string;
  canonicalUrl: string;
  titleOriginal: string;
  titleDisplayEs: string;
  summaryEs: string;
  detailEs: string;
  titleDisplayEn: string | null;
  summaryEn: string | null;
  detailEn: string | null;
  sourceExcerpt: string | null;
  imageUrl: string | null;
  author: string | null;
  category: string | null;
  tags: string[];
  sourceLanguage: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  expiresAt: string;
  status: string;
  editorialTier: "brief" | "indexable" | "evergreen";
  indexable: boolean;
  ctaTextEs: string | null;
  ctaTextEn: string | null;
  ctaUrl: string | null;
  editorialContext: string | null;
  dedupeHash: string;
  createdAt: string;
  updatedAt: string;
  source?: NewsSourceRecord | null;
};

export type NewsRunRecord = {
  id: string;
  sourceId: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  error: string | null;
};

export type UpsertNewsArticleInput = Omit<
  NewsArticleRecord,
  "id" | "slug" | "createdAt" | "updatedAt" | "fetchedAt"
> & {
  id?: string;
  slug?: string;
  fetchedAt?: string | null;
};

let _pool: pg.Pool | null = null;

function pool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });
  }
  return _pool;
}

function rowToSource(row: any): NewsSourceRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    language: (row.language ?? "en") === "es" ? "es" : "en",
    baseUrl: row.base_url,
    feedUrl: row.feed_url ?? null,
    listingUrl: row.listing_url ?? null,
    fetchMode: row.fetch_mode,
    enabled: !!row.enabled,
    priority: Number(row.priority || 0),
    editorialPolicy: row.editorial_policy === "brief_only" ? "brief_only" : "standard",
    editorialNotes: row.editorial_notes ?? null,
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
  };
}

function rowToArticle(row: any): NewsArticleRecord {
  const source = row.source_id
    ? {
        id: row.source_id,
        slug: row.source_slug,
        name: row.source_name,
        type: row.source_type,
        language: ((row.source_language_default ?? "en") === "es" ? "es" : "en") as "es" | "en",
        baseUrl: row.source_base_url,
        feedUrl: row.source_feed_url ?? null,
        listingUrl: row.source_listing_url ?? null,
        fetchMode: row.source_fetch_mode,
        enabled: !!row.source_enabled,
        priority: Number(row.source_priority || 0),
        editorialPolicy: (row.source_editorial_policy === "brief_only" ? "brief_only" : "standard") as "standard" | "brief_only",
        editorialNotes: row.source_editorial_notes ?? null,
        createdAt: toIso(row.source_created_at) || new Date().toISOString(),
        updatedAt: toIso(row.source_updated_at) || new Date().toISOString(),
      }
    : null;

  return {
    id: row.id,
    slug: row.slug,
    sourceId: row.source_id,
    canonicalUrl: row.canonical_url,
    titleOriginal: row.title_original,
    titleDisplayEs: row.title_display_es,
    summaryEs: row.summary_es,
    detailEs: row.detail_es,
    titleDisplayEn: row.title_display_en ?? null,
    summaryEn: row.summary_en ?? null,
    detailEn: row.detail_en ?? null,
    sourceExcerpt: row.source_excerpt ?? null,
    imageUrl: row.image_url ?? null,
    author: row.author ?? null,
    category: row.category ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    sourceLanguage: row.source_language ?? null,
    publishedAt: toIso(row.published_at),
    fetchedAt: toIso(row.fetched_at) || new Date().toISOString(),
    expiresAt: toIso(row.expires_at) || new Date().toISOString(),
    status: row.status,
    editorialTier:
      row.editorial_tier === "evergreen"
        ? "evergreen"
        : row.editorial_tier === "indexable"
          ? "indexable"
          : "brief",
    indexable: row.indexable === true,
    ctaTextEs: row.cta_text_es ?? null,
    ctaTextEn: row.cta_text_en ?? null,
    ctaUrl: row.cta_url ?? null,
    editorialContext: row.editorial_context ?? null,
    dedupeHash: row.dedupe_hash,
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
    source,
  };
}

function rowToRun(row: any): NewsRunRecord {
  return {
    id: row.id,
    sourceId: row.source_id ?? null,
    startedAt: toIso(row.started_at) || new Date().toISOString(),
    finishedAt: toIso(row.finished_at),
    status: row.status,
    fetchedCount: Number(row.fetched_count || 0),
    insertedCount: Number(row.inserted_count || 0),
    updatedCount: Number(row.updated_count || 0),
    skippedCount: Number(row.skipped_count || 0),
    error: row.error ?? null,
  };
}

function makeArticleSlug(title: string, canonicalUrl: string): string {
  const base = slugify(title) || "noticia";
  const hash = crypto
    .createHash("sha1")
    .update(canonicalUrl)
    .digest("hex")
    .slice(0, 8);
  return `${base}-${hash}`.slice(0, 96);
}

export class NewsRepository {
  private ready = false;

  async ensureReady(): Promise<void> {
    if (this.ready) return;

    // ── Pre-check: drop incompatible tables created from old schemas ──
    try {
      // Check news_sources for base_url column
      const srcTableCheck = await pool().query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'news_sources'
      `);
      if (srcTableCheck.rows.length > 0) {
        const srcColCheck = await pool().query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'news_sources' AND column_name = 'base_url'
        `);
        if (srcColCheck.rows.length === 0) {
          console.log("[news] Dropping ALL news tables (news_sources missing base_url)...");
          await pool().query(`DROP TABLE IF EXISTS news_ingestion_runs CASCADE`);
          await pool().query(`DROP TABLE IF EXISTS news_articles CASCADE`);
          await pool().query(`DROP TABLE IF EXISTS news_sources CASCADE`);
        }
      }

      // Check news_articles for source_id column
      const artTableCheck = await pool().query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'news_articles'
      `);
      if (artTableCheck.rows.length > 0) {
        const artColCheck = await pool().query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'news_articles' AND column_name = 'source_id'
        `);
        if (artColCheck.rows.length === 0) {
          console.log("[news] Dropping incompatible news_articles table (missing source_id)...");
          await pool().query(`DROP TABLE IF EXISTS news_ingestion_runs CASCADE`);
          await pool().query(`DROP TABLE IF EXISTS news_articles CASCADE`);
        }
      }
    } catch { /* first run, tables don't exist yet — fine */ }

    await pool().query(`
      CREATE TABLE IF NOT EXISTS news_sources (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'en',
        base_url TEXT NOT NULL,
        feed_url TEXT,
        listing_url TEXT,
        fetch_mode TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        priority INT NOT NULL DEFAULT 100,
        editorial_policy TEXT NOT NULL DEFAULT 'standard',
        editorial_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool().query(`
      CREATE TABLE IF NOT EXISTS news_articles (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        source_id TEXT NOT NULL REFERENCES news_sources(id) ON DELETE CASCADE,
        canonical_url TEXT NOT NULL,
        title_original TEXT NOT NULL,
        title_display_es TEXT NOT NULL,
        summary_es TEXT NOT NULL,
        detail_es TEXT NOT NULL,
        title_display_en TEXT,
        summary_en TEXT,
        detail_en TEXT,
        source_excerpt TEXT,
        image_url TEXT,
        author TEXT,
        category TEXT,
        tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        source_language TEXT,
        published_at TIMESTAMPTZ,
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'published',
        editorial_tier TEXT NOT NULL DEFAULT 'brief',
        indexable BOOLEAN NOT NULL DEFAULT FALSE,
        dedupe_hash TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT news_articles_source_canonical_unique UNIQUE (source_id, canonical_url)
      )
    `);
    await pool().query(`
      CREATE TABLE IF NOT EXISTS news_ingestion_runs (
        id TEXT PRIMARY KEY,
        source_id TEXT REFERENCES news_sources(id) ON DELETE SET NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'running',
        fetched_count INT NOT NULL DEFAULT 0,
        inserted_count INT NOT NULL DEFAULT 0,
        updated_count INT NOT NULL DEFAULT 0,
        skipped_count INT NOT NULL DEFAULT 0,
        error TEXT
      )
    `);
    // ── Idempotent column migrations (bring tables forward) ──
    await pool().query(`ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en'`);
    await pool().query(`ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS base_url TEXT NOT NULL DEFAULT ''`);
    await pool().query(`ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS feed_url TEXT`);
    await pool().query(`ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS listing_url TEXT`);
    await pool().query(`ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS fetch_mode TEXT NOT NULL DEFAULT 'rss'`);
    await pool().query(`ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE`);
    await pool().query(`ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 100`);
    await pool().query(`ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS editorial_policy TEXT NOT NULL DEFAULT 'standard'`);
    await pool().query(`ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS editorial_notes TEXT`);
    await pool().query(`UPDATE news_sources SET editorial_policy = 'standard' WHERE editorial_policy IS NULL OR editorial_policy = ''`);
    await pool().query(`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ`);
    await pool().query(`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    await pool().query(`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS source_id TEXT REFERENCES news_sources(id) ON DELETE CASCADE`);
    await pool().query(`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS editorial_tier TEXT NOT NULL DEFAULT 'brief'`);
    await pool().query(`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS indexable BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool().query(`UPDATE news_articles SET editorial_tier = 'brief' WHERE editorial_tier IS NULL OR editorial_tier = ''`);
    await pool().query(`UPDATE news_articles SET indexable = FALSE WHERE indexable IS NULL`);
    await pool().query(`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS cta_text_es TEXT`);
    await pool().query(`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS cta_text_en TEXT`);
    await pool().query(`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS cta_url TEXT`);
    await pool().query(`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS editorial_context TEXT`);
    // Indexes
    await pool().query(`CREATE INDEX IF NOT EXISTS idx_news_articles_status_published ON news_articles(status, published_at DESC)`);
    await pool().query(`CREATE INDEX IF NOT EXISTS idx_news_articles_expires ON news_articles(expires_at)`);
    await pool().query(`CREATE INDEX IF NOT EXISTS idx_news_articles_source_published ON news_articles(source_id, published_at DESC)`);
    await pool().query(`CREATE INDEX IF NOT EXISTS idx_news_articles_editorial_tier ON news_articles(editorial_tier, indexable, published_at DESC)`);
    await pool().query(`CREATE INDEX IF NOT EXISTS idx_news_runs_started ON news_ingestion_runs(started_at DESC)`);
    await pool().query(`CREATE INDEX IF NOT EXISTS idx_news_runs_source_started ON news_ingestion_runs(source_id, started_at DESC)`);
    this.ready = true;
  }

  async seedSources(seeds: NewsSourceSeed[]): Promise<void> {
    await this.ensureReady();
    for (const seed of seeds) {
      await pool().query(
        `INSERT INTO news_sources (
           id, slug, name, type, language, base_url, feed_url, listing_url, fetch_mode, enabled, priority, editorial_policy, editorial_notes, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           slug = EXCLUDED.slug,
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           language = EXCLUDED.language,
           base_url = EXCLUDED.base_url,
           feed_url = EXCLUDED.feed_url,
           listing_url = EXCLUDED.listing_url,
           fetch_mode = EXCLUDED.fetch_mode,
           enabled = EXCLUDED.enabled,
           priority = EXCLUDED.priority,
           editorial_policy = EXCLUDED.editorial_policy,
           editorial_notes = EXCLUDED.editorial_notes,
           updated_at = NOW()`,
        [
          seed.id,
          seed.slug,
          seed.name,
          seed.type,
          seed.language,
          seed.baseUrl,
          seed.feedUrl,
          seed.listingUrl,
          seed.fetchMode,
          seed.enabled,
          seed.priority,
          seed.editorialPolicy ?? "standard",
          seed.editorialNotes ?? null,
        ]
      );
    }
  }

  async listSources(options?: { enabledOnly?: boolean }): Promise<NewsSourceRecord[]> {
    await this.ensureReady();
    const enabledOnly = options?.enabledOnly ?? false;
    const { rows } = await pool().query(
      `SELECT *
       FROM news_sources
       ${enabledOnly ? "WHERE enabled = TRUE" : ""}
       ORDER BY priority ASC, name ASC`
    );
    return rows.map(rowToSource);
  }

  async getSourceBySlug(slug: string): Promise<NewsSourceRecord | null> {
    await this.ensureReady();
    const { rows } = await pool().query(
      `SELECT * FROM news_sources WHERE slug = $1 LIMIT 1`,
      [slug]
    );
    return rows[0] ? rowToSource(rows[0]) : null;
  }

  async startRun(sourceId: string | null): Promise<NewsRunRecord> {
    await this.ensureReady();
    const id = uid("nir");
    const { rows } = await pool().query(
      `INSERT INTO news_ingestion_runs (id, source_id, started_at, status)
       VALUES ($1, $2, NOW(), 'running')
       RETURNING *`,
      [id, sourceId]
    );
    return rowToRun(rows[0]);
  }

  async finishRun(
    id: string,
    patch: Partial<Pick<NewsRunRecord, "status" | "finishedAt" | "fetchedCount" | "insertedCount" | "updatedCount" | "skippedCount" | "error">>
  ): Promise<void> {
    await this.ensureReady();
    await pool().query(
      `UPDATE news_ingestion_runs
       SET finished_at = $2,
           status = COALESCE($3, status),
           fetched_count = COALESCE($4, fetched_count),
           inserted_count = COALESCE($5, inserted_count),
           updated_count = COALESCE($6, updated_count),
           skipped_count = COALESCE($7, skipped_count),
           error = $8
       WHERE id = $1`,
      [
        id,
        patch.finishedAt ? new Date(patch.finishedAt) : new Date(),
        patch.status ?? null,
        patch.fetchedCount ?? null,
        patch.insertedCount ?? null,
        patch.updatedCount ?? null,
        patch.skippedCount ?? null,
        patch.error ?? null,
      ]
    );
  }

  async upsertArticle(input: UpsertNewsArticleInput): Promise<"inserted" | "updated" | "skipped"> {
    await this.ensureReady();
    const { rows } = await pool().query(
      `SELECT *
       FROM news_articles
       WHERE source_id = $1 AND canonical_url = $2
       LIMIT 1`,
      [input.sourceId, input.canonicalUrl]
    );

    const slug = input.slug || makeArticleSlug(input.titleDisplayEs || input.titleDisplayEn || input.titleOriginal, input.canonicalUrl);
    const fetchedAt = input.fetchedAt ? new Date(input.fetchedAt) : new Date();
    const publishedAt = input.publishedAt ? new Date(input.publishedAt) : null;
    const expiresAt = new Date(input.expiresAt);

    if (rows[0]) {
      const current = rowToArticle(rows[0]);
      const changed =
        current.titleOriginal !== input.titleOriginal ||
        current.titleDisplayEs !== input.titleDisplayEs ||
        current.summaryEs !== input.summaryEs ||
        current.detailEs !== input.detailEs ||
        current.titleDisplayEn !== (input.titleDisplayEn ?? null) ||
        current.summaryEn !== (input.summaryEn ?? null) ||
        current.detailEn !== (input.detailEn ?? null) ||
        current.sourceExcerpt !== (input.sourceExcerpt ?? null) ||
        current.imageUrl !== (input.imageUrl ?? null) ||
        current.author !== (input.author ?? null) ||
        current.category !== (input.category ?? null) ||
        JSON.stringify(current.tags) !== JSON.stringify(input.tags) ||
        current.sourceLanguage !== (input.sourceLanguage ?? null) ||
        current.publishedAt !== (toIso(input.publishedAt) ?? null) ||
        current.expiresAt !== input.expiresAt ||
        current.status !== input.status ||
        current.editorialTier !== input.editorialTier ||
        current.indexable !== input.indexable ||
        current.ctaTextEs !== (input.ctaTextEs ?? null) ||
        current.ctaTextEn !== (input.ctaTextEn ?? null) ||
        current.ctaUrl !== (input.ctaUrl ?? null) ||
        current.editorialContext !== (input.editorialContext ?? null);

      if (!changed) {
        await pool().query(
          `UPDATE news_articles
           SET fetched_at = $2, updated_at = NOW()
           WHERE id = $1`,
          [current.id, fetchedAt]
        );
        return "skipped";
      }

      await pool().query(
        `UPDATE news_articles
         SET slug = $2,
             title_original = $3,
             title_display_es = $4,
             summary_es = $5,
             detail_es = $6,
             title_display_en = $7,
             summary_en = $8,
             detail_en = $9,
             source_excerpt = $10,
             image_url = $11,
             author = $12,
             category = $13,
             tags = $14,
             source_language = $15,
             published_at = $16,
             fetched_at = $17,
             expires_at = $18,
             status = $19,
             editorial_tier = $20,
             indexable = $21,
             dedupe_hash = $22,
             cta_text_es = $23,
             cta_text_en = $24,
             cta_url = $25,
             editorial_context = $26,
             updated_at = NOW()
         WHERE id = $1`,
        [
          current.id,
          current.slug || slug,
          input.titleOriginal,
          input.titleDisplayEs,
          input.summaryEs,
          input.detailEs,
          input.titleDisplayEn ?? null,
          input.summaryEn ?? null,
          input.detailEn ?? null,
          input.sourceExcerpt ?? null,
          input.imageUrl ?? null,
          input.author ?? null,
          input.category ?? null,
          input.tags,
          input.sourceLanguage ?? null,
          publishedAt,
          fetchedAt,
          expiresAt,
          input.status,
          input.editorialTier,
          input.indexable,
          input.dedupeHash,
          input.ctaTextEs ?? null,
          input.ctaTextEn ?? null,
          input.ctaUrl ?? null,
          input.editorialContext ?? null,
        ]
      );
      return "updated";
    }

    await pool().query(
      `INSERT INTO news_articles (
         id, slug, source_id, canonical_url, title_original, title_display_es, summary_es, detail_es,
         title_display_en, summary_en, detail_en, source_excerpt, image_url, author, category, tags,
         source_language, published_at, fetched_at, expires_at, status, editorial_tier, indexable, dedupe_hash,
         cta_text_es, cta_text_en, cta_url, editorial_context, created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14, $15, $16,
         $17, $18, $19, $20, $21, $22, $23, $24,
         $25, $26, $27, $28, NOW(), NOW()
       )`,
      [
        input.id || uid("nar"),
        slug,
        input.sourceId,
        input.canonicalUrl,
        input.titleOriginal,
        input.titleDisplayEs,
        input.summaryEs,
        input.detailEs,
        input.titleDisplayEn ?? null,
        input.summaryEn ?? null,
        input.detailEn ?? null,
        input.sourceExcerpt ?? null,
        input.imageUrl ?? null,
        input.author ?? null,
        input.category ?? null,
        input.tags,
        input.sourceLanguage ?? null,
        publishedAt,
        fetchedAt,
        expiresAt,
        input.status,
        input.editorialTier,
        input.indexable,
        input.dedupeHash,
        input.ctaTextEs ?? null,
        input.ctaTextEn ?? null,
        input.ctaUrl ?? null,
        input.editorialContext ?? null,
      ]
    );
    return "inserted";
  }
  async listPublishedArticles(options?: {
    source?: string;
    category?: string;
    sourceLanguage?: string;
    page?: number;
    limit?: number;
  }): Promise<{ articles: NewsArticleRecord[]; total: number; page: number; limit: number }> {
    await this.ensureReady();
    const page = Math.max(1, Number(options?.page || 1));
    const limit = Math.min(Math.max(1, Number(options?.limit || 12)), 50);
    const offset = (page - 1) * limit;
    const values: unknown[] = [];
    const where = [
      `a.status = 'published'`,
      `(a.expires_at IS NULL OR a.expires_at > NOW())`,
    ];

    if (options?.source) {
      values.push(options.source);
      where.push(`s.slug = $${values.length}`);
    }

    if (options?.category) {
      values.push(options.category);
      where.push(`LOWER(COALESCE(a.category, '')) = LOWER($${values.length})`);
    }

    if (options?.sourceLanguage) {
      values.push(options.sourceLanguage);
      where.push(`LOWER(COALESCE(a.source_language, s.language, '')) = LOWER($${values.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const baseFrom = `
         FROM news_articles a
      JOIN news_sources s ON s.id = a.source_id
      ${whereSql}
    `;

    const totalRes = await pool().query(`SELECT COUNT(*)::int AS total ${baseFrom}`, values);
    values.push(limit, offset);
    const { rows } = await pool().query(
      `SELECT
         a.*,
         s.id AS source_id,
         s.slug AS source_slug,
         s.name AS source_name,
         s.type AS source_type,
         s.language AS source_language_default,
         s.base_url AS source_base_url,
         s.feed_url AS source_feed_url,
         s.listing_url AS source_listing_url,
         s.fetch_mode AS source_fetch_mode,
         s.enabled AS source_enabled,
         s.priority AS source_priority,
         s.editorial_policy AS source_editorial_policy,
         s.editorial_notes AS source_editorial_notes,
         s.created_at AS source_created_at,
         s.updated_at AS source_updated_at
       ${baseFrom}
        ORDER BY COALESCE(a.indexable, FALSE) DESC,
                 CASE a.editorial_tier
                   WHEN 'evergreen' THEN 0
                   WHEN 'indexable' THEN 1
                   ELSE 2
                 END ASC,
                 COALESCE(a.published_at, a.created_at) DESC,
                 a.created_at DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      );

    return {
      articles: rows.map(rowToArticle),
      total: Number(totalRes.rows[0]?.total || 0),
      page,
      limit,
    };
  }

  async getPublishedArticleBySlug(slug: string): Promise<NewsArticleRecord | null> {
    await this.ensureReady();
    const { rows } = await pool().query(
      `SELECT
         a.*,
         s.id AS source_id,
         s.slug AS source_slug,
         s.name AS source_name,
         s.type AS source_type,
         s.language AS source_language_default,
         s.base_url AS source_base_url,
         s.feed_url AS source_feed_url,
         s.listing_url AS source_listing_url,
         s.fetch_mode AS source_fetch_mode,
         s.enabled AS source_enabled,
         s.priority AS source_priority,
         s.editorial_policy AS source_editorial_policy,
         s.editorial_notes AS source_editorial_notes,
         s.created_at AS source_created_at,
         s.updated_at AS source_updated_at
       FROM news_articles a
       JOIN news_sources s ON s.id = a.source_id
       WHERE a.slug = $1
         AND a.status = 'published'
         AND (a.expires_at IS NULL OR a.expires_at > NOW())
       LIMIT 1`,
      [slug]
    );
    return rows[0] ? rowToArticle(rows[0]) : null;
  }

  async cleanupExpired(now = new Date()): Promise<{ deletedArticles: number; deletedRuns: number }> {
    await this.ensureReady();
    const articlesRes = await pool().query(
      `DELETE FROM news_articles
       WHERE expires_at <= $1`,
      [now]
    );
    const runsRes = await pool().query(
      `DELETE FROM news_ingestion_runs
       WHERE started_at <= $1`,
      [new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)]
    );
    return {
      deletedArticles: Number(articlesRes.rowCount || 0),
      deletedRuns: Number(runsRes.rowCount || 0),
    };
  }

  // ── Admin CRUD ──

  async updateSource(
    id: string,
    patch: Partial<Pick<NewsSourceRecord, "name" | "language" | "baseUrl" | "feedUrl" | "listingUrl" | "fetchMode" | "enabled" | "priority" | "editorialPolicy" | "editorialNotes">>
  ): Promise<NewsSourceRecord | null> {
    await this.ensureReady();
    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (patch.name !== undefined) { sets.push(`name = $${idx++}`); values.push(patch.name); }
    if (patch.language !== undefined) { sets.push(`language = $${idx++}`); values.push(patch.language); }
    if (patch.baseUrl !== undefined) { sets.push(`base_url = $${idx++}`); values.push(patch.baseUrl); }
    if (patch.feedUrl !== undefined) { sets.push(`feed_url = $${idx++}`); values.push(patch.feedUrl || null); }
    if (patch.listingUrl !== undefined) { sets.push(`listing_url = $${idx++}`); values.push(patch.listingUrl || null); }
    if (patch.fetchMode !== undefined) { sets.push(`fetch_mode = $${idx++}`); values.push(patch.fetchMode); }
    if (patch.enabled !== undefined) { sets.push(`enabled = $${idx++}`); values.push(patch.enabled); }
    if (patch.priority !== undefined) { sets.push(`priority = $${idx++}`); values.push(patch.priority); }
    if (patch.editorialPolicy !== undefined) { sets.push(`editorial_policy = $${idx++}`); values.push(patch.editorialPolicy); }
    if (patch.editorialNotes !== undefined) { sets.push(`editorial_notes = $${idx++}`); values.push(patch.editorialNotes || null); }

    if (sets.length === 0) return null;
    sets.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool().query(
      `UPDATE news_sources SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    return rows[0] ? rowToSource(rows[0]) : null;
  }

  async createSource(input: {
    name: string;
    type?: string;
    language: "es" | "en";
    baseUrl: string;
    feedUrl?: string | null;
    listingUrl?: string | null;
    fetchMode: string;
    enabled?: boolean;
    priority?: number;
    editorialPolicy?: "standard" | "brief_only";
    editorialNotes?: string | null;
  }): Promise<NewsSourceRecord> {
    await this.ensureReady();
    const id = uid("ns");
    const slug = input.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);

    const { rows } = await pool().query(
      `INSERT INTO news_sources (id, slug, name, type, language, base_url, feed_url, listing_url, fetch_mode, enabled, priority, editorial_policy, editorial_notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
       RETURNING *`,
      [
        id,
        slug,
        input.name,
        input.type || "news",
        input.language,
        input.baseUrl,
        input.feedUrl || null,
        input.listingUrl || null,
        input.fetchMode,
        input.enabled ?? true,
        input.priority ?? 100,
        input.editorialPolicy ?? "standard",
        input.editorialNotes ?? null,
      ]
    );
    return rowToSource(rows[0]);
  }

  async deleteSource(id: string): Promise<boolean> {
    await this.ensureReady();
    const res = await pool().query(`DELETE FROM news_sources WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async getArticleStatsBySource(): Promise<Array<{
    sourceId: string;
    total: number;
    brief: number;
    indexable: number;
    evergreen: number;
    lastPublishedAt: string | null;
  }>> {
    await this.ensureReady();
    const { rows } = await pool().query(`
      SELECT
        a.source_id,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE a.editorial_tier = 'brief')::int AS brief,
        COUNT(*) FILTER (WHERE a.editorial_tier = 'indexable')::int AS indexable,
        COUNT(*) FILTER (WHERE a.editorial_tier = 'evergreen')::int AS evergreen,
        MAX(a.published_at) AS last_published_at
      FROM news_articles a
      WHERE a.status = 'published'
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
      GROUP BY a.source_id
      ORDER BY total DESC
    `);
    return rows.map((row: any) => ({
      sourceId: row.source_id,
      total: Number(row.total || 0),
      brief: Number(row.brief || 0),
      indexable: Number(row.indexable || 0),
      evergreen: Number(row.evergreen || 0),
      lastPublishedAt: toIso(row.last_published_at),
    }));
  }
}

export const newsRepository = new NewsRepository();
