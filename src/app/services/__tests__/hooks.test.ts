/**
 * Tests for hooks.ts — useUserProfile, useModels, useCurrentModel.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUserProfile, useModels, useCurrentModel } from "../hooks";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("useUserProfile", () => {
  it("returns default user initially", () => {
    const { result } = renderHook(() => useUserProfile());
    expect(result.current.user).toBeDefined();
    expect(result.current.user.id).toBeDefined();
  });

  it("updateUser patches the user", () => {
    const { result } = renderHook(() => useUserProfile());
    act(() => {
      result.current.updateUser({ displayName: "Test User" });
    });
    expect(result.current.user.displayName).toBe("Test User");
  });

  it("resetUser restores defaults", () => {
    const { result } = renderHook(() => useUserProfile());
    act(() => {
      result.current.updateUser({ displayName: "Changed" });
    });
    expect(result.current.user.displayName).toBe("Changed");
    act(() => {
      result.current.resetUser();
    });
    expect(result.current.user.displayName).not.toBe("Changed");
  });
});

describe("useModels", () => {
  it("returns models list", () => {
    const { result } = renderHook(() => useModels());
    expect(Array.isArray(result.current.models)).toBe(true);
    expect(result.current.models.length).toBeGreaterThanOrEqual(0);
  });

  it("returns stats", () => {
    const { result } = renderHook(() => useModels());
    expect(result.current.stats).toBeDefined();
    expect(typeof result.current.stats.totalModels).toBe("number");
  });

  it("createModel adds to list", () => {
    const { result } = renderHook(() => useModels());
    const before = result.current.models.length;
    act(() => {
      result.current.createModel({
        title: "Hook Test Model",
        params: { radius: 5, height: 10, resolution: 16 },
      });
    });
    expect(result.current.models.length).toBe(before + 1);
  });

  it("updateModel changes model data", () => {
    const { result } = renderHook(() => useModels());
    let id: string;
    act(() => {
      const model = result.current.createModel({
        title: "Before Update",
        params: { radius: 5, height: 10, resolution: 16 },
      });
      id = model.id;
    });
    act(() => {
      result.current.updateModel(id!, { title: "After Update" });
    });
    const found = result.current.models.find((m) => m.id === id!);
    expect(found?.title).toBe("After Update");
  });

  it("deleteModel removes from list", () => {
    const { result } = renderHook(() => useModels());
    let id: string;
    act(() => {
      const model = result.current.createModel({
        title: "Delete Me",
        params: { radius: 5, height: 10, resolution: 16 },
      });
      id = model.id;
    });
    const before = result.current.models.length;
    act(() => {
      result.current.deleteModel(id!);
    });
    expect(result.current.models.length).toBe(before - 1);
  });

  it("refresh re-reads from localStorage", () => {
    const { result } = renderHook(() => useModels());
    act(() => {
      result.current.refresh();
    });
    expect(Array.isArray(result.current.models)).toBe(true);
  });
});

describe("useCurrentModel", () => {
  it("starts with null currentId", () => {
    const { result } = renderHook(() => useCurrentModel());
    expect(result.current.currentId).toBeNull();
    expect(result.current.currentModel).toBeNull();
  });

  it("setCurrentId stores in session", () => {
    const { result } = renderHook(() => useCurrentModel());
    act(() => {
      result.current.setCurrentId("m_test123");
    });
    expect(result.current.currentId).toBe("m_test123");
    expect(sessionStorage.getItem("vorea_current_model")).toBe("m_test123");
  });

  it("setCurrentId(null) clears session", () => {
    const { result } = renderHook(() => useCurrentModel());
    act(() => {
      result.current.setCurrentId("m_test");
    });
    act(() => {
      result.current.setCurrentId(null);
    });
    expect(result.current.currentId).toBeNull();
    expect(sessionStorage.getItem("vorea_current_model")).toBeNull();
  });
});
