/**
 * credit-ledger.ts
 * Unified helper for user credit operations in Vorea Studio.
 *
 * All mutations go through here so that AI Studio, tool-actions and any future
 * feature share a single, auditable code path.
 *
 * Internally uses applyToolCreditPrecharge / restoreToolCreditPrecharge from
 * tool-credit-state.ts and persists via kv.ts.
 */

import * as kv from "./kv.js";
import {
  applyToolCreditPrecharge,
  restoreToolCreditPrecharge,
  type ToolCreditPrechargeSnapshot,
} from "./tool-credit-state.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreditBalance {
  balance: number;
  topupBalance: number;
  totalUsed: number;
  monthlyAllocation: number;
  monthlyIssuedAt: string | null;
}

export type ReserveResult =
  | {
      ok: true;
      snapshot: ToolCreditPrechargeSnapshot;
      balanceAfter: number;
    }
  | {
      ok: false;
      reason: string;
      code: "CREDITS_INSUFFICIENT" | "NO_CREDITS_STATE";
    };

// ─── Key helper ─────────────────────────────────────────────────────────────

function creditsKey(userId: string): string {
  return `user:${userId}:tool_credits`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Read the current credit balance for a user.
 * Returns zeroed-out defaults if no state exists yet.
 */
export async function getUserCreditBalance(userId: string): Promise<CreditBalance> {
  const state = (await kv.get(creditsKey(userId))) as any | null;
  return {
    balance: Math.max(0, Number(state?.balance ?? 0)),
    topupBalance: Math.max(0, Number(state?.topupBalance ?? 0)),
    totalUsed: Math.max(0, Number(state?.totalUsed ?? 0)),
    monthlyAllocation: Math.max(0, Number(state?.monthlyAllocation ?? 0)),
    monthlyIssuedAt: state?.monthlyIssuedAt ?? null,
  };
}

/**
 * Reserve (pre-charge) credits for an upcoming operation.
 *
 * - Returns `ok: true` + snapshot if successful (snapshot must be kept to
 *   release credits if the operation fails).
 * - Returns `ok: false` + reason if the user has insufficient credits.
 *
 * The credit state is immediately written to KV so that concurrent requests
 * cannot double-spend the same balance (best-effort with in-memory KV; Redis
 * would add true atomicity).
 */
export async function reserveCredits(
  userId: string,
  creditCost: number
): Promise<ReserveResult> {
  if (creditCost <= 0) {
    // Nothing to reserve; return a no-op snapshot
    const zeroCost: ToolCreditPrechargeSnapshot = {
      balanceBefore: 0,
      topupBalanceBefore: 0,
      totalUsedBefore: 0,
      creditCost: 0,
      creditsFromMonthly: 0,
      creditsFromTopup: 0,
    };
    return { ok: true, snapshot: zeroCost, balanceAfter: 0 };
  }

  const state = (await kv.get(creditsKey(userId))) as any | null;

  if (!state) {
    return { ok: false as const, reason: "Estado de créditos no inicializado.", code: "NO_CREDITS_STATE" as const };
  }

  const currentBalance = Math.max(0, Number(state.balance ?? 0));

  if (currentBalance < creditCost) {
    return {
      ok: false as const,
      reason: `Créditos insuficientes. Necesitas ${creditCost} y tienes ${currentBalance}.`,
      code: "CREDITS_INSUFFICIENT" as const,
    };
  }

  const { nextState, snapshot } = applyToolCreditPrecharge(state, creditCost);
  await kv.set(creditsKey(userId), nextState);

  return {
    ok: true,
    snapshot,
    balanceAfter: Math.max(0, Number(nextState.balance ?? 0)),
  };
}

/**
 * Release (refund) previously reserved credits.
 * Call this when the operation that reserved credits has failed.
 *
 * If `snapshot` is null/undefined (creditCost was 0 or reserve was skipped),
 * this is a no-op.
 */
export async function releaseCredits(
  userId: string,
  snapshot: ToolCreditPrechargeSnapshot | null
): Promise<void> {
  if (!snapshot || snapshot.creditCost === 0) return;

  const state = (await kv.get(creditsKey(userId))) as any | null;
  if (!state) return; // Nothing to restore into

  const restored = restoreToolCreditPrecharge(state, snapshot);
  await kv.set(creditsKey(userId), restored);
}

// ─── Idempotency helpers ─────────────────────────────────────────────────────

const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IN_PROGRESS_TTL_MS = 90_000; // 90 seconds

export type IdempotencyStatus = "in-progress" | "completed";

export interface IdempotencyRecord {
  status: IdempotencyStatus;
  createdAt: string;
  resolvedAt?: string;
  userId?: string;
  result?: unknown;
  contract?: unknown;
  routing?: unknown;
  usage?: unknown;
}

function idempotencyKey(generationId: string): string {
  return `idempotency:ai-gen:${generationId}`;
}

/**
 * Check whether a generationId was already seen.
 * Returns null if not seen, or the full record if found.
 */
export async function getIdempotencyRecord(
  generationId: string
): Promise<IdempotencyRecord | null> {
  return (await kv.get(idempotencyKey(generationId))) as IdempotencyRecord | null;
}

/**
 * Mark a generation as in-progress to block concurrent duplicate requests.
 * Uses a short TTL so that stuck entries expire automatically.
 */
export async function markGenerationInProgress(generationId: string): Promise<void> {
  const record: IdempotencyRecord = {
    status: "in-progress",
    createdAt: new Date().toISOString(),
  };
  // TTL not natively supported by current KV — set and rely on cleanup
  // (upgrade path: pass ttl option when KV supports it)
  await kv.set(idempotencyKey(generationId), record);

  // Schedule automatic cleanup for stuck in-progress entries
  // (fire-and-forget, best effort with plain KV)
  setTimeout(async () => {
    const current = (await kv.get(idempotencyKey(generationId))) as IdempotencyRecord | null;
    if (current?.status === "in-progress") {
      await kv.del(idempotencyKey(generationId));
    }
  }, IN_PROGRESS_TTL_MS);
}

/**
 * Persist a completed generation result for idempotent replay.
 * Must be called BEFORE responding 200 to the client.
 */
export async function markGenerationCompleted(
  generationId: string,
  payload: {
    userId: string;
    result: unknown;
    contract: unknown;
    routing: unknown;
    usage: unknown;
  }
): Promise<void> {
  const record: IdempotencyRecord = {
    status: "completed",
    createdAt: new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
    ...payload,
  };
  await kv.set(idempotencyKey(generationId), record);
}

/**
 * Remove an idempotency record (e.g. after a confirmed failure where no result exists).
 */
export async function clearIdempotencyRecord(generationId: string): Promise<void> {
  await kv.del(idempotencyKey(generationId));
}
