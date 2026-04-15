/**
 * Tests for ModelProvider and useModel hook.
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { ModelProvider, useModel, DEFAULT_SOURCE } from "../model-context";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(ModelProvider, null, children);
}

describe("useModel with ModelProvider", () => {
  it("provides default SCAD source", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    expect(result.current.scadSource).toBe(DEFAULT_SOURCE);
  });

  it("provides default model name", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    expect(result.current.modelName).toBe("Nuevo Modelo");
  });

  it("compiledMesh is initially null", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    expect(result.current.compiledMesh).toBeNull();
  });

  it("paramValues is initially empty", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    expect(result.current.paramValues).toEqual({});
  });

  it("isDirty is initially false", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    expect(result.current.isDirty).toBe(false);
  });

  it("forkMeta is initially null", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    expect(result.current.forkMeta).toBeNull();
  });

  it("setScadSource updates source and marks dirty", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    act(() => {
      result.current.setScadSource("cube(10);");
    });
    expect(result.current.scadSource).toBe("cube(10);");
    expect(result.current.isDirty).toBe(true);
  });

  it("setScadSource with name updates model name", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    act(() => {
      result.current.setScadSource("sphere(5);", "My Sphere");
    });
    expect(result.current.modelName).toBe("My Sphere");
  });

  it("setScadSource with fork sets fork metadata", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    const fork = { forkedFromId: "c_123", forkedFromTitle: "Original", forkedFromAuthor: "Author" };
    act(() => {
      result.current.setScadSource("cube(5);", "Fork", fork);
    });
    expect(result.current.forkMeta).toEqual(fork);
  });

  it("setScadSource clears compiled mesh and params", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    act(() => {
      result.current.setParamValues({ width: 10 });
      result.current.setCompiledMesh({ polygons: [], faceCount: 0 });
    });
    act(() => {
      result.current.setScadSource("cylinder(r=5, h=10);");
    });
    expect(result.current.compiledMesh).toBeNull();
    expect(result.current.paramValues).toEqual({});
  });

  it("setCompiledMesh updates mesh", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    const mesh = { polygons: [], faceCount: 0 };
    act(() => {
      result.current.setCompiledMesh(mesh);
    });
    expect(result.current.compiledMesh).toEqual(mesh);
  });

  it("setParamValues updates parameters and marks dirty", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    act(() => {
      result.current.setParamValues({ width: 20, height: 30 });
    });
    expect(result.current.paramValues).toEqual({ width: 20, height: 30 });
    expect(result.current.isDirty).toBe(true);
  });

  it("setParam updates single parameter", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    act(() => {
      result.current.setParam("width", 15);
    });
    expect(result.current.paramValues.width).toBe(15);
  });

  it("setModelName updates name", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    act(() => {
      result.current.setModelName("Custom Name");
    });
    expect(result.current.modelName).toBe("Custom Name");
  });

  it("markClean resets isDirty", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    act(() => {
      result.current.setScadSource("cube(1);");
    });
    expect(result.current.isDirty).toBe(true);
    act(() => {
      result.current.markClean();
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("clearForkMeta removes fork info", () => {
    const { result } = renderHook(() => useModel(), { wrapper });
    const fork = { forkedFromId: "c_1", forkedFromTitle: "T", forkedFromAuthor: "A" };
    act(() => {
      result.current.setScadSource("code", "name", fork);
    });
    expect(result.current.forkMeta).not.toBeNull();
    act(() => {
      result.current.clearForkMeta();
    });
    expect(result.current.forkMeta).toBeNull();
  });
});

describe("useModel without provider", () => {
  it("returns default context values", () => {
    const { result } = renderHook(() => useModel());
    expect(result.current.scadSource).toBe(DEFAULT_SOURCE);
    expect(result.current.modelName).toBe("Nuevo Modelo");
  });
});

describe("DEFAULT_SOURCE", () => {
  it("is a non-empty string", () => {
    expect(typeof DEFAULT_SOURCE).toBe("string");
    expect(DEFAULT_SOURCE.length).toBeGreaterThan(0);
  });

  it("contains SCAD code", () => {
    expect(DEFAULT_SOURCE).toContain("$fn");
    expect(DEFAULT_SOURCE).toContain("difference");
  });
});
