/**
 * Prisma Services — Real PostgreSQL-backed services for local development.
 *
 * These services replace the localStorage mock when VITE_DATABASE_MODE=local.
 * They talk directly to PostgreSQL via PrismaClient and map to the relational
 * schema defined in prisma/schema.prisma.
 *
 * IMPORTANT: PrismaClient requires Node.js. These services are only available
 * when running in a Node.js environment (SSR, local dev server with API routes,
 * or scripts). In browser-only mode, the app falls back to localStorage.
 *
 * For the React frontend (browser), these services are accessed indirectly
 * through the storage.ts layer which checks VITE_DATABASE_MODE.
 */

import type {
  UserProfile,
  ModelProject,
  MembershipTier,
  GCodeExportCredits,
} from "../types";

// ─── Prisma Client Singleton ──────────────────────────────────────────────────

let _prisma: any = null;

/**
 * Lazily initialize PrismaClient with pg driver adapter.
 * Uses dynamic import to avoid bundling Prisma/pg in browser builds.
 */
async function getPrisma() {
  if (_prisma) return _prisma;
  try {
    const pgMod = await import("pg");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const mod = await import("@prisma/client");
    const PrismaClient = mod.PrismaClient || (mod as any).default?.PrismaClient || (mod as any).default;

    const connectionString =
      (typeof process !== "undefined" && process.env?.DATABASE_URL) ||
      "postgresql://vorea:vorea_dev@localhost:5432/vorea_studio?schema=public";

    const pool = new pgMod.default.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    _prisma = new PrismaClient({ adapter });
    return _prisma;
  } catch (e) {
    console.warn("[PrismaServices] PrismaClient not available:", e);
    return null;
  }
}

// ─── Tier Mapping ─────────────────────────────────────────────────────────────
// App uses "STUDIO PRO" (with space), Prisma enum uses "STUDIO_PRO" (underscore)

function toDbTier(tier: MembershipTier): string {
  return tier === "STUDIO PRO" ? "STUDIO_PRO" : tier;
}

function fromDbTier(dbTier: string): MembershipTier {
  return dbTier === "STUDIO_PRO" ? "STUDIO PRO" : (dbTier as MembershipTier);
}

// ─── User Service ─────────────────────────────────────────────────────────────

export const PrismaUserService = {
  async get(userId?: string): Promise<UserProfile | null> {
    const prisma = await getPrisma();
    if (!prisma) return null;

    const user = userId
      ? await prisma.user.findUnique({ where: { id: userId } })
      : await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

    if (!user) return null;

    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      tier: fromDbTier(user.tier),
      role: user.role,
      avatarUrl: user.avatarUrl || undefined,
      createdAt: user.createdAt.toISOString(),
      banned: user.banned,
      lastLoginAt: user.lastLoginAt?.toISOString(),
    };
  },

  async getByEmail(email: string): Promise<UserProfile | null> {
    const prisma = await getPrisma();
    if (!prisma) return null;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      tier: fromDbTier(user.tier),
      role: user.role,
      avatarUrl: user.avatarUrl || undefined,
      createdAt: user.createdAt.toISOString(),
      banned: user.banned,
      lastLoginAt: user.lastLoginAt?.toISOString(),
    };
  },

  async update(
    userId: string,
    patch: Partial<Omit<UserProfile, "id" | "createdAt">>
  ): Promise<UserProfile | null> {
    const prisma = await getPrisma();
    if (!prisma) return null;

    const data: any = { ...patch };
    if (data.tier) data.tier = toDbTier(data.tier);
    delete data.createdAt; // immutable

    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      tier: fromDbTier(user.tier),
      role: user.role,
      avatarUrl: user.avatarUrl || undefined,
      createdAt: user.createdAt.toISOString(),
      banned: user.banned,
      lastLoginAt: user.lastLoginAt?.toISOString(),
    };
  },

  async create(data: {
    displayName: string;
    username: string;
    email: string;
    tier?: MembershipTier;
  }): Promise<UserProfile | null> {
    const prisma = await getPrisma();
    if (!prisma) return null;

    const user = await prisma.user.create({
      data: {
        displayName: data.displayName,
        username: data.username.startsWith("@")
          ? data.username
          : `@${data.username}`,
        email: data.email,
        tier: toDbTier(data.tier || "FREE"),
      },
    });

    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      tier: fromDbTier(user.tier),
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  },
};

