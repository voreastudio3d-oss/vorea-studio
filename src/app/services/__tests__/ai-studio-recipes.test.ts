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

  it("sorts recipes by most recent updatedAt first", () => {
    localStorage.setItem(
      "vorea_ai_studio_recipes:user-sort",
      JSON.stringify([
        {
          id: "older",
          version: "1.0",
          name: "Older",
          prompt: "Older prompt",
          engine: "fdm",
          quality: "draft",
          familyHint: "storage-box",
          parameterOverrides: {},
          createdAt: "2026-03-20T10:00:00.000Z",
          updatedAt: "2026-03-20T10:00:00.000Z",
        },
        {
          id: "newer",
          version: "1.0",
          name: "Newer",
          prompt: "Newer prompt",
          engine: "fdm",
          quality: "draft",
          familyHint: "storage-box",
          parameterOverrides: {},
          createdAt: "2026-03-21T10:00:00.000Z",
          updatedAt: "2026-03-21T10:00:00.000Z",
        },
      ])
    );

    expect(AiStudioRecipes.list("user-sort").map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("falls back to a default name and trims prompt values when saving", () => {
    const saved = AiStudioRecipes.save("user-trim", {
      name: "   ",
      prompt: "  Necesito una caja apilable  ",
      engine: "fdm",
      quality: "draft",
      familyHint: "storage-box",
      parameterOverrides: { width: 120 },
    });

    expect(saved.name).toBe("Recipe sin nombre");
    expect(saved.prompt).toBe("Necesito una caja apilable");
  });

  it("removes a recipe by id without touching the others", () => {
    const owner = "user-remove";
    const first = AiStudioRecipes.save(owner, {
      name: "Caja",
      prompt: "Caja modular",
      engine: "fdm",
      quality: "draft",
      familyHint: "storage-box",
      parameterOverrides: {},
    });
    const second = AiStudioRecipes.save(owner, {
      name: "Gancho",
      prompt: "Gancho resistente",
      engine: "fdm",
      quality: "draft",
      familyHint: "utility-hook",
      parameterOverrides: {},
    });

    AiStudioRecipes.remove(owner, first.id);

    expect(AiStudioRecipes.list(owner).map((item) => item.id)).toEqual([second.id]);
  });

  it("returns an empty list when the stored value is not an array", () => {
    localStorage.setItem("vorea_ai_studio_recipes:user-invalid", JSON.stringify({ id: "not-an-array" }));

    expect(AiStudioRecipes.list("user-invalid")).toEqual([]);
  });

  it("filters out malformed or stale guest recipes", () => {
    localStorage.setItem(
      "vorea_ai_studio_recipes:guest",
      JSON.stringify([
        {
          id: "invalid-version",
          version: "0.9",
          name: "Legacy",
          prompt: "Legacy prompt",
          engine: "fdm",
          quality: "draft",
          familyHint: "storage-box",
          parameterOverrides: {},
          createdAt: "2026-03-20T10:00:00.000Z",
          updatedAt: "2026-03-20T10:00:00.000Z",
        },
        {
          id: "invalid-date",
          version: "1.0",
          name: "Broken",
          prompt: "Broken prompt",
          engine: "fdm",
          quality: "draft",
          familyHint: "storage-box",
          parameterOverrides: {},
          createdAt: "2026-03-20T10:00:00.000Z",
          updatedAt: "not-a-date",
        },
        {
          id: "valid",
          version: "1.0",
          name: "Valid",
          prompt: "Valid prompt",
          engine: "fdm",
          quality: "draft",
          familyHint: "storage-box",
          parameterOverrides: {},
          createdAt: "2026-03-20T10:00:00.000Z",
          updatedAt: "2026-03-20T10:00:00.000Z",
        },
      ])
    );

    const mockNow = vi.spyOn(Date, "now").mockReturnValue(new Date("2026-03-23T12:00:00.000Z").getTime());
    expect(AiStudioRecipes.list("guest").map((item) => item.id)).toEqual(["valid"]);
    mockNow.mockRestore();
  });

  it("returns null for invalid recipe json payloads", () => {
    expect(AiStudioRecipes.parseFromJson("not-json")).toBeNull();
    expect(AiStudioRecipes.parseFromJson(JSON.stringify({ name: "Only name" }))).toBeNull();
    expect(
      AiStudioRecipes.parseFromJson(
        JSON.stringify({
          name: "Bad engine",
          prompt: "Prompt",
          engine: "sla",
          quality: "draft",
          familyHint: "storage-box",
        })
      )
    ).toBeNull();
    expect(
      AiStudioRecipes.parseFromJson(
        JSON.stringify({
          name: "Bad quality",
          prompt: "Prompt",
          engine: "fdm",
          quality: "preview",
          familyHint: "storage-box",
        })
      )
    ).toBeNull();
  });

  it("defaults parameterOverrides to an empty object when omitted in imported json", () => {
    const parsed = AiStudioRecipes.parseFromJson(
      JSON.stringify({
        name: "Caja",
        prompt: "Caja simple",
        engine: "fdm",
        quality: "draft",
        familyHint: "storage-box",
      })
    );

    expect(parsed).toMatchObject({
      name: "Caja",
      prompt: "Caja simple",
      parameterOverrides: {},
    });
  });

  it("returns export json with version and exportedAt metadata", () => {
    const exported = JSON.parse(
      AiStudioRecipes.toExportJson({
        name: "Recipe",
        prompt: "Prompt",
        engine: "fdm",
        quality: "draft",
        familyHint: "storage-box",
        parameterOverrides: { width: 80 },
      })
    );

    expect(exported.version).toBe("1.0");
    expect(typeof exported.exportedAt).toBe("string");
    expect(exported.parameterOverrides).toEqual({ width: 80 });
  });

  it("ignores storage write failures", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() =>
      AiStudioRecipes.save("user-quota", {
        name: "Recipe",
        prompt: "Prompt",
        engine: "fdm",
        quality: "draft",
        familyHint: "storage-box",
        parameterOverrides: {},
      })
    ).not.toThrow();

    setItemSpy.mockRestore();
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
