import { describe, it, expect } from "vitest";
import {
  COMMUNITY_MODELS,
  getCommunitySeedUsers,
  getCommunityTagCounts,
} from "../community-data";

describe("community-data", () => {
  it("keeps unique model ids", () => {
    const ids = COMMUNITY_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps required model payload complete", () => {
    for (const model of COMMUNITY_MODELS) {
      expect(model.title.length).toBeGreaterThan(0);
      expect(model.authorId.length).toBeGreaterThan(0);
      expect(model.authorUsername.startsWith("@")).toBe(true);
      if (model.modelType === "parametric") {
        expect(model.scadSource?.length || 0).toBeGreaterThan(0);
      } else {
        expect(model.reliefConfig?.imageData.length || 0).toBeGreaterThan(0);
      }
      expect(model.tags.length).toBeGreaterThan(0);
    }
  });

  it("derives one unique seed user per author", () => {
    const users = getCommunitySeedUsers("demo.vorea.studio");
    expect(users.length).toBeGreaterThan(0);
    expect(new Set(users.map((u) => u.id)).size).toBe(users.length);
    expect(users.every((u) => u.email.endsWith("@demo.vorea.studio"))).toBe(true);

    const userIds = new Set(users.map((u) => u.id));
    for (const model of COMMUNITY_MODELS) {
      expect(userIds.has(model.authorId)).toBe(true);
    }
  });

  it("computes deterministic tag counts for seeding", () => {
    const tagCounts = getCommunityTagCounts();
    const totalTags = [...tagCounts.values()].reduce((acc, count) => acc + count, 0);
    const expected = COMMUNITY_MODELS
      .filter((model) => model.status === "published")
      .reduce((acc, model) => acc + model.tags.length, 0);

    expect(totalTags).toBe(expected);
    expect(tagCounts.get("gallery")).toBe(1);
    expect(tagCounts.get("draft")).toBeUndefined();
    expect(tagCounts.get("relief")).toBe(1);
  });
});
