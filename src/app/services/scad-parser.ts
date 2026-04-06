/**
 * OpenSCAD parameter parser.
 *
 * Reads raw .scad source code and extracts **static** variable declarations
 * (number, boolean, string, array-of-numbers). Calculated / derived variables
 * that reference other identifiers or call functions are skipped.
 *
 * Supports the OpenSCAD Customizer comment annotations:
 *   // [min:max]        → range with step = 1
 *   // [min:step:max]   → range with explicit step
 *   // 'false' for flat → description text
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScadValueType = "number" | "bool" | "string" | "array" | "special";

export interface ScadRange {
  min: number;
  max: number;
  step: number;
}

export interface ScadChoice {
  value: number | string;
  label: string;
}

export interface ScadParam {
  /** Variable name (e.g. "bin_width", "$fn") */
  name: string;
  /** Detected type */
  type: ScadValueType;
  /** The parsed literal value */
  value: number | boolean | string | number[];
  /** Default value (same as initial value – kept for reset) */
  defaultValue: number | boolean | string | number[];
  /** Inline comment stripped of range annotation */
  comment?: string;
  /** Section header extracted from the closest preceding `// Section` comment */
  section?: string;
  /** For numeric values: range inferred from `// [min:max]` or auto-generated */
  range?: ScadRange;
  /** For fixed-choice dropdowns: inferred from `// [val:Label, val2:Label2]` */
  choices?: ScadChoice[];
  /** 1-based line number in source */
  line: number;
}

export interface ScadParseResult {
  params: ScadParam[];
  /** Section names in order of appearance */
  sections: string[];
  /** Full source text (useful for code display) */
  source: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Known variable names from OpenSCAD that are "special" ($fn, $fa, $fs, etc.) */
const SPECIAL_VARS = new Set(["$fn", "$fa", "$fs", "$t", "$preview", "$vpr", "$vpt", "$vpd", "$vpf"]);

/**
 * Check whether a right-hand-side string is a **literal** value
 * (i.e. does not reference other variables or call functions).
 */
function isLiteralRhs(rhs: string): boolean {
  const trimmed = rhs.trim();

  // Boolean
  if (trimmed === "true" || trimmed === "false") return true;

  // Number (int or float, optionally negative)
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return true;

  // String literal
  if (/^"[^"]*"$/.test(trimmed)) return true;

  // Array of numbers: [0.5, 0.5]
  if (/^\[[\d\s.,\-+eE]*\]$/.test(trimmed)) {
    // Extra validation: every element must be a number
    const inner = trimmed.slice(1, -1).trim();
    if (inner === "") return true; // empty array
    return inner.split(",").every((el) => /^\s*-?\d+(\.\d+)?\s*$/.test(el));
  }

  return false;
}

/** Parse a literal RHS into a typed value */
function parseLiteral(rhs: string): { type: ScadValueType; value: number | boolean | string | number[] } {
  const trimmed = rhs.trim();

  if (trimmed === "true") return { type: "bool", value: true };
  if (trimmed === "false") return { type: "bool", value: false };

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { type: "number", value: Number(trimmed) };
  }

  if (/^"[^"]*"$/.test(trimmed)) {
    return { type: "string", value: trimmed.slice(1, -1) };
  }

  if (trimmed.startsWith("[")) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner === "") return { type: "array", value: [] };
    const nums = inner.split(",").map((s) => Number(s.trim()));
    return { type: "array", value: nums };
  }

  return { type: "string", value: trimmed };
}

/** Try to parse a Customizer range annotation from an inline comment.
 *  Formats:  // [1:50]  or  // [1:0.5:50]
 */
function parseRangeAnnotation(comment: string): { range?: ScadRange; cleanComment: string } {
  const rangeMatch = comment.match(/\[\s*(-?[\d.]+)\s*:\s*(-?[\d.]+)\s*(?::\s*(-?[\d.]+))?\s*\]/);
  if (!rangeMatch) return { cleanComment: comment.trim() };

  let min: number, max: number, step: number;

  if (rangeMatch[3] !== undefined) {
    // [min:step:max]
    min = Number(rangeMatch[1]);
    step = Number(rangeMatch[2]);
    max = Number(rangeMatch[3]);
  } else {
    // [min:max]
    min = Number(rangeMatch[1]);
    max = Number(rangeMatch[2]);
    step = 1;
  }

  const cleanComment = comment.replace(/\[.*?\]/, "").trim();
  return { range: { min, max, step }, cleanComment };
}

/** Try to parse Customizer exact choices from an inline comment.
 * Formats: // [1:Small, 2:Medium, 3:Large] or // [red, green, blue] or // [0, 1, 2, 3]
 */
function parseChoicesAnnotation(comment: string, type: ScadValueType): { choices?: ScadChoice[]; cleanComment: string } {
  const choicesMatch = comment.match(/\[(.*?)\]/);
  if (!choicesMatch) return { cleanComment: comment.trim() };

  const content = choicesMatch[1].trim();
  if (content === "") return { cleanComment: comment.trim() };

  // Skip ranges: `[1:100]` or `[-1:0.5:1]`
  if (!content.includes(",")) {
    if (/^\s*-?[\d.]+\s*:\s*-?[\d.]+\s*(?::\s*-?[\d.]+)?\s*$/.test(content)) {
      return { cleanComment: comment.trim() };
    }
  }

  const items = content.split(',').map(s => s.trim()).filter(s => s.length > 0);
  if (items.length === 0) return { cleanComment: comment.trim() };

  const choices: ScadChoice[] = [];
  for (const item of items) {
    let valStr = item;
    let label = item;

    if (item.includes(':')) {
      const idx = item.indexOf(':');
      valStr = item.slice(0, idx).trim();
      label = item.slice(idx + 1).trim();
    }
    
    // Remove quotes if present
    valStr = valStr.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

    const num = Number(valStr);
    const isNum = !isNaN(num) && valStr !== "";
    let val: string | number = valStr;
    
    // If param type is expected to be a number, try casting parsing values
    if (type === "number" || type === "special") {
      val = isNum ? num : valStr;
    }
    
    choices.push({ value: val, label: label || valStr });
  }

  const cleanComment = comment.replace(/\[.*?\]/, "").trim();
  return { choices, cleanComment };
}

