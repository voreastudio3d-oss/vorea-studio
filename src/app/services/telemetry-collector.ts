/**
 * TelemetryCollector — Silent engine analytics service.
 *
 * Collects 3D engine events (generation, export, warnings, crashes)
 * in a buffer and sends them to the server in batches.
 * Uses navigator.sendBeacon on tab close to avoid data loss.
 *
 * Vorea Studio — voreastudio.com
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EngineSnapshot {
  surfaceMode?: string;
  subdivisions?: number;
  maxHeight?: number;
  smoothing?: number;
  colorZones?: number;
  invert?: boolean;
  solid?: boolean;
  baseThickness?: number;
  plateWidth?: number;
  plateDepth?: number;
  cylinderRadius?: number;
  cylinderHeight?: number;
  polygonSides?: number;
  polygonRadius?: number;
  imageFormat?: string;
  imageScale?: number;
  imageScaleMode?: string;
  exportFormat?: string;
  threeMfColorMode?: string;
}

export interface MeshHealthSnapshot {
  meshScore?: string;
  meshFaces?: number;
  meshVertices?: number;
  boundaryEdges?: number;
  nonManifoldEdges?: number;
  meshVolume?: number;
}

export interface TelemetryPayload {
  trigger: string;
  page?: string;
  engine?: EngineSnapshot;
  mesh?: MeshHealthSnapshot;
  snapshotDataUrl?: string; // WebP dataURL — uploaded separately, replaced with snapshotId
  errorMessage?: string;
  generationTimeMs?: number;
  exportTimeMs?: number;
  extraParams?: Record<string, unknown>;
  ts: number; // client timestamp (Date.now())
}

/** Shape sent to server after snapshot upload */
interface TelemetryBatchItem {
  trigger: string;
  page: string;
  ts: number;
  engine?: EngineSnapshot;
  mesh?: MeshHealthSnapshot;
  snapshotId?: string;
  errorMessage?: string;
  generationTimeMs?: number;
  exportTimeMs?: number;
  extraParams?: Record<string, unknown>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_BUFFER = 10;
const FLUSH_INTERVAL_MS = 30_000; // 30 seconds
const MAX_BATCH_SIZE = 20;
const ENDPOINT_BATCH = "/api/telemetry/batch";
const ENDPOINT_SNAPSHOT = "/api/telemetry/snapshot";

// ─── Collector ────────────────────────────────────────────────────────────────

class TelemetryCollector {
  private buffer: TelemetryPayload[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;
  private flushing = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startFlushTimer();
    this.registerBeforeUnload();
  }

  // ─── Public API ───────────────────────────────────────────────────

  /**
   * Track an engine event (generation, export, warning, etc).
   * Non-blocking, buffers internally.
   */
  track(
    trigger: string,
    data?: {
      page?: string;
      engine?: EngineSnapshot;
      mesh?: MeshHealthSnapshot;
      errorMessage?: string;
      generationTimeMs?: number;
      exportTimeMs?: number;
      extraParams?: Record<string, unknown>;
    },
  ): void {
    const payload: TelemetryPayload = {
      trigger,
      page: data?.page || "relief",
      engine: data?.engine,
      mesh: data?.mesh,
      errorMessage: data?.errorMessage,
      generationTimeMs: data?.generationTimeMs,
      exportTimeMs: data?.exportTimeMs,
      extraParams: data?.extraParams,
      ts: Date.now(),
    };

    this.buffer.push(payload);

    if (this.buffer.length >= MAX_BUFFER) {
      void this.flush();
    }
  }

  /**
   * Track an event that includes a visual snapshot of the 3D canvas.
   * The snapshot is captured synchronously from the renderer, then
   * uploaded separately to avoid storing binary data in PostgreSQL.
   */
  trackWithSnapshot(
    trigger: string,
    data: {
      page?: string;
      engine?: EngineSnapshot;
      mesh?: MeshHealthSnapshot;
      errorMessage?: string;
      extraParams?: Record<string, unknown>;
    },
    captureSnapshot?: () => string | undefined,
  ): void {
    let snapshotDataUrl: string | undefined;

    if (captureSnapshot) {
      try {
        snapshotDataUrl = captureSnapshot();
      } catch (e) {
        console.warn("[Telemetry] Snapshot capture failed:", e);
      }
    }

    const payload: TelemetryPayload = {
      trigger,
      page: data.page || "relief",
      engine: data.engine,
      mesh: data.mesh,
      snapshotDataUrl,
      errorMessage: data.errorMessage,
      extraParams: data.extraParams,
      ts: Date.now(),
    };

    this.buffer.push(payload);

    if (this.buffer.length >= MAX_BUFFER) {
      void this.flush();
    }
  }

