/**
 * Telemetry Service — Centralized event tracking for Vorea Studio.
 *
 * Tracks tool usage, session metrics, and user actions.
 * Events are batched and sent to the server periodically.
 *
 * Vorea Studio — voreastudio.com
 */

import { apiUrl } from "../../../utils/config/info";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TelemetryEvent {
  event: string;         // e.g. "studio.export_stl", "relief.generate", "ai.generate"
  tool: string;          // e.g. "studio", "relief", "ai-studio", "organic"
  action: string;        // e.g. "export_stl", "preview", "generate"
  tier?: string;         // User tier
  userId?: string;       // Anonymized user ID
  metadata?: Record<string, unknown>;
  timestamp: string;     // ISO 8601
  sessionId: string;
}

// ─── Session ──────────────────────────────────────────────────────────────────

const SESSION_ID = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const BATCH_INTERVAL_MS = 30_000; // 30 seconds
const MAX_BATCH_SIZE = 50;

let _queue: TelemetryEvent[] = [];
let _timer: ReturnType<typeof setInterval> | null = null;
let _enabled = true;

// ─── Core ─────────────────────────────────────────────────────────────────────

function startBatchTimer() {
  if (_timer) return;
  _timer = setInterval(() => {
    flush();
  }, BATCH_INTERVAL_MS);
}

async function flush() {
  if (_queue.length === 0) return;
  const batch = _queue.splice(0, MAX_BATCH_SIZE);
  try {
    await fetch(`${apiUrl}/telemetry/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // Put back on failure (front of queue)
    _queue.unshift(...batch);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const Telemetry = {
  /** Track a tool action event */
  track(tool: string, action: string, metadata?: Record<string, unknown>) {
    if (!_enabled) return;
    const event: TelemetryEvent = {
      event: `${tool}.${action}`,
      tool,
      action,
      timestamp: new Date().toISOString(),
      sessionId: SESSION_ID,
      metadata,
    };
    _queue.push(event);
    startBatchTimer();

    // Auto-flush if queue is large
    if (_queue.length >= MAX_BATCH_SIZE) flush();
  },

  /** Track with user context */
  trackWithUser(tool: string, action: string, userId: string, tier: string, metadata?: Record<string, unknown>) {
    if (!_enabled) return;
    const event: TelemetryEvent = {
      event: `${tool}.${action}`,
      tool,
      action,
      userId,
      tier,
      timestamp: new Date().toISOString(),
      sessionId: SESSION_ID,
      metadata,
    };
    _queue.push(event);
    startBatchTimer();
    if (_queue.length >= MAX_BATCH_SIZE) flush();
  },

  /** Force flush all queued events */
  async flush() {
    await flush();
  },

  /** Enable/disable telemetry */
  setEnabled(enabled: boolean) {
    _enabled = enabled;
  },

  /** Get session ID */
  getSessionId() {
    return SESSION_ID;
  },

  /** Get queue length (for debugging) */
  getQueueLength() {
    return _queue.length;
  },
};

// Flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (_queue.length > 0) {
      // Use sendBeacon for reliability on unload
      try {
        navigator.sendBeacon(
          `${apiUrl}/telemetry/batch`,
          JSON.stringify({ events: _queue }),
        );
        _queue = [];
      } catch {
        // Silent fail
      }
    }
  });
}
