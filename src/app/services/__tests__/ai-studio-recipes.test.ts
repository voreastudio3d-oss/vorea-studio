import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiStudioRecipes } from "../ai-studio-recipes";

describe("ai studio recipes service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and lists recipes per owner", () => {
    const owner = "user-a";
    AiStudioRecipes.save(owner, {
      name: "Mi caja",
      prompt: "Caja modular",
      engine: "fdm",
      quality: "draft",
      familyHint: "storage-box",
      parameterOverrides: { width: 120 },
    });

    const listed = AiStudioRecipes.list(owner);
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe("Mi caja");
    expect(listed[0].parameterOverrides.width).toBe(120);
  });

  it("updates existing recipe keeping createdAt", () => {
    const owner = "user-b";
    const first = AiStudioRecipes.save(owner, {
      name: "Base",
      prompt: "Gancho",
      engine: "fdm",
      quality: "draft",
      familyHint: "utility-hook",
      parameterOverrides: { hook_w: 20 },
    });

    const updated = AiStudioRecipes.save(
      owner,
      {
        name: "Base v2",
        prompt: "Gancho reforzado",
        engine: "fdm",
        quality: "final",
        familyHint: "utility-hook",
        parameterOverrides: { hook_w: 32 },
      },
      first.id
    );

    expect(updated.id).toBe(first.id);
    expect(updated.createdAt).toBe(first.createdAt);
    const listed = AiStudioRecipes.list(owner);
    expect(listed[0].name).toBe("Base v2");
    expect(listed[0].quality).toBe("final");
  });

  it("parses exported json format", () => {
    const json = AiStudioRecipes.toExportJson({
      name: "Lampara",
      prompt: "Lampara organica",
      engine: "organic",
      quality: "final",
      familyHint: "lamp-shell",
      parameterOverrides: { holes: 20 },
    });

    const parsed = AiStudioRecipes.parseFromJson(json);
    expect(parsed).not.toBeNull();
    expect(parsed?.engine).toBe("organic");
    expect(parsed?.parameterOverrides.holes).toBe(20);
  });

  it("expires stale guest recipes while preserving recent trial continuity", () => {
    localStorage.setItem(
      "vorea_ai_studio_recipes:guest",
      JSON.stringify([
        {
          id: "fresh-recipe",
          version: "1.0",
          name: "Reciente",
          prompt: "Caja reciente",
          engine: "fdm",
          quality: "draft",
          familyHint: "storage-box",
          parameterOverrides: {},
          createdAt: "2026-03-20T10:00:00.000Z",
          updatedAt: "2026-03-20T10:00:00.000Z",
        },
        {
          id: "stale-recipe",
          version: "1.0",
          name: "Vieja",
          prompt: "Caja vieja",
          engine: "fdm",
          quality: "draft",
          familyHint: "storage-box",
          parameterOverrides: {},
          createdAt: "2026-02-20T10:00:00.000Z",
          updatedAt: "2026-02-20T10:00:00.000Z",
        },
      ])
    );

    const mockNow = vi.spyOn(Date, "now").mockReturnValue(new Date("2026-03-23T12:00:00.000Z").getTime());

    const listed = AiStudioRecipes.list("guest");
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe("fresh-recipe");

    mockNow.mockRestore();
  });
});
