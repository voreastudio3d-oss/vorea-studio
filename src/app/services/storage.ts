/**
 * localStorage-based mock persistence service.
 *
 * Drop-in replacement interface — swap the implementation for MongoDB/Mongoose
 * when moving to a real backend.
 */

import type { UserProfile, ModelProject, SceneParams, ModelStatus, MembershipTier, GCodeExportCredits, CreditPack } from "./types";
import { GCodeApi, CreditsApi, FeedbackApi } from "./api-client";

// ─── Database Mode ────────────────────────────────────────────────────────────

function isLocalMode(): boolean {
  try {
    return import.meta.env?.VITE_DATABASE_MODE === "local";
  } catch {
    return false;
  }
}

// Lazy-loaded Prisma services (only imported when needed)
let _prismaServices: typeof import("./db/prisma-services") | null = null;

async function getPrismaServices(): Promise<typeof import("./db/prisma-services")> {
  if (!_prismaServices) {
    // IMPORTANT: avoid static analysis/bundling of Node-only Prisma code in Vite browser builds.
    const modulePath = "./db/prisma-services";
    _prismaServices = await import(/* @vite-ignore */ modulePath);
  }
  return _prismaServices!;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded – silent */
  }
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

const KEYS = {
  user: "vorea_user",
  models: "vorea_models",
  auth: "vorea_auth",
  gcodeCredits: "vorea_gcode_credits",
  gcodeCollection: "vorea_gcode_collection",
} as const;

// ─── Default seed data ────────────────────────────────────────────────────────

const DEFAULT_USER: UserProfile = {
  id: "u_default",
  displayName: "Alex Maker",
  username: "@alex_maker",
  email: "alex@vorea.studio",
  tier: "STUDIO PRO",
  createdAt: new Date("2025-01-15").toISOString(),
};

const SEED_MODELS: ModelProject[] = [
  {
    id: "m_seed_1",
    title: "Customizable Bracket v3",
    status: "Published",
    params: { radius: 10, height: 20, resolution: 32 },
    wireframe: false,
    likes: 120,
    downloads: 450,
    thumbnailUrl:
      "https://images.unsplash.com/photo-1565789398675-a61b310b7711?w=800&q=80",
    createdAt: new Date("2025-06-10").toISOString(),
    updatedAt: new Date("2025-09-22").toISOString(),
  },
  {
    id: "m_seed_2",
    title: "Voronoi Phone Stand",
    status: "Draft",
    params: { radius: 8, height: 35, resolution: 64 },
    wireframe: false,
    likes: 45,
    downloads: 112,
    thumbnailUrl:
      "https://images.unsplash.com/photo-1644224076179-31d622e21511?w=800&q=80",
    createdAt: new Date("2025-11-01").toISOString(),
    updatedAt: new Date("2025-12-05").toISOString(),
  },
];

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const AuthService = {
  isLoggedIn(): boolean {
    return read<boolean>(KEYS.auth, false);
  },

  login(email: string, _password: string): UserProfile {
    // Mock: always succeeds. In production → API call.
    const user = UserService.get();
    const updated = UserService.update({ email });
    write(KEYS.auth, true);
    return updated;
  },

  register(data: {
    displayName: string;
    username: string;
    email: string;
    password: string;
  }): UserProfile {
    // Mock: create user with FREE tier
    const user: UserProfile = {
      id: `u_${uid()}`,
      displayName: data.displayName,
      username: data.username.startsWith("@") ? data.username : `@${data.username}`,
      email: data.email,
      tier: "FREE",
      createdAt: new Date().toISOString(),
    };
    write(KEYS.user, user);
    write(KEYS.auth, true);
    return user;
  },

  logout(): void {
    write(KEYS.auth, false);
  },

  upgradeTier(tier: MembershipTier): UserProfile {
    const updated = UserService.update({ tier });
    return updated;
  },
};

// ─── User Service ─────────────────────────────────────────────────────────────

export const UserService = {
  get(): UserProfile {
    const stored = read<UserProfile>(KEYS.user, DEFAULT_USER);
    if (!stored.email) {
      stored.email = DEFAULT_USER.email;
    }
    return stored;
  },

  /** Get user — async version that uses Prisma in local mode */
  async getAsync(userId?: string): Promise<UserProfile> {
    if (isLocalMode()) {
      const svc = await getPrismaServices();
      const user = await svc.PrismaUserService.get(userId);
      if (user) return user;
    }
    return UserService.get();
  },

  update(patch: Partial<Omit<UserProfile, "id" | "createdAt">>): UserProfile {
    const current = UserService.get();
    const updated = { ...current, ...patch };
    write(KEYS.user, updated);
    return updated;
  },

  /** Update — async version that also writes to Prisma in local mode */
  async updateAsync(
    userId: string,
    patch: Partial<Omit<UserProfile, "id" | "createdAt">>
  ): Promise<UserProfile> {
    // Always update localStorage (cache)
    const local = UserService.update(patch);
    if (isLocalMode()) {
      const svc = await getPrismaServices();
      const dbUser = await svc.PrismaUserService.update(userId, patch);
      if (dbUser) return dbUser;
    }
    return local;
  },

  reset(): void {
    write(KEYS.user, DEFAULT_USER);
  },
};

