import { describe, expect, it } from "vitest";

import { matchesRouteWithSearch } from "../../tool-nav";

describe("matchesRouteWithSearch", () => {
  it("matches routes with query params exactly", () => {
    expect(matchesRouteWithSearch("/studio", "?mode=parametric", "/studio?mode=parametric")).toBe(true);
    expect(matchesRouteWithSearch("/studio", "?mode=parametric", "/studio?mode=organic")).toBe(false);
  });

  it("matches routes without query params", () => {
    expect(matchesRouteWithSearch("/ai-studio", "", "/ai-studio")).toBe(true);
    expect(matchesRouteWithSearch("/ai-studio", "", "/makerworld")).toBe(false);
  });

  it("normalizes search param ordering", () => {
    expect(matchesRouteWithSearch("/studio", "?tab=params&mode=parametric", "/studio?mode=parametric&tab=params")).toBe(true);
  });

  it("keeps tool routes active when extra query params exist", () => {
    expect(matchesRouteWithSearch("/studio", "?mode=parametric&project=abc", "/studio?mode=parametric")).toBe(true);
  });
});
