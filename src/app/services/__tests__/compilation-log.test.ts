/**
 * CompilationLogService + securityScan tests.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { CompilationLogService, copyToClipboard } from "../compilation-log";

describe("CompilationLogService", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("log", () => {
    it("creates a log entry with id and timestamp", () => {
      const entry = CompilationLogService.log({
        severity: "info",
        phase: "compile",
        message: "Test log",
      });
      expect(entry.id).toMatch(/^clog_/);
      expect(entry.timestamp).toBeTruthy();
      expect(entry.message).toBe("Test log");
      expect(entry.severity).toBe("info");
    });

    it("truncates sourceSnippet to 500 chars", () => {
      const longSource = "x".repeat(600);
      const entry = CompilationLogService.log({
        severity: "info",
        phase: "compile",
        message: "Long source",
        sourceSnippet: longSource,
      });
      expect(entry.sourceSnippet!.length).toBe(500);
    });
  });

  describe("logError", () => {
    it("creates an error entry with correct defaults", () => {
      const entry = CompilationLogService.logError("Compile failed");
      expect(entry.severity).toBe("error");
      expect(entry.phase).toBe("compile");
      expect(entry.message).toBe("Compile failed");
    });

    it("accepts optional fields", () => {
      const entry = CompilationLogService.logError("Parse error", {
        phase: "parse",
        details: "Unexpected token",
        line: 42,
        duration: 150,
      });
      expect(entry.phase).toBe("parse");
      expect(entry.details).toBe("Unexpected token");
      expect(entry.line).toBe(42);
      expect(entry.duration).toBe(150);
    });
  });

  describe("logSuccess", () => {
    it("creates an info entry with face count and duration", () => {
      const entry = CompilationLogService.logSuccess("model.scad", 250, 1200);
      expect(entry.severity).toBe("info");
      expect(entry.phase).toBe("compile");
      expect(entry.message).toContain("1200 caras");
      expect(entry.message).toContain("250ms");
      expect(entry.fileName).toBe("model.scad");
    });
  });

  describe("securityScan", () => {
    it("returns safe for clean SCAD code", () => {
      const result = CompilationLogService.securityScan(
        "cube([10, 10, 10]);\nsphere(r=5);"
      );
      expect(result.safe).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("detects eval() as high severity", () => {
      const result = CompilationLogService.securityScan('eval("alert(1)")');
      expect(result.safe).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      const evalWarning = result.warnings.find((w) => w.description.includes("eval"));
      expect(evalWarning).toBeDefined();
      expect(evalWarning!.severity).toBe("high");
    });

    it("detects import() as high severity", () => {
      const result = CompilationLogService.securityScan('import("fs")');
      expect(result.safe).toBe(false);
    });

    it("detects require() as high severity", () => {
      const result = CompilationLogService.securityScan('require("child_process")');
      expect(result.safe).toBe(false);
    });

    it("detects <script> tags", () => {
      const result = CompilationLogService.securityScan("<script>alert(1)</script>");
      expect(result.safe).toBe(false);
    });

    it("detects while(true) as low severity", () => {
      const result = CompilationLogService.securityScan("while(true) {}");
      expect(result.safe).toBe(true); // low severity doesn't make it unsafe
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("detects fetch() as medium severity", () => {
      const result = CompilationLogService.securityScan('fetch("https://evil.com")');
      expect(result.safe).toBe(true); // medium doesn't block
      const fetchWarn = result.warnings.find((w) => w.description.includes("fetch"));
      expect(fetchWarn).toBeDefined();
      expect(fetchWarn!.severity).toBe("medium");
    });

    it("includes line numbers in warnings", () => {
      const result = CompilationLogService.securityScan("line1\nline2\neval('x')");
      expect(result.warnings[0].line).toBe(3);
    });

    it("detects Function() constructor", () => {
      const result = CompilationLogService.securityScan('new Function("return 1")');
      expect(result.safe).toBe(false);
    });

    it("detects javascript: protocol", () => {
      const result = CompilationLogService.securityScan('href="javascript:alert(1)"');
      expect(result.safe).toBe(false);
    });
  });

  describe("getAll / getErrors / getSecurityWarnings", () => {
    it("returns all logs", () => {
      CompilationLogService.logSuccess("a.scad", 100, 500);
      CompilationLogService.logError("fail");
      expect(CompilationLogService.getAll()).toHaveLength(2);
    });

    it("filters errors only", () => {
      CompilationLogService.logSuccess("a.scad", 100, 500);
      CompilationLogService.logError("fail");
      expect(CompilationLogService.getErrors()).toHaveLength(1);
    });

    it("filters security warnings only", () => {
      CompilationLogService.securityScan('eval("x")');
      CompilationLogService.logSuccess("a.scad", 100, 500);
      expect(CompilationLogService.getSecurityWarnings()).toHaveLength(1);
    });
  });

  describe("getStats", () => {
    it("returns stats summary", () => {
      CompilationLogService.logSuccess("a.scad", 100, 500);
      CompilationLogService.logSuccess("b.scad", 200, 1000);
      CompilationLogService.logError("fail");
      const stats = CompilationLogService.getStats();
      expect(stats.total).toBe(3);
      expect(stats.errors).toBe(1);
      expect(stats.successRate).toBe(67); // 2/3 ≈ 67%
    });

    it("returns 100% success rate for empty logs", () => {
      expect(CompilationLogService.getStats().successRate).toBe(100);
    });
  });

  describe("captureState", () => {
    it("captures app state snapshot", () => {
      CompilationLogService.logSuccess("a.scad", 100, 500);
      const snapshot = CompilationLogService.captureState();
      expect(snapshot.timestamp).toBeTruthy();
      expect(snapshot.compilationLogs.length).toBeGreaterThan(0);
      expect(snapshot.totalCompilations).toBe(1);
      expect(snapshot.engineState.workerAvailable).toBeDefined();
    });

    it("merges extra state", () => {
      const snapshot = CompilationLogService.captureState({
        userTier: "PRO",
      });
      expect(snapshot.userTier).toBe("PRO");
    });
  });

  describe("clear", () => {
    it("removes all logs", () => {
      CompilationLogService.logSuccess("a.scad", 100, 500);
      CompilationLogService.logError("fail");
      CompilationLogService.clear();
      expect(CompilationLogService.getAll()).toHaveLength(0);
    });
  });

  describe("exportJSON", () => {
    it("returns valid JSON string", () => {
      CompilationLogService.logSuccess("a.scad", 100, 500);
      const json = CompilationLogService.exportJSON();
      const parsed = JSON.parse(json);
      expect(parsed.timestamp).toBeTruthy();
      expect(parsed.compilationLogs).toBeInstanceOf(Array);
    });
  });
});

describe("copyToClipboard", () => {
  it("returns boolean", () => {
    // happy-dom may or may not support execCommand
    const result = copyToClipboard("test text");
    expect(typeof result).toBe("boolean");
  });
});
