/**
 * Compilation Log Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks compilation errors, security warnings, and general diagnostics
 * for user-loaded SCAD files. Persisted in localStorage for feedback reports.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogSeverity = "info" | "warning" | "error" | "security";

export interface CompilationLogEntry {
  id: string;
  timestamp: string;
  severity: LogSeverity;
  phase: "parse" | "compile" | "security" | "slice" | "gcode" | "runtime";
  message: string;
  details?: string;
  sourceSnippet?: string; // first 500 chars of SCAD source for context
  fileName?: string;
  line?: number;
  column?: number;
  duration?: number; // ms
}

export interface SecurityScanResult {
  safe: boolean;
  warnings: SecurityWarning[];
}

export interface SecurityWarning {
  pattern: string;
  description: string;
  line: number;
  severity: "low" | "medium" | "high";
}

export interface AppStateSnapshot {
  timestamp: string;
  userAgent: string;
  screenSize: string;
  currentPage: string;
  compilationLogs: CompilationLogEntry[];
  totalCompilations: number;
  totalErrors: number;
  totalSecurityWarnings: number;
  lastError?: CompilationLogEntry;
  engineState: {
    workerAvailable: boolean;
    lastCompileTime?: number;
    lastFaceCount?: number;
  };
  userTier?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "vorea_compilation_logs";
const MAX_ENTRIES = 200;
const MAX_SNIPPET_LENGTH = 500;

// ─── Security patterns ───────────────────────────────────────────────────────

const SECURITY_PATTERNS: Array<{
  regex: RegExp;
  description: string;
  severity: "low" | "medium" | "high";
}> = [
  {
    regex: /import\s*\(/gi,
    description: "Intento de importacion dinamica detectado",
    severity: "high",
  },
  {
    regex: /require\s*\(/gi,
    description: "Intento de require() detectado",
    severity: "high",
  },
  {
    regex: /eval\s*\(/gi,
    description: "Uso de eval() detectado",
    severity: "high",
  },
  {
    regex: /Function\s*\(/gi,
    description: "Constructor Function() detectado",
    severity: "high",
  },
  {
    regex: /<script[\s>]/gi,
    description: "Etiqueta <script> detectada",
    severity: "high",
  },
  {
    regex: /javascript\s*:/gi,
    description: "Protocolo javascript: detectado",
    severity: "high",
  },
  {
    regex: /on\w+\s*=/gi,
    description: "Posible evento inline HTML detectado",
    severity: "medium",
  },
  {
    regex: /fetch\s*\(/gi,
    description: "Llamada fetch() detectada",
    severity: "medium",
  },
  {
    regex: /XMLHttpRequest/gi,
    description: "Uso de XMLHttpRequest detectado",
    severity: "medium",
  },
  {
    regex: /document\.\w+/gi,
    description: "Acceso a DOM detectado",
    severity: "medium",
  },
  {
    regex: /window\.\w+/gi,
    description: "Acceso a window detectado",
    severity: "medium",
  },
  {
    regex: /localStorage|sessionStorage/gi,
    description: "Acceso a Storage API detectado",
    severity: "medium",
  },
  {
    regex: /\bwhile\s*\(\s*true\s*\)/gi,
    description: "Bucle infinito while(true) detectado",
    severity: "low",
  },
  {
    regex: /for\s*\(\s*;\s*;\s*\)/gi,
    description: "Bucle infinito for(;;) detectado",
    severity: "low",
  },
  {
    regex: /\brecursion_limit\b/gi,
    description: "Referencia a recursion_limit",
    severity: "low",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readLogs(): CompilationLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CompilationLogEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLogs(logs: CompilationLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota */
  }
}

