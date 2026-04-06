import { parseYamlDocument } from "./yaml.ts";

export interface ParsedFrontmatter {
  attributes: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
}

export function parseFrontmatter(text: string): ParsedFrontmatter {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return {
      attributes: {},
      body: normalized,
      hasFrontmatter: false,
    };
  }
  const endMarker = normalized.indexOf("\n---\n", 4);
  if (endMarker === -1) {
    throw new Error("Invalid frontmatter: missing closing delimiter");
  }
  const yamlBlock = normalized.slice(4, endMarker);
  const body = normalized.slice(endMarker + 5);
  return {
    attributes: parseYamlDocument(yamlBlock),
    body,
    hasFrontmatter: true,
  };
}
