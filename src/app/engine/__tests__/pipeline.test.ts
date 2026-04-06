import { describe, expect, it } from "vitest";
import { runParametricPipeline } from "../pipeline";
import { validateFdmSpec } from "../validation";
import { compileScad } from "../../engine/scad-interpreter";

describe("parametric pipeline", () => {
  it("builds fdm draft spec and scad", () => {
    const result = runParametricPipeline({
      prompt: "Soporte de telefono funcional para escritorio",
      engine: "fdm",
      qualityProfile: "draft",
    });

    expect(result.spec.version).toBe("1.0");
    expect(result.spec.engine).toBe("fdm");
    expect(result.spec.qualityProfile).toBe("draft");
    expect(result.output.scad).toContain("quality_level = 0");
    expect(result.output.scad).toContain("$fn = quality_level == 1 ? 72 : 24;");

    const validation = validateFdmSpec(result.spec);
    expect(validation.valid).toBe(true);
  });

  it("builds organic final spec and scad", () => {
    const result = runParametricPipeline({
      prompt: "Jarron decorativo con ondas",
      engine: "organic",
      qualityProfile: "final",
    });

    expect(result.spec.engine).toBe("organic");
    expect(result.spec.qualityProfile).toBe("final");
    expect(result.output.scad).toContain("quality_level = 1");
    expect(result.output.scad).toContain("$fn = quality_level == 1 ? 96 : 32;");
  });

  it("respects explicit family hint", () => {
    const result = runParametricPipeline({
      prompt: "Necesito un soporte, pero quiero caja",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "storage-box",
    });

    expect(result.spec.family).toBe("storage-box");
    expect(result.output.modelName).toContain("Caja");
  });

  it("applies numeric parameter overrides to generated SCAD", () => {
    const result = runParametricPipeline({
      prompt: "Caja utilitaria parametrica",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "storage-box",
      parameterOverrides: {
        width: 140,
        depth: 88,
      },
    });

    expect(result.output.scad).toContain("width = 140");
    expect(result.output.scad).toContain("depth = 88");
  });

  it("builds drawer organizer tray from explicit family hint", () => {
    const result = runParametricPipeline({
      prompt: "Bandeja organizadora para cajon",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "drawer-organizer-tray",
      parameterOverrides: {
        cells_x: 4,
        cells_y: 3,
      },
    });

    expect(result.spec.family).toBe("drawer-organizer-tray");
    expect(result.output.modelName).toContain("Bandeja");
    expect(result.output.scad).toContain("cells_x = 4");
    expect(result.output.scad).toContain("cells_y = 3");
  });

  it("detects drawer organizer tray prompts before generic utility hook fallback", () => {
    const result = runParametricPipeline({
      prompt: "Organizador modular para cajon con divisores",
      engine: "fdm",
      qualityProfile: "draft",
    });

    expect(result.spec.family).toBe("drawer-organizer-tray");
  });

  it("builds planter drip system from explicit family hint", () => {
    const result = runParametricPipeline({
      prompt: "Maceta con bandeja de goteo para interior",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "planter-drip-system",
      parameterOverrides: {
        top_d: 150,
        drain_holes: 6,
      },
    });

    expect(result.spec.family).toBe("planter-drip-system");
    expect(result.output.modelName).toContain("Maceta");
    expect(result.output.scad).toContain("top_d = 150");
    expect(result.output.scad).toContain("drain_holes = 6");
  });

  it("detects planter prompts before generic stand or hook fallback", () => {
    const result = runParametricPipeline({
      prompt: "Maceta con bandeja de goteo para hierbas",
      engine: "fdm",
      qualityProfile: "draft",
    });

    expect(result.spec.family).toBe("planter-drip-system");
  });

  it("builds lamp shade kit from explicit family hint", () => {
    const result = runParametricPipeline({
      prompt: "Pantalla para lampara con kit led",
      engine: "fdm",
      qualityProfile: "final",
      familyHint: "lamp-shade-kit",
      parameterOverrides: {
        seat_d: 46,
        vent_rows: 5,
      },
    });

    expect(result.spec.family).toBe("lamp-shade-kit");
    expect(result.output.modelName).toContain("Pantalla");
    expect(result.output.scad).toContain("seat_d = 46");
    expect(result.output.scad).toContain("vent_rows = 5");
  });

  it("detects lamp prompts for fdm product family before stand fallback", () => {
    const result = runParametricPipeline({
      prompt: "Pantalla de lampara para kit de luz con ventilacion",
      engine: "fdm",
      qualityProfile: "final",
    });

    expect(result.spec.family).toBe("lamp-shade-kit");
  });

  it("builds text keychain tag with string and bool overrides", () => {
    const result = runParametricPipeline({
      prompt: "Llavero personalizado con texto para regalar",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "text-keychain-tag",
      parameterOverrides: {
        label_text: "MATE CLUB",
        engraved: true,
      },
    });

    expect(result.spec.family).toBe("text-keychain-tag");
    expect(result.output.modelName).toContain("Llavero");
    expect(result.output.scad).toContain('label_text = "MATE CLUB"');
    expect(result.output.scad).toContain("engraved = true");
    expect(result.output.scad).toContain("linear_extrude(height = text_h + 0.02)");

    const compiled = compileScad(result.output.scad);
    expect(compiled.geometry.polygons.length).toBeGreaterThan(100);
  });

  it("detects keychain prompts before generic hook fallback", () => {
    const result = runParametricPipeline({
      prompt: "Llavero con nombre y ojal lateral",
      engine: "fdm",
      qualityProfile: "draft",
    });

    expect(result.spec.family).toBe("text-keychain-tag");
  });

  it("builds nameplate pro with text overrides", () => {
    const result = runParametricPipeline({
      prompt: "Placa de escritorio con nombre",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "nameplate-pro",
      parameterOverrides: {
        label_text: "MARTIN DAGUERRE STUDIO LAB",
        border: true,
      },
    });

    expect(result.spec.family).toBe("nameplate-pro");
    expect(result.output.modelName).toContain("Nameplate");
    expect(result.output.scad).toContain('label_text = "MARTIN DAGUERRE STUDIO LAB"');
    expect(result.output.scad).toContain('primary_text = "MARTIN DAGUERRE"');
    expect(result.output.scad).toContain('secondary_text = "STUDIO LAB"');
    expect(result.output.scad).toContain("line_count = 2");
    expect(result.output.scad).toContain("border = true");
    expect(result.output.scad).toContain("text_fit = min(1");
    expect(result.output.scad).toContain("front_text_solid");
    expect(result.output.scad).toContain("linear_extrude(height = height_override)");

    const compiled = compileScad(result.output.scad);
    expect(compiled.geometry.polygons.length).toBeGreaterThan(200);
  });

  it("detects nameplate prompts before generic stand fallback", () => {
    const result = runParametricPipeline({
      prompt: "Nameplate de escritorio con marco frontal",
      engine: "fdm",
      qualityProfile: "draft",
    });

    expect(result.spec.family).toBe("nameplate-pro");
  });

  it("builds peg label system with clip parameters", () => {
    const result = runParametricPipeline({
      prompt: "Etiqueta funcional para taller",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "peg-label-system",
      parameterOverrides: {
        label_text: "DRILL BITS 6MM BOX",
        hook_gap: 5.4,
      },
    });

    expect(result.spec.family).toBe("peg-label-system");
    expect(result.output.modelName).toContain("Peg Label");
    expect(result.output.scad).toContain('label_text = "DRILL BITS 6MM BOX"');
    expect(result.output.scad).toContain('primary_text = "DRILL BITS"');
    expect(result.output.scad).toContain('secondary_text = "6MM BOX"');
    expect(result.output.scad).toContain("line_count = 2");
    expect(result.output.scad).toContain("hook_gap = 5.4");
    expect(result.output.scad).toContain("front_text_solid");
    expect(result.output.scad).toContain("linear_extrude(height = height_override)");

    const compiled = compileScad(result.output.scad);
    expect(compiled.geometry.polygons.length).toBeGreaterThan(200);
  });

  it("detects peg label prompts before generic keychain fallback", () => {
    const result = runParametricPipeline({
      prompt: "Workshop pegboard bin label with clips",
      engine: "fdm",
      qualityProfile: "draft",
    });

    expect(result.spec.family).toBe("peg-label-system");
  });

  it("builds threaded jar with helical lid", () => {
    const result = runParametricPipeline({
      prompt: "Frasco roscado para especias",
      engine: "fdm",
      qualityProfile: "final",
      familyHint: "threaded-jar",
      parameterOverrides: {
        body_d: 78,
        thread_depth: 2.1,
        thread_clearance: 0.4,
        fit_slop: 0.18,
        lead_in: 1.6,
        lid_knurl: 20,
      },
    });

    expect(result.spec.family).toBe("threaded-jar");
    expect(result.output.modelName).toContain("Frasco");
    expect(result.output.scad).toContain("body_d = 78");
    expect(result.output.scad).toContain("thread_depth_nominal = 2.1");
    expect(result.output.scad).toContain("thread_clearance = 0.4");
    expect(result.output.scad).toContain("fit_slop = 0.18");
    expect(result.output.scad).toContain("lead_in = 1.6");
    expect(result.output.scad).toContain("lid_knurl = 20");
    expect(result.output.scad).toContain("effective_thread_clearance = thread_clearance + fit_slop");
    expect(result.output.scad).toContain("depth * 0.42");

    const compiled = compileScad(result.output.scad);
    expect(compiled.geometry.polygons.length).toBeGreaterThan(500);
  });

  it("detects threaded jar prompts before generic storage box fallback", () => {
    const result = runParametricPipeline({
      prompt: "Threaded jar with screw lid for spices",
      engine: "fdm",
      qualityProfile: "draft",
    });

    expect(result.spec.family).toBe("threaded-jar");
  });
});
