/**
 * SCAD Inline Validator — AST-light syntax checker for OpenSCAD code.
 *
 * Performs structural validation without full CSG evaluation:
 * - Bracket/paren/brace matching
 * - Missing semicolons
 * - Unknown builtins (with "did you mean?" suggestions)
 * - Empty include/use paths
 * - Basic scope awareness for modules/functions
 *
 * Designed to complete in <50ms for files up to ~1000 lines.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface ScadDiagnostic {
  /** 1-based line number */
  line: number;
  /** 0-based column */
  col: number;
  /** 0-based end column (for underline range) */
  endCol: number;
  severity: DiagnosticSeverity;
  message: string;
  /** Rule code for filtering */
  code: string;
}

// ─── OpenSCAD Builtins ────────────────────────────────────────────────────────

const BUILTIN_MODULES = new Set([
  // 3D Primitives
  "cube", "sphere", "cylinder", "polyhedron",
  // 2D Primitives
  "circle", "square", "polygon", "text",
  // Transformations
  "translate", "rotate", "scale", "mirror", "multmatrix",
  "color", "offset", "minkowski", "hull", "resize",
  // Boolean Operations
  "union", "difference", "intersection",
  // Extrusion
  "linear_extrude", "rotate_extrude",
  // Import/Projection
  "import", "surface", "projection",
  // Other
  "render", "children", "echo", "assert", "let",
  "for", "intersection_for", "if", "else",
]);

const BUILTIN_FUNCTIONS = new Set([
  // Math
  "abs", "sign", "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
  "floor", "ceil", "round", "ln", "log", "pow", "sqrt", "exp",
  "min", "max", "norm", "cross",
  // String/List
  "len", "str", "chr", "ord", "search", "concat",
  "lookup", "is_undef", "is_list", "is_num", "is_bool", "is_string",
  // Misc
  "version", "version_num", "parent_module",
]);

