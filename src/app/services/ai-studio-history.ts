import type { CompilePreviewResult } from "../engine/compile-preview";
import type {
  InstructionSpecV1,
  ParametricEngine,
  ParametricFamily,
  QualityProfile,
} from "../engine/instruction-spec";
import { PARAMETRIC_FAMILIES } from "../engine/instruction-spec";
import type { FdmValidationResult } from "../engine/validation";

type AiStudioHistoryVersion = "1.0" | "1.1";

export interface AiStudioHistoryEntry {
  id: string;
  version: AiStudioHistoryVersion;
  prompt: string;
  engine: ParametricEngine;
  quality: QualityProfile;
  modelName: string;
  scadCode: string;
  familyHint: ParametricFamily;
  parameterOverrides: Record<string, number | boolean | string>;
  spec: InstructionSpecV1;
  validation: FdmValidationResult;
  compilePreview: CompilePreviewResult;
  createdAt: string;
  updatedAt: string;
}

export interface AiStudioHistoryEntryInput {
  prompt: string;
  engine: ParametricEngine;
  quality: QualityProfile;
  modelName: string;
  scadCode: string;
  familyHint?: ParametricFamily;
  parameterOverrides?: Record<string, number | boolean | string>;
  spec: InstructionSpecV1;
  validation: FdmValidationResult;
  compilePreview: CompilePreviewResult;
}

const VERSION: AiStudioHistoryVersion = "1.1";
const GUEST_OWNER_ID = "guest";
const GUEST_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

function storageKey(ownerId: string): string {
  return `vorea_ai_studio_history:${ownerId}`;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidFamily(engine: ParametricEngine, family: unknown): family is ParametricFamily {
  return typeof family === "string" && (PARAMETRIC_FAMILIES[engine] as readonly string[]).includes(family);
}

function sanitizeParameterOverrides(
  input: unknown
): Record<string, number | boolean | string> {
  if (!input || typeof input !== "object") return {};
  const output: Record<string, number | boolean | string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!key || typeof key !== "string") continue;
    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "string"
    ) {
      output[key] = value;
    }
  }
  return output;
}

function deriveParameterOverrides(spec: InstructionSpecV1): Record<string, number | boolean | string> {
  const output: Record<string, number | boolean | string> = {};
  for (const parameter of spec.parameters || []) {
    const value = parameter?.defaultValue;
    if (
      parameter?.name &&
      (typeof value === "number" || typeof value === "boolean" || typeof value === "string")
    ) {
      output[parameter.name] = value;
    }
  }
  return output;
}

function normalizeHistoryEntry(input: unknown): AiStudioHistoryEntry | null {
  if (!input || typeof input !== "object") return null;
  const entry = input as Partial<AiStudioHistoryEntry> & {
    familyHint?: unknown;
    parameterOverrides?: unknown;
  };

  if (!entry.id || !entry.prompt || !entry.engine || !entry.quality || !entry.modelName || !entry.scadCode) {
    return null;
  }
  if (!entry.spec || !entry.validation || !entry.compilePreview || !entry.createdAt || !entry.updatedAt) {
    return null;
  }

  const familyHint = isValidFamily(entry.engine, entry.familyHint)
    ? entry.familyHint
    : entry.spec.family;
  if (!isValidFamily(entry.engine, familyHint)) {
    return null;
  }

  const parameterOverrides = sanitizeParameterOverrides(entry.parameterOverrides);

  return {
    id: entry.id,
    version: VERSION,
    prompt: entry.prompt,
    engine: entry.engine,
    quality: entry.quality,
    modelName: entry.modelName,
    scadCode: entry.scadCode,
    familyHint,
    parameterOverrides:
      Object.keys(parameterOverrides).length > 0
        ? parameterOverrides
        : deriveParameterOverrides(entry.spec),
    spec: entry.spec,
    validation: entry.validation,
    compilePreview: entry.compilePreview,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function safeRead(ownerId: string): AiStudioHistoryEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .map(normalizeHistoryEntry)
      .filter((item): item is AiStudioHistoryEntry => !!item)
      .filter((item) => {
        if (ownerId !== GUEST_OWNER_ID) return true;
        const timestamp = Date.parse(item.updatedAt || item.createdAt);
        if (Number.isNaN(timestamp)) return false;
        return now - timestamp <= GUEST_RETENTION_MS;
      });
  } catch {
    return [];
  }
}

function safeWrite(ownerId: string, entries: AiStudioHistoryEntry[]): void {
  try {
    localStorage.setItem(storageKey(ownerId), JSON.stringify(entries));
  } catch {
    // ignore quota/storage errors
  }
}

export const AiStudioHistory = {
  list(ownerId: string): AiStudioHistoryEntry[] {
    return safeRead(ownerId).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  save(
    ownerId: string,
    input: AiStudioHistoryEntryInput,
    existingId?: string
  ): AiStudioHistoryEntry {
    const current = safeRead(ownerId);
    const now = new Date().toISOString();
    const entry: AiStudioHistoryEntry = {
      id: existingId || uid(),
      version: VERSION,
      prompt: input.prompt.trim(),
      engine: input.engine,
      quality: input.quality,
      modelName: input.modelName.trim() || "Modelo sin nombre",
      scadCode: input.scadCode,
      familyHint:
        input.familyHint && isValidFamily(input.engine, input.familyHint)
          ? input.familyHint
          : input.spec.family,
      parameterOverrides:
        Object.keys(sanitizeParameterOverrides(input.parameterOverrides)).length > 0
          ? sanitizeParameterOverrides(input.parameterOverrides)
          : deriveParameterOverrides(input.spec),
      spec: input.spec,
      validation: input.validation,
      compilePreview: input.compilePreview,
      createdAt: now,
      updatedAt: now,
    };

    const existingIndex = current.findIndex((item) => item.id === entry.id);
    if (existingIndex >= 0) {
      entry.createdAt = current[existingIndex].createdAt;
      current[existingIndex] = entry;
    } else {
      current.unshift(entry);
    }

    safeWrite(
      ownerId,
      current
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 100)
    );
    return entry;
  },

  remove(ownerId: string, entryId: string): void {
    const next = safeRead(ownerId).filter((item) => item.id !== entryId);
    safeWrite(ownerId, next);
  },
};
