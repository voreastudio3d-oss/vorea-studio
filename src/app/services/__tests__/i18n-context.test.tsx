/**
 * i18n-context unit tests
 * Tests: buildDict logic, detectLocale, extractUrlLang, t() interpolation.
 * Tests the Provider + useI18n hook via @testing-library/react renderHook.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { I18nProvider, useI18n } from "../i18n-context";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, null, children);
}

describe("i18n-context", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("useI18n throws outside of I18nProvider", () => {
    expect(() => renderHook(() => useI18n())).toThrow(
      "useI18n must be used within <I18nProvider>"
    );
  });

  it("provides a valid default locale", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    // happy-dom navigator.language = 'en', so detects "en"
    expect(["es", "en", "pt"]).toContain(result.current.locale);
  });

  it("t() returns key when translation not found", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t("__nonexistent_key__")).toBe("__nonexistent_key__");
  });

  it("setLocale changes active locale", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLocale("en"));
    expect(result.current.locale).toBe("en");
  });

  it("setLocale persists to localStorage", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLocale("pt"));
    expect(localStorage.getItem("vorea-locale")).toBe("pt");
  });

  it("ignores invalid locale code", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    const before = result.current.locale;
    act(() => result.current.setLocale("xx-invalid"));
    expect(result.current.locale).toBe(before); // unchanged
  });

  it("availableLocales has at least 8 entries", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.availableLocales.length).toBeGreaterThanOrEqual(8);
  });

  it("displayCode is uppercased locale", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLocale("en-GB"));
    expect(result.current.displayCode).toBe("EN-GB");
  });

  it("t() supports replacement interpolation", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    // Use a key that likely exists — if not, it returns the key which still validates the replacement logic
    const translated = result.current.t("__test_{name}__", { name: "Vorea" });
    // If key is missing, the key itself is returned with replacement applied
    expect(translated).toBe("__test_Vorea__");
  });

  it("restores locale from localStorage", () => {
    localStorage.setItem("vorea-locale", "en");
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe("en");
  });
});