const ALL_KNOWN_IDENTIFIERS = new Set([...BUILTIN_MODULES, ...BUILTIN_FUNCTIONS]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function findClosestMatchFor(name: string): string | null {
  let best = "";
  let bestDist = Infinity;
  for (const known of ALL_KNOWN_IDENTIFIERS) {
    const d = levenshtein(name.toLowerCase(), known.toLowerCase());
    if (d < bestDist && d <= 2) {
      bestDist = d;
      best = known;
    }
  }
  return best || null;
}

// ─── Bracket Stack ────────────────────────────────────────────────────────────

interface BracketEntry {
  char: string;
  line: number;
  col: number;
}

const OPEN_BRACKETS: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const CLOSE_BRACKETS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

// ─── Main Validator ───────────────────────────────────────────────────────────

export function validateScad(source: string): ScadDiagnostic[] {
  const diagnostics: ScadDiagnostic[] = [];
  const lines = source.split(/\r?\n/);
  const bracketStack: BracketEntry[] = [];
  const declaredIdentifiers = new Set<string>();

  // First pass: collect declarations
  for (const line of lines) {
    // module name(...)
    const moduleMatch = line.match(/\bmodule\s+(\w+)/);
    if (moduleMatch) declaredIdentifiers.add(moduleMatch[1]);
    // function name(...)
    const funcMatch = line.match(/\bfunction\s+(\w+)/);
    if (funcMatch) declaredIdentifiers.add(funcMatch[1]);
    // variable = ...
    const varMatch = line.match(/^\s*(\$?\w+)\s*=/);
    if (varMatch) declaredIdentifiers.add(varMatch[1]);
  }

  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    let raw = lines[i];

    // Handle block comments
    if (inBlockComment) {
      const endIdx = raw.indexOf("*/");
      if (endIdx === -1) continue;
      raw = raw.substring(endIdx + 2);
      inBlockComment = false;
    }

    // Remove block comments within this line
    let cleaned = "";
    let j = 0;
    while (j < raw.length) {
      if (!inBlockComment && j < raw.length - 1 && raw[j] === "/" && raw[j + 1] === "*") {
        inBlockComment = true;
        j += 2;
        continue;
      }
      if (inBlockComment && j < raw.length - 1 && raw[j] === "*" && raw[j + 1] === "/") {
        inBlockComment = false;
        j += 2;
        continue;
      }
      if (!inBlockComment) {
        cleaned += raw[j];
      }
      j++;
    }

    // Strip line comments
    const commentIdx = cleaned.indexOf("//");
    if (commentIdx !== -1) {
      cleaned = cleaned.substring(0, commentIdx);
    }

    const trimmed = cleaned.trim();
    if (!trimmed) continue;

    // ─── Check: include/use with empty path ───────────────────────────
    const includeMatch = trimmed.match(/^(include|use)\s*<\s*>$/);
    if (includeMatch) {
      diagnostics.push({
        line: lineNum, col: 0, endCol: trimmed.length,
        severity: "warning", code: "empty_include",
        message: `Empty ${includeMatch[1]} path`,
      });
    }

    // ─── Bracket matching ─────────────────────────────────────────────
    let inString = false;
    let stringChar = "";
    for (let c = 0; c < cleaned.length; c++) {
      const ch = cleaned[c];
      if (inString) {
        if (ch === stringChar && cleaned[c - 1] !== "\\") inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch in OPEN_BRACKETS) {
        bracketStack.push({ char: ch, line: lineNum, col: c });
      } else if (ch in CLOSE_BRACKETS) {
        const expected = CLOSE_BRACKETS[ch];
        if (bracketStack.length === 0) {
          diagnostics.push({
            line: lineNum, col: c, endCol: c + 1,
            severity: "error", code: "unmatched_close",
            message: `Unexpected '${ch}' without matching '${expected}'`,
          });
        } else {
          const top = bracketStack[bracketStack.length - 1];
          if (top.char !== expected) {
            diagnostics.push({
              line: lineNum, col: c, endCol: c + 1,
              severity: "error", code: "mismatched_bracket",
              message: `Expected '${OPEN_BRACKETS[top.char]}' to close '${top.char}' from line ${top.line}, found '${ch}'`,
            });
          }
          bracketStack.pop();
        }
      }
    }

    // ─── Check: missing semicolon ─────────────────────────────────────
    // Only for statements that look like they should end with ;
    // Skip lines ending with { } or are module/function/if/for/else keywords
    if (
      !trimmed.endsWith(";") &&
      !trimmed.endsWith("{") &&
      !trimmed.endsWith("}") &&
      !trimmed.endsWith(",") &&
      !trimmed.startsWith("module ") &&
      !trimmed.startsWith("function ") &&
      !trimmed.startsWith("if") &&
      !trimmed.startsWith("else") &&
      !trimmed.startsWith("for") &&
      !trimmed.startsWith("include") &&
      !trimmed.startsWith("use")
    ) {
      // Statement-like lines: assignments, function calls
      const isAssignment = /^\$?\w+\s*=/.test(trimmed);
      const isFunctionCall = /^\w+\s*\(/.test(trimmed) && trimmed.endsWith(")");
      if (isAssignment || isFunctionCall) {
        // Skip module calls that accept children (transforms, booleans, etc.)
        // These are valid without semicolons: translate([0,0,1]) cube([10]);
        const callName = trimmed.match(/^(\w+)\s*\(/)?.[1] || "";
        const CHILD_MODULES = new Set([
          "translate", "rotate", "scale", "mirror", "multmatrix", "color",
          "offset", "resize", "minkowski", "hull", "render",
          "union", "difference", "intersection",
          "linear_extrude", "rotate_extrude", "projection",
        ]);
        const isChildModule = isFunctionCall && CHILD_MODULES.has(callName);
        // Also skip user-declared modules (they may accept children)
        const isUserModule = isFunctionCall && declaredIdentifiers.has(callName);
        if (!isChildModule && !isUserModule) {
          diagnostics.push({
            line: lineNum, col: trimmed.length, endCol: trimmed.length + 1,
            severity: "error", code: "missing_semicolon",
            message: "Expected ';' at end of statement",
          });
        }
      }
    }

    // ─── Check: unknown module/function calls ─────────────────────────
    // Match identifiers followed by ( — possible function/module calls
    const callPattern = /\b([a-zA-Z_]\w*)\s*\(/g;
    let callMatch: RegExpExecArray | null;
    while ((callMatch = callPattern.exec(trimmed)) !== null) {
      const name = callMatch[1];
      // Skip known keywords
      if (["if", "for", "let", "else", "each", "assert", "echo"].includes(name)) continue;
      // Skip if declared by user or builtin
      if (declaredIdentifiers.has(name)) continue;
      if (BUILTIN_MODULES.has(name) || BUILTIN_FUNCTIONS.has(name)) continue;

      const suggestion = findClosestMatchFor(name);
      diagnostics.push({
        line: lineNum,
        col: callMatch.index,
        endCol: callMatch.index + name.length,
        severity: "warning",
        code: "unknown_identifier",
        message: suggestion
          ? `Unknown '${name}' — did you mean '${suggestion}'?`
          : `Unknown module or function '${name}'`,
      });
    }

    // ─── Check: unrecognized line (catch-all) ─────────────────────────
    // If the line doesn't match any known SCAD pattern, flag it.
    const isValidPattern =
      // Variable assignment: x = ...;
      /^\$?\w+\s*=/.test(trimmed) ||
      // Module/function definition
      /^(module|function)\s+\w+/.test(trimmed) ||
      // include/use
      /^(include|use)\s/.test(trimmed) ||
      // Block delimiters only
      /^[{})\]]+[;]?$/.test(trimmed) ||
      // Module/function call: name(...) or name(...) {
      /^\w+\s*\(/.test(trimmed) ||
      // Keywords: if, else, for, let
      /^(if|else|for|let|each)\b/.test(trimmed) ||
      // Closing bracket + semicolon combos
      /^[)\]};,]+$/.test(trimmed) ||
      // Standalone semicolons or commas
      /^[;,]$/.test(trimmed) ||
      // Operators/expressions inside blocks (e.g. "center=true);")
      /[=;(){}\[\],]/.test(trimmed);

    if (!isValidPattern) {
      diagnostics.push({
        line: lineNum, col: 0, endCol: trimmed.length,
        severity: "error", code: "unrecognized_line",
        message: `Unrecognized syntax — not valid SCAD code`,
      });
    }
  }

  // ─── Report unclosed brackets ─────────────────────────────────────
  for (const entry of bracketStack) {
    diagnostics.push({
      line: entry.line, col: entry.col, endCol: entry.col + 1,
      severity: "error", code: "unclosed_bracket",
      message: `Unclosed '${entry.char}' — expected '${OPEN_BRACKETS[entry.char]}'`,
    });
  }

  // Sort by line, then severity (errors first)
  diagnostics.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    const sevOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
    return (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2);
  });

  return diagnostics;
}

// ─── Summary helper ───────────────────────────────────────────────────────────

export function diagnosticsSummary(diagnostics: ScadDiagnostic[]): { errors: number; warnings: number } {
  let errors = 0, warnings = 0;
  for (const d of diagnostics) {
    if (d.severity === "error") errors++;
    else if (d.severity === "warning") warnings++;
  }
  return { errors, warnings };
}