/**
 * Auto-generate a sensible range for a numeric value when none is annotated.
 */
function autoRange(value: number): ScadRange {
  if (value === 0) return { min: -100, max: 100, step: 1 };
  const absVal = Math.abs(value);
  const isFloat = !Number.isInteger(value);

  // For very small values (< 1)
  if (absVal < 1) {
    return { min: 0, max: 1, step: 0.01 };
  }
  // Percentage-like (0-1)
  if (absVal <= 1) {
    return { min: 0, max: 1, step: 0.05 };
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(absVal)));
  const maxVal = Math.ceil((absVal * 3) / magnitude) * magnitude;
  const step = isFloat ? magnitude / 10 : Math.max(1, Math.round(magnitude / 10));

  return {
    min: value < 0 ? -maxVal : 0,
    max: maxVal,
    step,
  };
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

export function parseScad(source: string): ScadParseResult {
  const lines = source.split(/\r?\n/);
  const params: ScadParam[] = [];
  const sections: string[] = [];
  let currentSection: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Detect section header comments: lines that are *only* a comment,
    // not inline comments after code.  e.g. "// Bin" or "// Hook Parameters"
    if (/^\/\/\s*(.+)$/.test(trimmed) && !trimmed.includes("=")) {
      const label = trimmed.replace(/^\/\/\s*/, "").trim();
      // Ignore very short or technical comments that aren't sections
      if (label.length > 1 && !label.startsWith("[") && !label.startsWith("Adjust")) {
        currentSection = label;
        if (!sections.includes(label)) sections.push(label);
      }
      continue;
    }

    // Try to match a variable declaration:  name = rhs; // optional comment
    const declMatch = trimmed.match(
      /^(\$?\w+)\s*=\s*(.+?)\s*;\s*(?:\/\/\s*(.*))?$/
    );
    if (!declMatch) continue;

    const [, name, rhs, rawComment] = declMatch;

    // Skip if RHS is not a literal (calculated/derived)
    if (!isLiteralRhs(rhs)) continue;

    const { type, value } = parseLiteral(rhs);

    // Determine if it's a special OpenSCAD variable
    const finalType: ScadValueType = SPECIAL_VARS.has(name) ? "special" : type;

    // Parse range annotation from comment
    let comment: string | undefined;
    let range: ScadRange | undefined;
    let choices: ScadChoice[] | undefined;

    if (rawComment) {
      // First try to parse as range
      const rangeParsed = parseRangeAnnotation(rawComment);
      if (rangeParsed.range) {
        range = rangeParsed.range;
        comment = rangeParsed.cleanComment || undefined;
      } else {
        // If not a range, try choices
        const choicesParsed = parseChoicesAnnotation(rawComment, finalType);
        if (choicesParsed.choices && choicesParsed.choices.length > 0) {
          choices = choicesParsed.choices;
          comment = choicesParsed.cleanComment || undefined;
        } else {
          comment = rawComment.trim();
        }
      }
    }

    // Auto-generate range for numbers without annotation or choices
    if ((finalType === "number" || finalType === "special") && typeof value === "number" && !range && !choices) {
      range = autoRange(value);
    }

    params.push({
      name,
      type: finalType,
      value,
      defaultValue: Array.isArray(value) ? [...value] : value,
      comment,
      section: currentSection,
      range,
      choices,
      line: i + 1,
    });
  }

  return { params, sections, source };
}

// ─── Code Regenerator ─────────────────────────────────────────────────────────

/**
 * Takes the original source and a map of current param values,
 * returns the updated SCAD source with modified variable values.
 */
export function regenerateScad(
  source: string,
  values: Record<string, number | boolean | string | number[]>
): string {
  const lines = source.split(/\r?\n/);

  return lines
    .map((line) => {
      const trimmed = line.trim();
      const declMatch = trimmed.match(
        /^(\$?\w+)\s*=\s*(.+?)\s*;\s*(\/\/.*)?$/
      );
      if (!declMatch) return line;

      const [, name, oldRhs, trailingComment] = declMatch;
      if (!(name in values)) return line;

      const newVal = values[name];
      let newRhs: string;

      if (typeof newVal === "boolean") {
        newRhs = newVal ? "true" : "false";
      } else if (typeof newVal === "number") {
        newRhs = String(newVal);
      } else if (typeof newVal === "string") {
        newRhs = `"${newVal}"`;
      } else if (Array.isArray(newVal)) {
        newRhs = `[${newVal.join(",")}]`;
      } else {
        return line;
      }

      // Preserve indentation
      const indent = line.match(/^(\s*)/)?.[1] ?? "";
      const suffix = trailingComment ? ` ${trailingComment}` : "";
      return `${indent}${name} = ${newRhs};${suffix}`;
    })
    .join("\n");
}