// ─── Model Service ────────────────────────────────────────────────────────────

export const PrismaModelService = {
  async list(userId: string): Promise<ModelProject[]> {
    const prisma = await getPrisma();
    if (!prisma) return [];

    const models = await prisma.model.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return models.map((m: any) => ({
      id: m.id,
      title: m.title,
      status: m.status as ModelProject["status"],
      params: m.params as ModelProject["params"],
      wireframe: m.wireframe,
      likes: m.likes,
      downloads: m.downloads,
      thumbnailUrl: m.thumbnailUrl || "",
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));
  },

  async getById(id: string): Promise<ModelProject | null> {
    const prisma = await getPrisma();
    if (!prisma) return null;

    const m = await prisma.model.findUnique({ where: { id } });
    if (!m) return null;

    return {
      id: m.id,
      title: m.title,
      status: m.status,
      params: m.params as ModelProject["params"],
      wireframe: m.wireframe,
      likes: m.likes,
      downloads: m.downloads,
      thumbnailUrl: m.thumbnailUrl || "",
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  },

  async create(
    userId: string,
    data: {
      title: string;
      params: Record<string, unknown> | { radius: number; height: number; resolution: number };
      wireframe?: boolean;
      status?: string;
    }
  ): Promise<ModelProject | null> {
    const prisma = await getPrisma();
    if (!prisma) return null;

    const m = await prisma.model.create({
      data: {
        userId,
        title: data.title,
        params: data.params,
        wireframe: data.wireframe ?? false,
        status: (data.status as any) || "Draft",
      },
    });

    return {
      id: m.id,
      title: m.title,
      status: m.status,
      params: m.params as ModelProject["params"],
      wireframe: m.wireframe,
      likes: m.likes,
      downloads: m.downloads,
      thumbnailUrl: m.thumbnailUrl || "",
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  },

  async update(
    id: string,
    patch: Partial<Omit<ModelProject, "id" | "createdAt">>
  ): Promise<ModelProject | null> {
    const prisma = await getPrisma();
    if (!prisma) return null;

    const m = await prisma.model.update({
      where: { id },
      data: patch as any,
    });

    return {
      id: m.id,
      title: m.title,
      status: m.status,
      params: m.params as ModelProject["params"],
      wireframe: m.wireframe,
      likes: m.likes,
      downloads: m.downloads,
      thumbnailUrl: m.thumbnailUrl || "",
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  },

  async delete(id: string): Promise<boolean> {
    const prisma = await getPrisma();
    if (!prisma) return false;

    try {
      await prisma.model.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  async stats(userId: string) {
    const prisma = await getPrisma();
    if (!prisma) return { totalModels: 0, totalLikes: 0, totalDownloads: 0 };

    const agg = await prisma.model.aggregate({
      where: { userId },
      _count: true,
      _sum: { likes: true, downloads: true },
    });

    return {
      totalModels: agg._count,
      totalLikes: agg._sum.likes || 0,
      totalDownloads: agg._sum.downloads || 0,
    };
  },
};

// ─── Credits Service ──────────────────────────────────────────────────────────

const FREE_EXPORT_LIMIT = 6;

export const PrismaCreditsService = {
  async getCredits(userId: string): Promise<GCodeExportCredits> {
    const prisma = await getPrisma();
    if (!prisma)
      return { freeUsed: 0, purchasedCredits: 0, totalExported: 0 };

    const credits = await prisma.exportCredits.findUnique({
      where: { userId },
    });

    if (!credits)
      return { freeUsed: 0, purchasedCredits: 0, totalExported: 0 };

    return {
      freeUsed: credits.freeUsed,
      purchasedCredits: credits.purchasedCredits,
      totalExported: credits.totalExported,
      lastExportAt: credits.lastExportAt?.toISOString(),
    };
  },

  async consume(
    userId: string,
    tier: MembershipTier
  ): Promise<boolean> {
    const prisma = await getPrisma();
    if (!prisma) return false;

    // Ensure credits record exists
    await prisma.exportCredits.upsert({
      where: { userId },
      create: { userId, freeUsed: 0, purchasedCredits: 0, totalExported: 0 },
      update: {},
    });

    const credits = await prisma.exportCredits.findUnique({
      where: { userId },
    });
    if (!credits) return false;

    if (tier === "PRO" || tier === "STUDIO PRO") {
      await prisma.exportCredits.update({
        where: { userId },
        data: {
          totalExported: credits.totalExported + 1,
          lastExportAt: new Date(),
        },
      });
      return true;
    }

    const freeRemaining = Math.max(0, FREE_EXPORT_LIMIT - credits.freeUsed);

    if (freeRemaining > 0) {
      await prisma.exportCredits.update({
        where: { userId },
        data: {
          freeUsed: credits.freeUsed + 1,
          totalExported: credits.totalExported + 1,
          lastExportAt: new Date(),
        },
      });
      return true;
    } else if (credits.purchasedCredits > 0) {
      await prisma.exportCredits.update({
        where: { userId },
        data: {
          purchasedCredits: credits.purchasedCredits - 1,
          totalExported: credits.totalExported + 1,
          lastExportAt: new Date(),
        },
      });
      return true;
    }

    return false;
  },

  async purchasePack(userId: string, credits: number): Promise<boolean> {
    const prisma = await getPrisma();
    if (!prisma) return false;

    await prisma.exportCredits.upsert({
      where: { userId },
      create: {
        userId,
        freeUsed: 0,
        purchasedCredits: credits,
        totalExported: 0,
      },
      update: {
        purchasedCredits: { increment: credits },
      },
    });
    return true;
  },

  remaining(credits: GCodeExportCredits, tier: MembershipTier): number {
    if (tier === "PRO" || tier === "STUDIO PRO") return Infinity;
    const freeRemaining = Math.max(0, FREE_EXPORT_LIMIT - credits.freeUsed);
    return freeRemaining + credits.purchasedCredits;
  },
};

// ─── GCode Service ────────────────────────────────────────────────────────────

export const PrismaGCodeService = {
  async list(userId: string) {
    const prisma = await getPrisma();
    if (!prisma) return [];

    const items = await prisma.gCodeItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return items.map((item: any) => ({
      id: item.id,
      name: item.name,
      gcode: item.gcode,
      createdAt: item.createdAt.toISOString(),
      config: item.config || {},
    }));
  },

  async add(
    userId: string,
    name: string,
    gcode: string,
    config?: Record<string, unknown>
  ) {
    const prisma = await getPrisma();
    if (!prisma) return null;

    const item = await prisma.gCodeItem.create({
      data: { userId, name, gcode, config: config || {} },
    });

    return {
      id: item.id,
      name: item.name,
      gcode: item.gcode,
      createdAt: item.createdAt.toISOString(),
      config: item.config || {},
    };
  },

  async remove(id: string): Promise<boolean> {
    const prisma = await getPrisma();
    if (!prisma) return false;

    try {
      await prisma.gCodeItem.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },
};

// ─── Feedback Service ─────────────────────────────────────────────────────────

export const PrismaFeedbackService = {
  async submit(data: {
    userId?: string;
    type: string;
    message: string;
    screenshot?: string;
    stateSnapshot?: string;
    userEmail?: string;
  }) {
    const prisma = await getPrisma();
    if (!prisma) return { success: false };

    const feedback = await prisma.feedback.create({
      data: {
        userId: data.userId || null,
        type: data.type,
        message: data.message,
        screenshot: data.screenshot || null,
        stateSnapshot: data.stateSnapshot || null,
        userEmail: data.userEmail || null,
      },
    });

    return { success: true, feedbackId: feedback.id };
  },
};
