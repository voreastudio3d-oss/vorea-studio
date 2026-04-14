/**
 * FDM validation tests.
 */
import { describe, it, expect } from "vitest";
import { validateFdmSpec } from "../validation";
import type { InstructionSpecV1 } from "../instruction-spec";

function makeSpec(overrides?: Partial<InstructionSpecV1>): InstructionSpecV1 {
  return {
    version: "1.0",
    prompt: "Generate a rounded box",
    family: "rounded-box",
    engine: "fdm",
    intent: "generate",
    qualityProfile: "balanced",
    printProfile: "fdm",
    tags: ["box"],
    constraints: {
      min_wall_thickness_mm: 1.5,
      min_base_thickness_mm: 0.8,
    },
    warnings: [],
    parameters: [
      { name: "quality_level", type: "string", defaultValue: "medium", description: "Quality" },
      { name: "width", type: "number", defaultValue: 50, description: "Width" },
    ],
    scadTemplate: "cube([width, width, width]);",
    ...overrides,
  } as InstructionSpecV1;
}

describe("validateFdmSpec", () => {
  it("valid spec returns no errors", () => {
    const result = validateFdmSpec(makeSpec());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("warns when wall thickness < 1.2mm", () => {
    const result = validateFdmSpec(
      makeSpec({ constraints: { min_wall_thickness_mm: 0.8, min_base_thickness_mm: 0.8 } })
    );
    expect(result.valid).toBe(true); // warning, not error
    expect(result.warnings).toContain("Espesor minimo menor a 1.2mm puede fallar en FDM.");
  });

  it("errors when wall thickness is 0 or negative", () => {
    const result = validateFdmSpec(
      makeSpec({ constraints: { min_wall_thickness_mm: 0, min_base_thickness_mm: 0.8 } })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("errors when printProfile is not fdm", () => {
    const result = validateFdmSpec(makeSpec({ printProfile: "sla" } as any));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("printProfile invalido para este validador.");
  });

  it("errors when quality_level parameter is missing", () => {
    const result = validateFdmSpec(
      makeSpec({ parameters: [{ name: "width", type: "number", defaultValue: 50, description: "" }] })
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Falta parametro quality_level.");
  });

  it("warns for lamp-shell organic", () => {
    const result = validateFdmSpec(
      makeSpec({ engine: "organic", family: "lamp-shell" })
    );
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("lampara"))).toBe(true);
  });
});
