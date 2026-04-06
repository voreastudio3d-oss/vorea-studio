import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiStudioHistory } from "../ai-studio-history";

describe("ai studio history service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and lists history entries per owner", () => {
    const owner = "user-a";
    AiStudioHistory.save(owner, {
      prompt: "Caja modular",
      engine: "fdm",
      quality: "draft",
      modelName: "Caja Utilitaria",
      scadCode: "cube([10, 20, 30]);",
      spec: {
        version: "1.0",
        prompt: "Caja modular",
        engine: "fdm",
        family: "storage-box",
        intent: "create_from_scratch",
        qualityProfile: "draft",
        printProfile: "fdm",
        tags: ["caja"],
        constraints: { min_wall_thickness_mm: 1.6 },
        parameters: [],
        warnings: [],
      },
      validation: {
        valid: true,
        errors: [],
        warnings: [],
      },
      compilePreview: {
        quality: "draft",
        score: 14,
        level: "light",
        estimatedMs: 196,
        metrics: {
          primitives: 1,
          booleans: 0,
          loops: 0,
          detailHints: 0,
        },
        warnings: [],
      },
    });

    const listed = AiStudioHistory.list(owner);
    expect(listed).toHaveLength(1);
    expect(listed[0].version).toBe("1.1");
    expect(listed[0].prompt).toBe("Caja modular");
    expect(listed[0].modelName).toBe("Caja Utilitaria");
    expect(listed[0].familyHint).toBe("storage-box");
    expect(listed[0].parameterOverrides).toEqual({});
    expect(listed[0].compilePreview.level).toBe("light");
  });

  it("updates existing history entry keeping createdAt", () => {
    const owner = "user-b";
    const first = AiStudioHistory.save(owner, {
      prompt: "Lampara organica",
      engine: "organic",
      quality: "draft",
      modelName: "Lampara Base",
      scadCode: "cylinder(h=40, r=12);",
      spec: {
        version: "1.0",
        prompt: "Lampara organica",
        engine: "organic",
        family: "lamp-shell",
        intent: "decorative_part",
        qualityProfile: "draft",
        printProfile: "fdm",
        tags: ["lampara"],
        constraints: { min_wall_thickness_mm: 1.8 },
        parameters: [],
        warnings: [],
      },
      validation: {
        valid: true,
        errors: [],
        warnings: ["Revisar puentes largos en geometria de lampara."],
      },
      compilePreview: {
        quality: "draft",
        score: 64,
        level: "medium",
        estimatedMs: 896,
        metrics: {
          primitives: 3,
          booleans: 2,
          loops: 1,
          detailHints: 1,
        },
        warnings: [],
      },
    });

    const updated = AiStudioHistory.save(
      owner,
      {
        prompt: "Lampara organica refinada",
        engine: "organic",
        quality: "final",
        modelName: "Lampara Base v2",
        scadCode: "cylinder(h=60, r=16);",
        spec: {
          version: "1.0",
          prompt: "Lampara organica refinada",
          engine: "organic",
          family: "lamp-shell",
          intent: "decorative_part",
          qualityProfile: "final",
          printProfile: "fdm",
          tags: ["lampara"],
          constraints: { min_wall_thickness_mm: 2.2 },
          parameters: [],
          warnings: [],
        },
        validation: {
          valid: true,
          errors: [],
          warnings: [],
        },
        compilePreview: {
          quality: "final",
          score: 108,
          level: "medium",
          estimatedMs: 1512,
          metrics: {
            primitives: 3,
            booleans: 2,
            loops: 3,
            detailHints: 2,
          },
          warnings: [],
        },
      },
      first.id
    );

    expect(updated.id).toBe(first.id);
    expect(updated.createdAt).toBe(first.createdAt);
    const listed = AiStudioHistory.list(owner);
    expect(listed[0].quality).toBe("final");
    expect(listed[0].modelName).toBe("Lampara Base v2");
    expect(listed[0].version).toBe("1.1");
    expect(listed[0].familyHint).toBe("lamp-shell");
  });

  it("upgrades legacy v1.0 entries with derived family and overrides", () => {
    const owner = "legacy-user";
    localStorage.setItem(
      "vorea_ai_studio_history:legacy-user",
      JSON.stringify([
        {
          id: "legacy-entry",
          version: "1.0",
          prompt: "Soporte de telefono",
          engine: "fdm",
          quality: "draft",
          modelName: "Soporte Base",
          scadCode: "cube([100, 40, 60]);",
          spec: {
            version: "1.0",
            prompt: "Soporte de telefono",
            engine: "fdm",
            family: "phone-stand",
            intent: "functional_part",
            qualityProfile: "draft",
            printProfile: "fdm",
            tags: ["soporte"],
            constraints: { min_wall_thickness_mm: 1.6 },
            parameters: [
              {
                name: "angle",
                type: "number",
                defaultValue: 68,
                min: 45,
                max: 80,
                step: 1,
                description: "Angulo de apoyo",
              },
            ],
            warnings: [],
          },
          validation: {
            valid: true,
            errors: [],
            warnings: [],
          },
          compilePreview: {
            quality: "draft",
            score: 22,
            level: "light",
            estimatedMs: 240,
            metrics: {
              primitives: 2,
              booleans: 0,
              loops: 0,
              detailHints: 0,
            },
            warnings: [],
          },
          createdAt: "2026-03-22T10:00:00.000Z",
          updatedAt: "2026-03-22T10:30:00.000Z",
        },
      ])
    );

    const listed = AiStudioHistory.list(owner);
    expect(listed).toHaveLength(1);
    expect(listed[0].version).toBe("1.1");
    expect(listed[0].familyHint).toBe("phone-stand");
    expect(listed[0].parameterOverrides).toEqual({ angle: 68 });
  });

  it("expires stale guest history entries while keeping recent ones", () => {
    localStorage.setItem(
      "vorea_ai_studio_history:guest",
      JSON.stringify([
        {
          id: "fresh-entry",
          version: "1.1",
          prompt: "Caja reciente",
          engine: "fdm",
          quality: "draft",
          modelName: "Caja reciente",
          scadCode: "cube([10,10,10]);",
          familyHint: "storage-box",
          parameterOverrides: {},
          spec: {
            version: "1.0",
            prompt: "Caja reciente",
            engine: "fdm",
            family: "storage-box",
            intent: "create_from_scratch",
            qualityProfile: "draft",
            printProfile: "fdm",
            tags: [],
            constraints: { min_wall_thickness_mm: 1.6 },
            parameters: [],
            warnings: [],
          },
          validation: { valid: true, errors: [], warnings: [] },
          compilePreview: {
            quality: "draft",
            score: 10,
            level: "light",
            estimatedMs: 100,
            metrics: { primitives: 1, booleans: 0, loops: 0, detailHints: 0 },
            warnings: [],
          },
          createdAt: "2026-03-20T10:00:00.000Z",
          updatedAt: "2026-03-20T10:00:00.000Z",
        },
        {
          id: "stale-entry",
          version: "1.1",
          prompt: "Caja vieja",
          engine: "fdm",
          quality: "draft",
          modelName: "Caja vieja",
          scadCode: "cube([20,20,20]);",
          familyHint: "storage-box",
          parameterOverrides: {},
          spec: {
            version: "1.0",
            prompt: "Caja vieja",
            engine: "fdm",
            family: "storage-box",
            intent: "create_from_scratch",
            qualityProfile: "draft",
            printProfile: "fdm",
            tags: [],
            constraints: { min_wall_thickness_mm: 1.6 },
            parameters: [],
            warnings: [],
          },
          validation: { valid: true, errors: [], warnings: [] },
          compilePreview: {
            quality: "draft",
            score: 10,
            level: "light",
            estimatedMs: 100,
            metrics: { primitives: 1, booleans: 0, loops: 0, detailHints: 0 },
            warnings: [],
          },
          createdAt: "2026-02-20T10:00:00.000Z",
          updatedAt: "2026-02-20T10:00:00.000Z",
        },
      ])
    );

    const clock = globalThis.Date;
    const fixedNow = new clock("2026-03-23T12:00:00.000Z");
    const mockNow = vi.spyOn(Date, "now").mockReturnValue(fixedNow.getTime());

    const listed = AiStudioHistory.list("guest");
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe("fresh-entry");

    mockNow.mockRestore();
  });
});
