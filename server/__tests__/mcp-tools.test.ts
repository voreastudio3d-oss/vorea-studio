import { describe, expect, it } from "vitest";
import { executeMcpInternalTool } from "../mcp-tools";

describe("internal mcp tools", () => {
  it("returns stable contract for generate_spec", () => {
    const result = executeMcpInternalTool("generate_spec", {
      prompt: "Caja organizadora para piezas",
      engine: "fdm",
      qualityProfile: "draft",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tool).toBe("generate_spec");
      expect(result.output.spec).toBeDefined();
    }
  });

  it("supports familyHint in generate_spec", () => {
    const result = executeMcpInternalTool("generate_spec", {
      prompt: "modelo utilitario",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "phone-stand",
      parameterOverrides: {
        angle: 74,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const spec = result.output.spec as { family: string; parameters: Array<{ name: string; defaultValue: number }> };
      expect(spec.family).toBe("phone-stand");
      const angle = spec.parameters.find((item) => item.name === "angle");
      expect(angle?.defaultValue).toBe(74);
    }
  });

  it("supports drawer organizer tray family in generate_spec", () => {
    const result = executeMcpInternalTool("generate_spec", {
      prompt: "bandeja organizadora para cajon",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "drawer-organizer-tray",
      parameterOverrides: {
        cells_x: 5,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const spec = result.output.spec as { family: string; parameters: Array<{ name: string; defaultValue: number }> };
      expect(spec.family).toBe("drawer-organizer-tray");
      const cellsX = spec.parameters.find((item) => item.name === "cells_x");
      expect(cellsX?.defaultValue).toBe(5);
    }
  });

  it("supports planter drip system family in generate_spec", () => {
    const result = executeMcpInternalTool("generate_spec", {
      prompt: "maceta con bandeja",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "planter-drip-system",
      parameterOverrides: {
        tray_depth: 18,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const spec = result.output.spec as { family: string; parameters: Array<{ name: string; defaultValue: number }> };
      expect(spec.family).toBe("planter-drip-system");
      const trayDepth = spec.parameters.find((item) => item.name === "tray_depth");
      expect(trayDepth?.defaultValue).toBe(18);
    }
  });

  it("supports lamp shade kit family in generate_spec", () => {
    const result = executeMcpInternalTool("generate_spec", {
      prompt: "pantalla para lampara con kit",
      engine: "fdm",
      qualityProfile: "final",
      familyHint: "lamp-shade-kit",
      parameterOverrides: {
        seat_d: 44,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const spec = result.output.spec as { family: string; parameters: Array<{ name: string; defaultValue: number }> };
      expect(spec.family).toBe("lamp-shade-kit");
      const seat = spec.parameters.find((item) => item.name === "seat_d");
      expect(seat?.defaultValue).toBe(44);
    }
  });

  it("supports text keychain tag family in generate_spec", () => {
    const result = executeMcpInternalTool("generate_spec", {
      prompt: "llavero con nombre",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "text-keychain-tag",
      parameterOverrides: {
        label_text: "MATE",
        engraved: true,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const spec = result.output.spec as {
        family: string;
        parameters: Array<{ name: string; defaultValue: number | string | boolean }>;
      };
      expect(spec.family).toBe("text-keychain-tag");
      const label = spec.parameters.find((item) => item.name === "label_text");
      const engraved = spec.parameters.find((item) => item.name === "engraved");
      expect(label?.defaultValue).toBe("MATE");
      expect(engraved?.defaultValue).toBe(true);
    }
  });

  it("supports nameplate pro family in generate_spec", () => {
    const result = executeMcpInternalTool("generate_spec", {
      prompt: "placa de escritorio",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "nameplate-pro",
      parameterOverrides: {
        label_text: "VOREA LAB",
        stand_angle: 76,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const spec = result.output.spec as {
        family: string;
        parameters: Array<{ name: string; defaultValue: number | string | boolean }>;
      };
      expect(spec.family).toBe("nameplate-pro");
      const label = spec.parameters.find((item) => item.name === "label_text");
      const angle = spec.parameters.find((item) => item.name === "stand_angle");
      expect(label?.defaultValue).toBe("VOREA LAB");
      expect(angle?.defaultValue).toBe(76);
    }
  });

  it("supports peg label system family in generate_spec", () => {
    const result = executeMcpInternalTool("generate_spec", {
      prompt: "etiqueta de taller",
      engine: "fdm",
      qualityProfile: "draft",
      familyHint: "peg-label-system",
      parameterOverrides: {
        label_text: "DRILL 6MM",
        hook_gap: 5,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const spec = result.output.spec as {
        family: string;
        parameters: Array<{ name: string; defaultValue: number | string | boolean }>;
      };
      expect(spec.family).toBe("peg-label-system");
      const label = spec.parameters.find((item) => item.name === "label_text");
      const gap = spec.parameters.find((item) => item.name === "hook_gap");
      expect(label?.defaultValue).toBe("DRILL 6MM");
      expect(gap?.defaultValue).toBe(5);
    }
  });

  it("supports threaded jar family in generate_spec", () => {
    const result = executeMcpInternalTool("generate_spec", {
      prompt: "frasco roscado",
      engine: "fdm",
      qualityProfile: "final",
      familyHint: "threaded-jar",
      parameterOverrides: {
        body_d: 80,
        thread_pitch: 4.5,
        thread_depth: 2.05,
        thread_clearance: 0.4,
        fit_slop: 0.16,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const spec = result.output.spec as {
        family: string;
        parameters: Array<{ name: string; defaultValue: number | string | boolean }>;
      };
      expect(spec.family).toBe("threaded-jar");
      const body = spec.parameters.find((item) => item.name === "body_d");
      const pitch = spec.parameters.find((item) => item.name === "thread_pitch");
      const depth = spec.parameters.find((item) => item.name === "thread_depth");
      const clearance = spec.parameters.find((item) => item.name === "thread_clearance");
      const fitSlop = spec.parameters.find((item) => item.name === "fit_slop");
      expect(body?.defaultValue).toBe(80);
      expect(pitch?.defaultValue).toBe(4.5);
      expect(depth?.defaultValue).toBe(2.05);
      expect(clearance?.defaultValue).toBe(0.4);
      expect(fitSlop?.defaultValue).toBe(0.16);
    }
  });

  it("returns validation error for generate_scad without spec", () => {
    const result = executeMcpInternalTool("generate_scad", {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns preview payload for compile_preview", () => {
    const result = executeMcpInternalTool("compile_preview", {
      scad: "quality_level = 0; // [0:1:1]\n$fn = quality_level == 1 ? 72 : 24;\ncube([10,10,10]);",
      quality: "draft",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.level).toBeDefined();
      expect(result.output.estimatedMs).toBeDefined();
    }
  });
});
