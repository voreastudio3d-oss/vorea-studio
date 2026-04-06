/**
 * Navigation System Tests — history routing, legacy hash compatibility and helpers.
 *
 * These are pure function tests — no DOM/React rendering required.
 */
import { describe, it, expect } from "vitest";
import {
  matchPath,
  parseLegacyHashRoute,
  pathStartsWith,
  resolveLocationState,
} from "../../nav";

// ═════════════════════════════════════════════════════════════════════════════
// matchPath
// ═════════════════════════════════════════════════════════════════════════════

describe("matchPath", () => {
  it("matches a static route exactly", () => {
    const result = matchPath("/studio", "/studio");
    expect(result).toEqual({});
  });

  it("returns null for non-matching static routes", () => {
    expect(matchPath("/studio", "/relief")).toBeNull();
  });

  it("extracts a single dynamic segment", () => {
    const result = matchPath("/modelo/:id", "/modelo/abc123");
    expect(result).toEqual({ id: "abc123" });
  });

  it("extracts multiple dynamic segments", () => {
    const result = matchPath("/user/:id/modelos", "/user/xyz/modelos");
    expect(result).toEqual({ id: "xyz" });
  });

  it("returns null when segment counts differ", () => {
    expect(matchPath("/modelo/:id", "/modelo")).toBeNull();
    expect(matchPath("/modelo", "/modelo/extra")).toBeNull();
  });

  it("returns null when static segments don't match", () => {
    expect(matchPath("/user/:id/modelos", "/user/xyz/likes")).toBeNull();
  });

  it("decodes URI-encoded segments", () => {
    const result = matchPath("/modelo/:id", "/modelo/hello%20world");
    expect(result).toEqual({ id: "hello world" });
  });

  it("matches root path", () => {
    // Root "/" has zero segments on both sides
    const result = matchPath("/", "/");
    expect(result).toEqual({});
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// pathStartsWith
// ═════════════════════════════════════════════════════════════════════════════

describe("pathStartsWith", () => {
  it("root only matches root", () => {
    expect(pathStartsWith("/", "/")).toBe(true);
    expect(pathStartsWith("/studio", "/")).toBe(false);
  });

  it("matches exact prefix", () => {
    expect(pathStartsWith("/comunidad", "/comunidad")).toBe(true);
  });

  it("matches child paths", () => {
    expect(pathStartsWith("/modelo/abc123", "/modelo")).toBe(true);
    expect(pathStartsWith("/user/xyz/modelos", "/user")).toBe(true);
    expect(pathStartsWith("/noticias/impresion-3d-hoy", "/noticias")).toBe(true);
  });

  it("does not match partial prefixes", () => {
    // "/com" is not a valid prefix for "/comunidad"
    expect(pathStartsWith("/comunidad", "/com")).toBe(false);
  });

  it("does not match unrelated paths", () => {
    expect(pathStartsWith("/studio", "/relief")).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// URL state parsing
// ═════════════════════════════════════════════════════════════════════════════

describe("legacy hash URL parsing", () => {
  it("parses a simple path", () => {
    expect(parseLegacyHashRoute("#/studio")).toEqual({
      pathname: "/studio",
      search: "",
    });
  });

  it("parses path with single query param", () => {
    expect(parseLegacyHashRoute("#/studio?project=abc123")).toEqual({
      pathname: "/studio",
      search: "?project=abc123",
    });
  });

  it("parses path with multiple query params", () => {
    expect(parseLegacyHashRoute("#/studio?project=abc&mode=parametric")).toEqual({
      pathname: "/studio",
      search: "?project=abc&mode=parametric",
    });
  });

  it("parses empty hash as root", () => {
    expect(parseLegacyHashRoute("")).toEqual({
      pathname: "/",
      search: "",
    });
  });

  it("parses hash with only query params", () => {
    expect(parseLegacyHashRoute("#/?debug=true")).toEqual({
      pathname: "/",
      search: "?debug=true",
    });
  });

  it("preserves encoded characters in query params", () => {
    expect(parseLegacyHashRoute("#/relief?title=hello%20world")).toEqual({
      pathname: "/relief",
      search: "?title=hello%20world",
    });
  });

  it("URLSearchParams can parse the search string", () => {
    const { search } = parseLegacyHashRoute("#/studio?project=abc&mode=parametric&tab=params");
    const params = new URLSearchParams(search);
    expect(params.get("project")).toBe("abc");
    expect(params.get("mode")).toBe("parametric");
    expect(params.get("tab")).toBe("params");
  });
});

describe("resolveLocationState", () => {
  it("returns pathname and search for clean URLs", () => {
    expect(
      resolveLocationState({
        pathname: "/ai-studio",
        search: "?mode=fdm",
        hash: "",
      })
    ).toEqual({
      pathname: "/ai-studio",
      search: "?mode=fdm",
    });
  });

  it("normalizes legacy hash routes and preserves raw query params", () => {
    expect(
      resolveLocationState({
        pathname: "/",
        search: "?token=abc",
        hash: "#/perfil?sub=success",
      })
    ).toEqual({
      pathname: "/perfil",
      search: "?sub=success&token=abc",
    });
  });

  it("supports legacy hash-only query strings", () => {
    expect(
      resolveLocationState({
        pathname: "/",
        search: "",
        hash: "#?debug=true",
      })
    ).toEqual({
      pathname: "/",
      search: "?debug=true",
    });
  });
});
