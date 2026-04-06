import type { ParametricEngine, ParametricFamily, QualityProfile } from "../engine/instruction-spec";

export interface AiStudioRecipe {
  id: string;
  version: "1.0";
  name: string;
  prompt: string;
  engine: ParametricEngine;
  quality: QualityProfile;
  familyHint: ParametricFamily;
  parameterOverrides: Record<string, number | string | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface AiStudioRecipeInput {
  name: string;
  prompt: string;
  engine: ParametricEngine;
  quality: QualityProfile;
  familyHint: ParametricFamily;
  parameterOverrides: Record<string, number | string | boolean>;
}

const VERSION = "1.0";
const GUEST_OWNER_ID = "guest";
const GUEST_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

function storageKey(ownerId: string): string {
  return `vorea_ai_studio_recipes:${ownerId}`;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeRead(ownerId: string): AiStudioRecipe[] {
  try {
    const raw = localStorage.getItem(storageKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiStudioRecipe[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed.filter((item) => {
      if (!item || item.version !== VERSION) return false;
      if (ownerId !== GUEST_OWNER_ID) return true;
      const timestamp = Date.parse(item.updatedAt || item.createdAt);
      if (Number.isNaN(timestamp)) return false;
      return now - timestamp <= GUEST_RETENTION_MS;
    });
  } catch {
    return [];
  }
}

function safeWrite(ownerId: string, recipes: AiStudioRecipe[]): void {
  try {
    localStorage.setItem(storageKey(ownerId), JSON.stringify(recipes));
  } catch {
    // ignore quota/storage errors
  }
}

export const AiStudioRecipes = {
  list(ownerId: string): AiStudioRecipe[] {
    return safeRead(ownerId).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  save(ownerId: string, input: AiStudioRecipeInput, existingId?: string): AiStudioRecipe {
    const current = safeRead(ownerId);
    const now = new Date().toISOString();
    const recipe: AiStudioRecipe = {
      id: existingId || uid(),
      version: VERSION,
      name: input.name.trim() || "Recipe sin nombre",
      prompt: input.prompt.trim(),
      engine: input.engine,
      quality: input.quality,
      familyHint: input.familyHint,
      parameterOverrides: input.parameterOverrides,
      createdAt: now,
      updatedAt: now,
    };

    const existingIndex = current.findIndex((item) => item.id === recipe.id);
    if (existingIndex >= 0) {
      recipe.createdAt = current[existingIndex].createdAt;
      current[existingIndex] = recipe;
    } else {
      current.unshift(recipe);
    }

    safeWrite(ownerId, current);
    return recipe;
  },

  remove(ownerId: string, recipeId: string): void {
    const next = safeRead(ownerId).filter((item) => item.id !== recipeId);
    safeWrite(ownerId, next);
  },

  parseFromJson(raw: string): AiStudioRecipeInput | null {
    try {
      const parsed = JSON.parse(raw) as Partial<AiStudioRecipeInput>;
      if (!parsed || typeof parsed !== "object") return null;
      if (typeof parsed.name !== "string") return null;
      if (typeof parsed.prompt !== "string") return null;
      if (parsed.engine !== "fdm" && parsed.engine !== "organic") return null;
      if (parsed.quality !== "draft" && parsed.quality !== "final") return null;
      if (typeof parsed.familyHint !== "string") return null;
      return {
        name: parsed.name,
        prompt: parsed.prompt,
        engine: parsed.engine,
        quality: parsed.quality,
        familyHint: parsed.familyHint as ParametricFamily,
        parameterOverrides: (parsed.parameterOverrides || {}) as Record<string, number | string | boolean>,
      };
    } catch {
      return null;
    }
  },

  toExportJson(input: AiStudioRecipeInput): string {
    return JSON.stringify(
      {
        ...input,
        version: VERSION,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  },
};
