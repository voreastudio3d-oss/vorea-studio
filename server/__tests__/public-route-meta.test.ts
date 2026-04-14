/**
 * public-route-meta.ts — Unit tests for SEO route metadata.
 */
import { describe, it, expect } from "vitest";
import { normalizePublicRouteLocale, getPublicRouteMeta } from "../public-route-meta.js";

describe("normalizePublicRouteLocale", () => {
  it("returns 'en' for English locales", () => {
    expect(normalizePublicRouteLocale("en")).toBe("en");
    expect(normalizePublicRouteLocale("en-US")).toBe("en");
    expect(normalizePublicRouteLocale("EN")).toBe("en");
    expect(normalizePublicRouteLocale("english")).toBe("en");
  });

  it("returns 'pt' for Portuguese locales", () => {
    expect(normalizePublicRouteLocale("pt")).toBe("pt");
    expect(normalizePublicRouteLocale("pt-BR")).toBe("pt");
    expect(normalizePublicRouteLocale("PT")).toBe("pt");
  });

  it("returns 'es' for Spanish and unknown locales", () => {
    expect(normalizePublicRouteLocale("es")).toBe("es");
    expect(normalizePublicRouteLocale("es-MX")).toBe("es");
    expect(normalizePublicRouteLocale("fr")).toBe("es");
    expect(normalizePublicRouteLocale("")).toBe("es");
    expect(normalizePublicRouteLocale("de")).toBe("es");
  });
});

describe("getPublicRouteMeta", () => {
  it("returns metadata for known route in English", () => {
    const meta = getPublicRouteMeta("/", "en");
    expect(meta).not.toBeNull();
    expect(meta!.title).toContain("Vorea");
    expect(meta!.description.length).toBeGreaterThan(0);
  });

  it("returns metadata for known route in Spanish", () => {
    const meta = getPublicRouteMeta("/", "es");
    expect(meta).not.toBeNull();
    expect(meta!.title).toContain("Vorea");
  });

  it("returns metadata for known route in Portuguese", () => {
    const meta = getPublicRouteMeta("/", "pt");
    expect(meta).not.toBeNull();
    expect(meta!.title).toContain("Vorea");
  });

  it("returns null for unknown route", () => {
    expect(getPublicRouteMeta("/nonexistent-route", "en")).toBeNull();
    expect(getPublicRouteMeta("/nonexistent-route", "es")).toBeNull();
  });

  it("returns metadata for /plans route", () => {
    const meta = getPublicRouteMeta("/plans", "en");
    expect(meta).not.toBeNull();
    expect(meta!.title.toLowerCase()).toContain("plan");
  });

  it("returns metadata for /community route", () => {
    const meta = getPublicRouteMeta("/community", "en");
    expect(meta).not.toBeNull();
    expect(meta!.title.toLowerCase()).toContain("community");
  });

  it("returns metadata for /contact route", () => {
    const meta = getPublicRouteMeta("/contact", "en");
    expect(meta).not.toBeNull();
    expect(meta!.title.toLowerCase()).toContain("contact");
  });

  it("returns metadata for /for/makers landing", () => {
    const meta = getPublicRouteMeta("/for/makers", "en");
    expect(meta).not.toBeNull();
    expect(meta!.title.toLowerCase()).toContain("maker");
  });

  it("returns metadata for /for/ai-creators landing", () => {
    const meta = getPublicRouteMeta("/for/ai-creators", "en");
    expect(meta).not.toBeNull();
    expect(meta!.title.toLowerCase()).toContain("ai");
  });

  it("returns metadata for /for/education landing", () => {
    const meta = getPublicRouteMeta("/for/education", "en");
    expect(meta).not.toBeNull();
    expect(meta!.title.toLowerCase()).toContain("education");
  });

  it("returns metadata for /contributors route", () => {
    const meta = getPublicRouteMeta("/contributors", "en");
    expect(meta).not.toBeNull();
    expect(meta!.title.toLowerCase()).toContain("contributor");
  });
});
