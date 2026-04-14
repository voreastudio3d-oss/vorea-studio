export type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | { [key: string]: YamlValue };

function countIndent(line: string): number {
  const match = line.match(/^ */);
  return match ? match[0].length : 0;
}

function stripComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === "\"" && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === "#" && !inSingle && !inDouble) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line;
}

function parseInlineArray(raw: string): YamlValue[] {
  const content = raw.slice(1, -1).trim();
  if (!content) {
    return [];
  }
  const parts: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      current += char;
      continue;
    }
    if (char === "\"" && !inSingle) {
      inDouble = !inDouble;
      current += char;
      continue;
    }
    if (char === "," && !inSingle && !inDouble) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts.map((part) => parseScalar(part));
}

function parseScalar(raw: string): YamlValue {
  const value = stripComment(raw).trim();
  if (value === "") {
    return "";
  }
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value === "null") {
    return null;
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return parseInlineArray(value);
  }
  return value;
}

function findNextMeaningfulLine(lines: string[], index: number): number {
  for (let cursor = index; cursor < lines.length; cursor += 1) {
    const candidate = stripComment(lines[cursor]).trim();
    if (candidate.length > 0) {
      return cursor;
    }
  }
  return -1;
}

function parseNode(lines: string[], startIndex: number, indent: number): [YamlValue, number] {
  const nextIndex = findNextMeaningfulLine(lines, startIndex);
  if (nextIndex === -1) {
    return [{}, lines.length];
  }
  const trimmed = stripComment(lines[nextIndex]).trim();
  if (trimmed.startsWith("- ") || trimmed === "-") {
    return parseArray(lines, startIndex, indent);
  }
  return parseObject(lines, startIndex, indent);
}

function parseArray(lines: string[], startIndex: number, indent: number): [YamlValue[], number] {
  const values: YamlValue[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const rawLine = lines[index];
    const stripped = stripComment(rawLine);
    const trimmed = stripped.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }
    const lineIndent = countIndent(rawLine);
    if (lineIndent < indent) {
      break;
    }
    if (lineIndent > indent) {
      throw new Error(`Unexpected indentation in YAML array at line ${index + 1}`);
    }
    if (!trimmed.startsWith("- ") && trimmed !== "-") {
      break;
    }
    const itemText = trimmed === "-" ? "" : trimmed.slice(2).trim();
    const looksLikeObjectEntry = /^[A-Za-z0-9_.-]+:(\s|$)/.test(itemText);
    if (itemText && looksLikeObjectEntry) {
      const nestedIndent = indent + 2;
      const syntheticLines = [...lines];
      syntheticLines[index] = `${" ".repeat(nestedIndent)}${itemText}`;
      const [childValue, nextIndex] = parseObject(syntheticLines, index, nestedIndent);
      values.push(childValue);
      index = nextIndex;
      continue;
    }
    if (itemText) {
      values.push(parseScalar(itemText));
      index += 1;
      continue;
    }
    const childIndex = findNextMeaningfulLine(lines, index + 1);
    if (childIndex === -1) {
      values.push("");
      index += 1;
      continue;
    }
    const childIndent = countIndent(lines[childIndex]);
    const [childValue, nextIndex] = parseNode(lines, index + 1, childIndent);
    values.push(childValue);
    index = nextIndex;
  }
  return [values, index];
}

function parseObject(
  lines: string[],
  startIndex: number,
  indent: number,
): [{ [key: string]: YamlValue }, number] {
  const values: { [key: string]: YamlValue } = {};
  let index = startIndex;
  while (index < lines.length) {
    const rawLine = lines[index];
    const stripped = stripComment(rawLine);
    const trimmed = stripped.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }
    const lineIndent = countIndent(rawLine);
    if (lineIndent < indent) {
      break;
    }
    if (lineIndent > indent) {
      throw new Error(`Unexpected indentation in YAML object at line ${index + 1}`);
    }
    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      throw new Error(`Invalid YAML key/value entry at line ${index + 1}`);
    }
    const key = trimmed.slice(0, separator).trim();
    const remainder = trimmed.slice(separator + 1).trim();

    // ── Block scalar indicators: `>` (folded) and `|` (literal) ──
    if (remainder === ">" || remainder === "|") {
      const folded = remainder === ">";
      const scalarLines: string[] = [];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const scalarRaw = lines[cursor];
        const scalarTrimmed = stripComment(scalarRaw).trim();
        if (!scalarTrimmed) {
          scalarLines.push("");
          cursor += 1;
          continue;
        }
        const scalarIndent = countIndent(scalarRaw);
        if (scalarIndent <= indent) {
          break;
        }
        scalarLines.push(scalarTrimmed);
        cursor += 1;
      }
      values[key] = folded
        ? scalarLines.join(" ").replace(/ {2,}/g, " ").trim()
        : scalarLines.join("\n").trim();
      index = cursor;
      continue;
    }

    if (remainder) {
      values[key] = parseScalar(remainder);
      index += 1;
      continue;
    }
    const childIndex = findNextMeaningfulLine(lines, index + 1);
    if (childIndex === -1) {
      values[key] = "";
      index += 1;
      continue;
    }
    const childIndent = countIndent(lines[childIndex]);
    if (childIndent <= lineIndent) {
      values[key] = "";
      index += 1;
      continue;
    }
    const [childValue, nextIndex] = parseNode(lines, index + 1, childIndent);
    values[key] = childValue;
    index = nextIndex;
  }
  return [values, index];
}

export function parseYamlDocument(text: string): Record<string, YamlValue> {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return {};
  }
  const lines = normalized.split("\n");
  const [value] = parseNode(lines, 0, 0);
  if (Array.isArray(value) || value === null || typeof value !== "object") {
    throw new Error("Top-level YAML document must be an object");
  }
  return value;
}

function needsQuotes(value: string): boolean {
  return value === "" || /[:#\-\[\]\{\},]|^\s|\s$/.test(value);
}

function stringifyScalar(value: string | number | boolean | null): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return needsQuotes(value) ? JSON.stringify(value) : value;
  }
  return String(value);
}

export function stringifyYamlDocument(value: YamlValue, indent = 0): string {
  const spacing = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${spacing}[]`;
    }
    return value
      .map((item) => {
        if (item !== null && typeof item === "object") {
          const nested = stringifyYamlDocument(item, indent + 2);
          return `${spacing}-\n${nested}`;
        }
        return `${spacing}- ${stringifyScalar(item as string | number | boolean | null)}`;
      })
      .join("\n");
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return `${spacing}{}`;
    }
    return entries
      .map(([key, item]) => {
        if (Array.isArray(item) || (item !== null && typeof item === "object")) {
          const nested = stringifyYamlDocument(item, indent + 2);
          return `${spacing}${key}:\n${nested}`;
        }
        return `${spacing}${key}: ${stringifyScalar(item as string | number | boolean | null)}`;
      })
      .join("\n");
  }
  return `${spacing}${stringifyScalar(value)}`;
}