  /** Get current session ID (useful for correlation with Feedback) */
  getSessionId(): string {
    return this.sessionId;
  }

  /** Force flush (call on navigation or when user submits feedback) */
  forceFlush(): void {
    void this.flush();
  }

  // ─── Internal ─────────────────────────────────────────────────────

  private generateSessionId(): string {
    // Use crypto.randomUUID if available, else fallback
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        void this.flush();
      }
    }, FLUSH_INTERVAL_MS);
  }

  private registerBeforeUnload(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("beforeunload", () => {
      if (this.buffer.length === 0) return;

      // Use sendBeacon for reliable delivery on tab close
      const batch = this.prepareBatch(this.buffer.splice(0));
      const body = JSON.stringify({
        sessionId: this.sessionId,
        events: batch,
      });

      try {
        navigator.sendBeacon(ENDPOINT_BATCH, body);
      } catch {
        // Last resort: sync XHR (blocked by some browsers, but try)
        try {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", ENDPOINT_BATCH, false); // sync
          xhr.setRequestHeader("Content-Type", "application/json");
          xhr.send(body);
        } catch {
          /* silently drop — tab is closing */
        }
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;

    const events = this.buffer.splice(0, MAX_BATCH_SIZE);

    try {
      // Upload snapshots first, get IDs back
      const batchItems = await this.uploadSnapshots(events);

      await fetch(ENDPOINT_BATCH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          events: batchItems,
        }),
        // Use keepalive to allow the request to outlive the page
        keepalive: true,
      });
    } catch (e) {
      // Put events back in buffer on failure (don't lose data)
      console.warn("[Telemetry] Flush failed, re-queueing:", e);
      this.buffer.unshift(...events);

      // Cap buffer to prevent memory leak on persistent connection issues
      if (this.buffer.length > MAX_BATCH_SIZE * 3) {
        this.buffer.length = MAX_BATCH_SIZE * 3;
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Upload any snapshot dataURLs to the server and return
   * batch items with snapshotId instead of raw binary.
   */
  private async uploadSnapshots(
    events: TelemetryPayload[],
  ): Promise<TelemetryBatchItem[]> {
    const results: TelemetryBatchItem[] = [];

    for (const event of events) {
      let snapshotId: string | undefined;

      if (event.snapshotDataUrl) {
        try {
          const res = await fetch(ENDPOINT_SNAPSHOT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: event.snapshotDataUrl }),
          });
          if (res.ok) {
            const json = await res.json();
            snapshotId = json.snapshotId;
          }
        } catch {
          // Snapshot upload failed — continue without it
        }
      }

      results.push({
        trigger: event.trigger,
        page: event.page || "relief",
        ts: event.ts,
        engine: event.engine,
        mesh: event.mesh,
        snapshotId,
        errorMessage: event.errorMessage,
        generationTimeMs: event.generationTimeMs,
        exportTimeMs: event.exportTimeMs,
        extraParams: event.extraParams,
      });
    }

    return results;
  }

  /**
   * Prepare batch for sendBeacon (no async snapshot upload possible).
   * Snapshots are dropped in this path — sendBeacon is last-resort.
   */
  private prepareBatch(events: TelemetryPayload[]): TelemetryBatchItem[] {
    return events.map((e) => ({
      trigger: e.trigger,
      page: e.page || "relief",
      ts: e.ts,
      engine: e.engine,
      mesh: e.mesh,
      errorMessage: e.errorMessage,
      generationTimeMs: e.generationTimeMs,
      exportTimeMs: e.exportTimeMs,
      extraParams: e.extraParams,
    }));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const telemetry = new TelemetryCollector();
