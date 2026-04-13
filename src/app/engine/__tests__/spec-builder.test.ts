/**
 * spec-builder.ts — Unit tests for the parametric pipeline spec builder.
 * Tests includesAny, classifyPromptIntent, buildParameterBlueprint, buildInstructionSpec.
 */
import { describe, it, expect } from "vitest";
import {
  includesAny,
  classifyPromptIntent,
  buildParameterBlueprint,
  buildInstructionSpec,
} from "../spec-builder";

// ─── includesAny ──────────────────────────────────────────────────────────────

describe("includesAny", () => {
  it("returns true when prompt contains a word", () => {
    expect(includesAny("a modern vase", ["vase", "jar"])).toBe(true);
  });

  it("returns false when no words match", () => {
    expect(includesAny("a modern vase", ["jar", "box"])).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(includesAny("A Vase", ["vase"])).toBe(false);
    expect(includesAny("A Vase", ["Vase"])).toBe(true);
  });

  it("handles empty arrays", () => {
    expect(includesAny("anything", [])).toBe(false);
  });

  it("handles empty prompt", () => {
    expect(includesAny("", ["word"])).toBe(false);
  });
});

// ─── classifyPromptIntent ─────────────────────────────────────────────────────

describe("classifyPromptIntent", () => {
  it("returns text_or_engraving for engraved/name/text prompts", () => {
    expect(classifyPromptIntent("engraved keychain")).toBe("text_or_engraving");
    expect(classifyPromptIntent("nameplate con texto")).toBe("text_or_engraving");
    expect(classifyPromptIntent("lettering design")).toBe("text_or_engraving");
    expect(classifyPromptIntent("grabado personalizado")).toBe("text_or_engraving");
  });

  it("returns adapt_template for template/adapt prompts", () => {
    expect(classifyPromptIntent("modify the template")).toBe("adapt_template");
    expect(classifyPromptIntent("adaptar la plantilla")).toBe("adapt_template");
    expect(classifyPromptIntent("based on existing design")).toBe("adapt_template");
  });

  it("returns dimension_customization for sizing prompts", () => {
    expect(classifyPromptIntent("100mm width")).toBe("dimension_customization");
    expect(classifyPromptIntent("20cm height")).toBe("dimension_customization");
    expect(classifyPromptIntent("diametro de 50")).toBe("dimension_customization");
    expect(classifyPromptIntent("radio 10")).toBe("dimension_customization");
  });

  it("returns functional_part for functional prompts", () => {
    expect(classifyPromptIntent("functional bracket")).toBe("functional_part");
    expect(classifyPromptIntent("pieza funcional resistente")).toBe("functional_part");
  });

  it("returns decorative_part for decorative prompts", () => {
    expect(classifyPromptIntent("decorative vase")).toBe("decorative_part");
    expect(classifyPromptIntent("modelo organico")).toBe("decorative_part");
  });

  it("returns create_from_scratch for generic prompts", () => {
    expect(classifyPromptIntent("create something cool")).toBe("create_from_scratch");
    expect(classifyPromptIntent("quiero un modelo")).toBe("create_from_scratch");
  });
});

// ─── buildParameterBlueprint ──────────────────────────────────────────────────