// ─── Model Service ────────────────────────────────────────────────────────────

export const ModelService = {
  /** Return all models, newest first */
  list(): ModelProject[] {
    const models = read<ModelProject[]>(KEYS.models, SEED_MODELS);
    if (models.length === 0) {
      write(KEYS.models, SEED_MODELS);
      return [...SEED_MODELS];
    }
    return models.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  /** Async list that uses Prisma in local mode */
  async listAsync(userId?: string): Promise<ModelProject[]> {
    if (isLocalMode() && userId) {
      const svc = await getPrismaServices();
      const models = await svc.PrismaModelService.list(userId);
      if (models.length > 0) return models;
    }
    return ModelService.list();
  },

  getById(id: string): ModelProject | undefined {
    return ModelService.list().find((m) => m.id === id);
  },

  /** Async getById that uses Prisma in local mode */
  async getByIdAsync(id: string): Promise<ModelProject | null> {
    if (isLocalMode()) {
      const svc = await getPrismaServices();
      return svc.PrismaModelService.getById(id);
    }
    return ModelService.getById(id) || null;
  },

  create(data: {
    title: string;
    params: SceneParams;
    wireframe?: boolean;
    status?: ModelStatus;
  }): ModelProject {
    const now = new Date().toISOString();
    const model: ModelProject = {
      id: `m_${uid()}`,
      title: data.title,
      status: data.status ?? "Draft",
      params: data.params,
      wireframe: data.wireframe ?? false,
      likes: 0,
      downloads: 0,
      thumbnailUrl: "",
      createdAt: now,
      updatedAt: now,
    };
    const models = ModelService.list();
    models.unshift(model);
    write(KEYS.models, models);
    return model;
  },

  /** Async create that also writes to Prisma in local mode */
  async createAsync(
    userId: string,
    data: { title: string; params: SceneParams; wireframe?: boolean; status?: ModelStatus }
  ): Promise<ModelProject> {
    const local = ModelService.create(data);
    if (isLocalMode()) {
      const svc = await getPrismaServices();
      const dbModel = await svc.PrismaModelService.create(userId, data);
      if (dbModel) return dbModel;
    }
    return local;
  },

  update(
    id: string,
    patch: Partial<Omit<ModelProject, "id" | "createdAt">>
  ): ModelProject | null {
    const models = ModelService.list();
    const idx = models.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    models[idx] = {
      ...models[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    write(KEYS.models, models);
    return models[idx];
  },

  delete(id: string): boolean {
    const models = ModelService.list();
    const filtered = models.filter((m) => m.id !== id);
    if (filtered.length === models.length) return false;
    write(KEYS.models, filtered);
    // Also delete from Prisma if in local mode
    if (isLocalMode()) {
      getPrismaServices().then(svc => svc.PrismaModelService.delete(id)).catch(() => {});
    }
    return true;
  },

  /** Aggregate stats for the current user */
  stats(): { totalModels: number; totalLikes: number; totalDownloads: number } {
    const models = ModelService.list();
    return {
      totalModels: models.length,
      totalLikes: models.reduce((s, m) => s + m.likes, 0),
      totalDownloads: models.reduce((s, m) => s + m.downloads, 0),
    };
  },

  /** Async stats that uses Prisma aggregation in local mode */
  async statsAsync(userId: string) {
    if (isLocalMode()) {
      const svc = await getPrismaServices();
      return svc.PrismaModelService.stats(userId);
    }
    return ModelService.stats();
  },
};

// ─── GCode Export Credits ─────────────────────────────────────────────────────

import { getBusinessConfigSync, DEFAULT_CREDIT_PACKS as _DEFAULT_PACKS } from "./business-config";

/** Default free export limit. Dynamic value from business-config when available. */
function getFreeExportLimit(): number {
  return getBusinessConfigSync().limits.freeExportLimit;
}

const DEFAULT_CREDITS: GCodeExportCredits = {
  freeUsed: 0,
  purchasedCredits: 0,
  totalExported: 0,
};

export function getFreeExportRemaining(credits: GCodeExportCredits): number {
  return Math.max(0, getFreeExportLimit() - (credits.freeUsed || 0));
}

export function getRemainingExportCredits(
  credits: GCodeExportCredits,
  tier: MembershipTier,
): number {
  if (tier === "PRO" || tier === "STUDIO PRO") return Infinity;
  return getFreeExportRemaining(credits) + (credits.purchasedCredits || 0);
}

/** Hardcoded fallback — prefer getActiveCreditPacks() for dynamic values */
export const CREDIT_PACKS: CreditPack[] = _DEFAULT_PACKS;

/** Get credit packs (dynamic from backend config, falls back to defaults) */
export function getActiveCreditPacks(): CreditPack[] {
  return getBusinessConfigSync().creditPacks;
}

export const GCodeExportService = {
  /** Get current credits state */
  getCredits(): GCodeExportCredits {
    return read<GCodeExportCredits>(KEYS.gcodeCredits, DEFAULT_CREDITS);
  },

  /** Save credits state to localStorage */
  saveCredits(credits: GCodeExportCredits): void {
    write(KEYS.gcodeCredits, credits);
  },

  /** Check how many exports remain for a given tier */
  remaining(tier: MembershipTier): number {
    const credits = GCodeExportService.getCredits();
    return getRemainingExportCredits(credits, tier);
  },

  /** Whether the user can export */
  canExport(tier: MembershipTier): boolean {
    return GCodeExportService.remaining(tier) > 0;
  },

  /** Consume one export credit. Returns false if none left. */
  consume(tier: MembershipTier): boolean {
    if (tier === "PRO" || tier === "STUDIO PRO") {
      // Unlimited – just track total
      const credits = GCodeExportService.getCredits();
      credits.totalExported++;
      credits.lastExportAt = new Date().toISOString();
      write(KEYS.gcodeCredits, credits);
      return true;
    }

    const credits = GCodeExportService.getCredits();
    const limit = getFreeExportLimit();
    const freeRemaining = Math.max(0, limit - credits.freeUsed);

    if (freeRemaining > 0) {
      credits.freeUsed++;
    } else if (credits.purchasedCredits > 0) {
      credits.purchasedCredits--;
    } else {
      return false; // No credits left
    }

    credits.totalExported++;
    credits.lastExportAt = new Date().toISOString();
    write(KEYS.gcodeCredits, credits);
    return true;
  },

  /** Purchase a credit pack (mock – no real payment) */
  purchasePack(packId: string): boolean {
    const packs = getActiveCreditPacks();
    const pack = packs.find((p) => p.id === packId);
    if (!pack) return false;

    const credits = GCodeExportService.getCredits();
    credits.purchasedCredits += pack.credits;
    write(KEYS.gcodeCredits, credits);
    return true;
  },

  /** Free export limit (dynamic) */
  get FREE_LIMIT() {
    return getFreeExportLimit();
  },

  /** Reset (for testing) */
  reset(): void {
    write(KEYS.gcodeCredits, DEFAULT_CREDITS);
  },
};

// ─── Universal Credit Service ─────────────────────────────────────────────────

import type { UserCredits, MembershipTier as Tier } from "./types";
import { getToolCreditConfigSync } from "./business-config";

const UNIVERSAL_CREDITS_KEY = "vorea_universal_credits";

function getDefaultUserCredits(tier: Tier): UserCredits {
  const config = getToolCreditConfigSync();
  return {
    balance: config.monthlyCredits[tier] ?? 10,
    monthlyAllocation: config.monthlyCredits[tier] ?? 10,
    totalUsed: 0,
    lastResetAt: new Date().toISOString(),
  };
}

export const UniversalCreditService = {
  /** Get current user credits (auto-resets if month changed) */
  getCredits(tier: Tier): UserCredits {
    const stored = read<UserCredits>(UNIVERSAL_CREDITS_KEY, getDefaultUserCredits(tier));
    // Auto-reset if month changed
    const currentMonth = new Date().toISOString().slice(0, 7);
    const storedMonth = (stored.lastResetAt || "").slice(0, 7);
    if (storedMonth && storedMonth !== currentMonth) {
      const config = getToolCreditConfigSync();
      const allocation = config.monthlyCredits[tier] ?? 10;
      stored.balance = allocation;
      stored.monthlyAllocation = allocation;
      stored.lastResetAt = new Date().toISOString();
      write(UNIVERSAL_CREDITS_KEY, stored);
    }
    return stored;
  },

  /** Get credit cost for a specific tool+action */
  getActionCost(toolKey: string, actionId: string): number {
    const config = getToolCreditConfigSync();
    const tool = config.tools[toolKey];
    if (!tool) return 0;
    const action = tool.actions.find((a) => a.actionId === actionId);
    return action?.creditCost ?? 0;
  },

  /** Check if user can perform a specific action (enough credits + not blocked for tier) */
  canPerformAction(tier: Tier, toolKey: string, actionId: string): { allowed: boolean; reason?: string } {
    const config = getToolCreditConfigSync();
    const tool = config.tools[toolKey];
    if (!tool) return { allowed: true }; // Unknown tool — allow

    const action = tool.actions.find((a) => a.actionId === actionId);
    if (!action) return { allowed: true }; // Unknown action — allow

    // Check tier block (null = blocked for that tier)
    const tierKey = tier === "STUDIO PRO" ? "studioPro" : tier.toLowerCase() as "free" | "pro";
    const limit = action.limits[tierKey];
    if (limit === null) return { allowed: false, reason: "upgrade_required" };

    // Check credit balance
    if (action.creditCost > 0) {
      const credits = UniversalCreditService.getCredits(tier);
      if (credits.balance < action.creditCost) {
        return { allowed: false, reason: "insufficient_credits" };
      }
    }
    return { allowed: true };
  },

  /** Consume credits for an action. Returns false if not enough. */
  consumeAction(tier: Tier, toolKey: string, actionId: string): boolean {
    const cost = UniversalCreditService.getActionCost(toolKey, actionId);
    if (cost === 0) return true; // Free action

    const credits = UniversalCreditService.getCredits(tier);

    // Unlimited tiers skip credit check for actions they have access to
    const config = getToolCreditConfigSync();
    const tool = config.tools[toolKey];
    const action = tool?.actions.find((a) => a.actionId === actionId);
    if (action) {
      const tierKey = tier === "STUDIO PRO" ? "studioPro" : tier.toLowerCase() as "free" | "pro";
      if (action.limits[tierKey] === -1) {
        // Unlimited — track usage but don't deduct
        credits.totalUsed += cost;
        write(UNIVERSAL_CREDITS_KEY, credits);
        return true;
      }
    }

    if (credits.balance < cost) return false;

    credits.balance -= cost;
    credits.totalUsed += cost;
    write(UNIVERSAL_CREDITS_KEY, credits);
    return true;
  },

  /** Add purchased credits */
  addCredits(amount: number, tier: Tier): void {
    const credits = UniversalCreditService.getCredits(tier);
    credits.balance += amount;
    write(UNIVERSAL_CREDITS_KEY, credits);
  },

  /** Get remaining balance */
  getBalance(tier: Tier): number {
    return UniversalCreditService.getCredits(tier).balance;
  },

  /** Get the credit value in USD */
  getCreditValueUsd(): number {
    return getToolCreditConfigSync().creditValueUsd;
  },

  /** Reset (for testing) */
  reset(): void {
    write(UNIVERSAL_CREDITS_KEY, getDefaultUserCredits("FREE"));
  },
};

// ─── GCode Collection Service ─────────────────────────────────────────────────

export interface SavedGCodeItem {
  id: string;
  name: string;
  gcode: string;
  createdAt: string;
  config?: Record<string, unknown>;
}

export const GCodeCollectionService = {
  list(): SavedGCodeItem[] {
    return read<SavedGCodeItem[]>(KEYS.gcodeCollection, []);
  },

  /** Async list — uses Prisma in local mode, cloud sync in supabase mode */
  async listAsync(userId?: string): Promise<SavedGCodeItem[]> {
    if (isLocalMode() && userId) {
      const svc = await getPrismaServices();
      return svc.PrismaGCodeService.list(userId);
    }
    return GCodeCollectionService.listCloud();
  },

  /** List with cloud sync – fetches from server and merges with local */
  async listCloud(): Promise<SavedGCodeItem[]> {
    try {
      const remote = await GCodeApi.list();
      if (remote && remote.length > 0) {
        const remoteIds = new Set(remote.map((r: any) => r.id));
        const localOnly = GCodeCollectionService.list().filter(
          (l) => !remoteIds.has(l.id),
        );
        const merged = [...remote, ...localOnly].sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        write(KEYS.gcodeCollection, merged.slice(0, 50));
        return merged;
      }
    } catch (e) {
      console.log("Cloud GCode list failed, using local:", e);
    }
    return GCodeCollectionService.list();
  },

  add(name: string, gcode: string, config?: Record<string, unknown>): SavedGCodeItem {
    const items = GCodeCollectionService.list();
    const item: SavedGCodeItem = {
      id: `gc_${uid()}`,
      name,
      gcode,
      createdAt: new Date().toISOString(),
      config,
    };
    items.unshift(item);
    write(KEYS.gcodeCollection, items.slice(0, 50));
    // Async save: Prisma in local mode, Supabase in cloud mode
    if (isLocalMode()) {
      // userId will be resolved at call site
      // For now, write to local and let the async version handle DB
    } else {
      GCodeApi.save(name, gcode, config).catch((e) =>
        console.log("Cloud GCode save failed:", e),
      );
    }
    return item;
  },

  /** Async add that writes to Prisma in local mode */
  async addAsync(
    userId: string,
    name: string,
    gcode: string,
    config?: Record<string, unknown>
  ): Promise<SavedGCodeItem> {
    const local = GCodeCollectionService.add(name, gcode, config);
    if (isLocalMode()) {
      const svc = await getPrismaServices();
      const dbItem = await svc.PrismaGCodeService.add(userId, name, gcode, config);
      if (dbItem) return dbItem as SavedGCodeItem;
    }
    return local;
  },

  remove(id: string): boolean {
    const items = GCodeCollectionService.list();
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length === items.length) return false;
    write(KEYS.gcodeCollection, filtered);
    if (isLocalMode()) {
      getPrismaServices().then(svc => svc.PrismaGCodeService.remove(id)).catch(() => {});
    } else {
      GCodeApi.remove(id).catch((e) =>
        console.log("Cloud GCode delete failed:", e),
      );
    }
    return true;
  },

  getById(id: string): SavedGCodeItem | undefined {
    return GCodeCollectionService.list().find((i) => i.id === id);
  },
};

// ─── Cloud-synced Credits Service ─────────────────────────────────────────────

export const CloudCreditsService = {
  /** Read the locally cached credits snapshot */
  getCached(): GCodeExportCredits {
    return GCodeExportService.getCredits();
  },

  /** Overwrite the local cache with the last known server state */
  updateCache(credits: GCodeExportCredits): GCodeExportCredits {
    GCodeExportService.saveCredits(credits);
    return credits;
  },

  /** Sync credits from server. If unavailable, return the cached snapshot as stale. */
  async sync(): Promise<{ credits: GCodeExportCredits; stale: boolean }> {
    try {
      const remote = await CreditsApi.get();
      if (remote) {
        write(KEYS.gcodeCredits, remote);
        return { credits: remote, stale: false };
      }
    } catch (e) {
      console.log("Cloud credits sync failed:", e);
    }
    return { credits: GCodeExportService.getCredits(), stale: true };
  },

  /**
   * Consume a credit via server. Never mutates local credits on failure:
   * monetization stays server-authoritative.
   */
  async consume(_tier: MembershipTier): Promise<GCodeExportCredits> {
    try {
      const result = await CreditsApi.consume();
      if (result.credits) {
        write(KEYS.gcodeCredits, result.credits);
        return result.credits;
      }
    } catch (e) {
      console.log("Cloud credits consume failed:", e);
    }
    throw new Error(
      "No se pudo descontar el crédito en el servidor. Reintenta cuando la conexión esté estable.",
    );
  },

  /**
   * Purchase a pack via the authenticated API. If the server is unavailable
   * we fail closed instead of granting local credits.
   */
  async purchasePack(packId: string): Promise<GCodeExportCredits> {
    const pack = CREDIT_PACKS.find((p) => p.id === packId);
    if (!pack) {
      throw new Error("Pack de créditos inválido.");
    }
    try {
      const result = await CreditsApi.purchase(packId, pack.credits);
      if (result?.credits) {
        write(KEYS.gcodeCredits, result.credits);
        return result.credits;
      }
    } catch (e) {
      console.log("Cloud credits purchase failed:", e);
    }
    throw new Error(
      "No se pudo registrar la compra de créditos en el servidor.",
    );
  },
};

// ─── Cloud-synced Feedback Service ────────────────────────────────────────────

export const CloudFeedbackService = {
  /** Submit feedback to server, save locally as backup */
  async submit(data: {
    type: string;
    message: string;
    screenshot?: string;
    stateSnapshot?: string;
    userEmail?: string;
    generationParams?: any;
    modelSnapshotUrl?: string;
  }): Promise<{ success: boolean; feedbackId?: string }> {
    try {
      const result = await FeedbackApi.submit(data);
      return { success: true, feedbackId: result.feedbackId };
    } catch (e) {
      console.log("Cloud feedback submit failed:", e);
      return { success: false };
    }
  },
};