function getLineNumber(source: string, matchIndex: number): number {
  return source.substring(0, matchIndex).split("\n").length;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const CompilationLogService = {
  /** Add a log entry */
  log(entry: Omit<CompilationLogEntry, "id" | "timestamp">): CompilationLogEntry {
    const full: CompilationLogEntry = {
      ...entry,
      id: `clog_${uid()}`,
      timestamp: new Date().toISOString(),
      sourceSnippet: entry.sourceSnippet?.slice(0, MAX_SNIPPET_LENGTH),
    };
    const logs = readLogs();
    logs.unshift(full);
    writeLogs(logs);
    return full;
  },

  /** Log a compilation error */
  logError(
    message: string,
    opts?: {
      phase?: CompilationLogEntry["phase"];
      details?: string;
      source?: string;
      fileName?: string;
      line?: number;
      duration?: number;
    }
  ): CompilationLogEntry {
    return CompilationLogService.log({
      severity: "error",
      phase: opts?.phase ?? "compile",
      message,
      details: opts?.details,
      sourceSnippet: opts?.source,
      fileName: opts?.fileName,
      line: opts?.line,
      duration: opts?.duration,
    });
  },

  /** Log a compilation success */
  logSuccess(
    fileName: string,
    duration: number,
    faceCount: number,
    source?: string
  ): CompilationLogEntry {
    return CompilationLogService.log({
      severity: "info",
      phase: "compile",
      message: `Compilacion exitosa: ${faceCount} caras en ${duration}ms`,
      fileName,
      duration,
      sourceSnippet: source,
    });
  },

  /** Scan SCAD source for suspicious patterns */
  securityScan(source: string, fileName?: string): SecurityScanResult {
    const warnings: SecurityWarning[] = [];

    for (const pattern of SECURITY_PATTERNS) {
      let match: RegExpExecArray | null;
      // Reset regex
      pattern.regex.lastIndex = 0;
      while ((match = pattern.regex.exec(source)) !== null) {
        warnings.push({
          pattern: match[0],
          description: pattern.description,
          line: getLineNumber(source, match.index),
          severity: pattern.severity,
        });
      }
    }

    // Log security warnings
    if (warnings.length > 0) {
      const highCount = warnings.filter((w) => w.severity === "high").length;
      const medCount = warnings.filter((w) => w.severity === "medium").length;
      CompilationLogService.log({
        severity: "security",
        phase: "security",
        message: `Escaneo de seguridad: ${warnings.length} advertencia(s) detectadas (${highCount} alta, ${medCount} media)`,
        details: warnings
          .map((w) => `  L${w.line}: [${w.severity.toUpperCase()}] ${w.description} ("${w.pattern}")`)
          .join("\n"),
        fileName,
        sourceSnippet: source,
      });
    }

    return {
      safe: warnings.filter((w) => w.severity === "high").length === 0,
      warnings,
    };
  },

  /** Get all logs */
  getAll(): CompilationLogEntry[] {
    return readLogs();
  },

  /** Get only errors */
  getErrors(): CompilationLogEntry[] {
    return readLogs().filter((l) => l.severity === "error");
  },

  /** Get only security warnings */
  getSecurityWarnings(): CompilationLogEntry[] {
    return readLogs().filter((l) => l.severity === "security");
  },

  /** Get stats summary */
  getStats(): {
    total: number;
    errors: number;
    warnings: number;
    security: number;
    successRate: number;
  } {
    const logs = readLogs();
    const errors = logs.filter((l) => l.severity === "error").length;
    const warnings = logs.filter((l) => l.severity === "warning").length;
    const security = logs.filter((l) => l.severity === "security").length;
    const total = logs.length;
    const successes = logs.filter((l) => l.severity === "info").length;
    return {
      total,
      errors,
      warnings,
      security,
      successRate: total > 0 ? Math.round((successes / total) * 100) : 100,
    };
  },

  /** Generate a full app state snapshot for feedback */
  captureState(extraState?: Partial<AppStateSnapshot>): AppStateSnapshot {
    const logs = readLogs();
    const errors = logs.filter((l) => l.severity === "error");
    const security = logs.filter((l) => l.severity === "security");

    return {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      currentPage: window.location.pathname || "/",
      compilationLogs: logs.slice(0, 50), // last 50 entries
      totalCompilations: logs.length,
      totalErrors: errors.length,
      totalSecurityWarnings: security.length,
      lastError: errors[0],
      engineState: {
        workerAvailable: typeof Worker !== "undefined",
      },
      ...extraState,
    };
  },

  /** Clear all logs */
  clear(): void {
    writeLogs([]);
  },

  /** Export logs as JSON string */
  exportJSON(): string {
    const snapshot = CompilationLogService.captureState();
    return JSON.stringify(snapshot, null, 2);
  },
};

// ─── Copy helper (no Clipboard API) ──────────────────────────────────────────

export function copyToClipboard(text: string): boolean {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}