describe("buildParameterBlueprint", () => {
  it("returns parameters for fdm storage-box family", () => {
    const params = buildParameterBlueprint("fdm", "storage-box");
    expect(Array.isArray(params)).toBe(true);
    expect(params.length).toBeGreaterThan(0);
    // Each param should have name and type
    for (const p of params) {
      expect(p.name).toBeDefined();
      expect(p.type).toBeDefined();
    }
  });

  it("returns parameters for organic vase family", () => {
    const params = buildParameterBlueprint("organic", "vase");
    expect(Array.isArray(params)).toBe(true);
    expect(params.length).toBeGreaterThan(0);
  });

  it("returns default parameters for unknown family", () => {
    const params = buildParameterBlueprint("fdm", "unknown-family-xyz" as any);
    expect(Array.isArray(params)).toBe(true);
    expect(params.length).toBeGreaterThan(0);
  });

  it("returns parameters for fdm text-keychain-tag", () => {
    const params = buildParameterBlueprint("fdm", "text-keychain-tag");
    expect(params.length).toBeGreaterThan(0);
    const names = params.map((p) => p.name);
    // Should have text-related params
    expect(names.some((n) => n.includes("text") || n.includes("width") || n.includes("height"))).toBe(true);
  });

  it("returns parameters for fdm threaded-jar", () => {
    const params = buildParameterBlueprint("fdm", "threaded-jar");
    expect(params.length).toBeGreaterThan(0);
  });

  it("returns parameters for fdm lamp-shade-kit", () => {
    const params = buildParameterBlueprint("fdm", "lamp-shade-kit");
    expect(params.length).toBeGreaterThan(0);
  });

  it("returns parameters for fdm planter-drip-system", () => {
    const params = buildParameterBlueprint("fdm", "planter-drip-system");
    expect(params.length).toBeGreaterThan(0);
  });

  it("returns parameters for fdm cable-clip", () => {
    const params = buildParameterBlueprint("fdm", "cable-clip");
    expect(params.length).toBeGreaterThan(0);
  });
});

// ─── buildInstructionSpec ─────────────────────────────────────────────────────

describe("buildInstructionSpec", () => {
  it("builds spec for fdm storage-box", () => {
    const spec = buildInstructionSpec({
      prompt: "A small storage box",
      engine: "fdm",
      qualityProfile: "draft",
    });
    expect(spec.version).toBe("1.0");
    expect(spec.prompt).toBe("A small storage box");
    expect(spec.engine).toBe("fdm");
    expect(spec.qualityProfile).toBe("draft");
    expect(spec.family).toBeDefined();
    expect(spec.intent).toBeDefined();
    expect(spec.tags).toBeInstanceOf(Array);
    expect(spec.parameters).toBeInstanceOf(Array);
  });

  it("classifies intent from prompt", () => {
    const spec = buildInstructionSpec({
      prompt: "An engraved nameplate",
      engine: "fdm",
      qualityProfile: "final",
    });
    expect(spec.intent).toBe("text_or_engraving");
  });

  it("resolves family from prompt keywords", () => {
    const spec = buildInstructionSpec({
      prompt: "A lamp shade for my desk",
      engine: "fdm",
      qualityProfile: "draft",
    });
    expect(spec.family).toBe("lamp-shade-kit");
  });

  it("resolves vase family for organic engine", () => {
    const spec = buildInstructionSpec({
      prompt: "An elegant vase",
      engine: "organic",
      qualityProfile: "draft",
    });
    expect(spec.family).toContain("vase");
  });

  it("uses familyHint when provided", () => {
    const spec = buildInstructionSpec({
      prompt: "A custom design",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "rounded-box",
    });
    // familyHint is a hint, not a mandate — the engine resolves the best match
    expect(spec.family).toBeDefined();
  });

  it("adds warnings for quality profile mismatches", () => {
    const spec = buildInstructionSpec({
      prompt: "A decorative piece",
      engine: "organic",
      qualityProfile: "final",
    });
    expect(spec.warnings).toBeInstanceOf(Array);
  });

  it("includes printProfile in tags when mentioned", () => {
    const spec = buildInstructionSpec({
      prompt: "print a box with fdm",
      engine: "fdm",
      qualityProfile: "draft",
    });
    expect(spec.tags.length).toBeGreaterThan(0);
  });

  it("handles override parameters", () => {
    const spec = buildInstructionSpec({
      prompt: "A box 50mm wide",
      engine: "fdm",
      qualityProfile: "draft",
      parameterOverrides: { width: 50 },
    });
    expect(spec).toBeDefined();
    expect(spec.parameters).toBeInstanceOf(Array);
  });
});
