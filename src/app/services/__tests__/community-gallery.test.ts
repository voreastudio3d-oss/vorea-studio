/**
 * community-gallery tests — gallery item management, reordering, serialization.
 */
import { describe, it, expect, vi } from "vitest";
import {
  createGalleryItemFromUrl,
  resolveGalleryState,
  moveGalleryItem,
  clampGalleryCoverIndex,
} from "../community-gallery";

// Mock api-client for serializeGalleryItems
vi.mock("../api-client", () => ({
  CommunityApi: {
    uploadThumbnail: vi.fn(() => Promise.resolve("https://cdn/thumb.jpg")),
    uploadCommunityImage: vi.fn(() => Promise.resolve("https://cdn/img.jpg")),
  },
}));

describe("community-gallery", () => {
  describe("createGalleryItemFromUrl", () => {
    it("creates item with URL and source", () => {
      const item = createGalleryItemFromUrl("https://example.com/img.jpg", "user_upload");
      expect(item.id).toBeTruthy();
      expect(item.previewUrl).toBe("https://example.com/img.jpg");
      expect(item.remoteUrl).toBe("https://example.com/img.jpg");
      expect(item.source).toBe("user_upload");
    });

    it("defaults source to user_upload", () => {
      const item = createGalleryItemFromUrl("https://example.com/img.jpg");
      expect(item.source).toBe("user_upload");
    });

    it("generates unique IDs", () => {
      const a = createGalleryItemFromUrl("https://a.com/1.jpg");
      const b = createGalleryItemFromUrl("https://b.com/2.jpg");
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("resolveGalleryState", () => {
    it("returns empty state when no media and no thumbnail", () => {
      const result = resolveGalleryState(null, null);
      expect(result.items).toHaveLength(0);
      expect(result.coverIndex).toBe(0);
    });

    it("creates single item from thumbnailUrl", () => {
      const result = resolveGalleryState(null, "https://cdn/thumb.jpg");
      expect(result.items).toHaveLength(1);
      expect(result.coverIndex).toBe(0);
      expect(result.items[0].source).toBe("auto_capture");
    });

    it("creates items from media array", () => {
      const media = [
        { url: "https://cdn/1.jpg", source: "user_upload" as const, isCover: false, order: 1 },
        { url: "https://cdn/2.jpg", source: "auto_capture" as const, isCover: true, order: 0 },
      ];
      const result = resolveGalleryState(media);
      expect(result.items).toHaveLength(2);
      // Sorted by order: item with order=0 is first, and it has isCover=true
      expect(result.coverIndex).toBe(0);
    });

    it("filters out items without URL", () => {
      const media = [
        { url: "https://cdn/1.jpg", source: "user_upload" as const, isCover: true, order: 0 },
        { url: "", source: "user_upload" as const, isCover: false, order: 1 },
        { url: null as any, source: "user_upload" as const, isCover: false, order: 2 },
      ];
      const result = resolveGalleryState(media);
      expect(result.items).toHaveLength(1);
    });
  });

  describe("moveGalleryItem", () => {
    const items = [
      createGalleryItemFromUrl("https://a.com/1.jpg"),
      createGalleryItemFromUrl("https://b.com/2.jpg"),
      createGalleryItemFromUrl("https://c.com/3.jpg"),
    ];

    it("moves item forward", () => {
      const result = moveGalleryItem(items, 0, 1);
      expect(result[0].previewUrl).toBe("https://b.com/2.jpg");
      expect(result[1].previewUrl).toBe("https://a.com/1.jpg");
    });

    it("moves item backward", () => {
      const result = moveGalleryItem(items, 2, -1);
      expect(result[1].previewUrl).toBe("https://c.com/3.jpg");
      expect(result[2].previewUrl).toBe("https://b.com/2.jpg");
    });

    it("returns same array when moving out of bounds (start)", () => {
      const result = moveGalleryItem(items, 0, -1);
      expect(result).toBe(items);
    });

    it("returns same array when moving out of bounds (end)", () => {
      const result = moveGalleryItem(items, 2, 1);
      expect(result).toBe(items);
    });

    it("does not mutate original array", () => {
      const copy = [...items];
      moveGalleryItem(items, 0, 1);
      expect(items.map((i) => i.previewUrl)).toEqual(copy.map((i) => i.previewUrl));
    });
  });

  describe("clampGalleryCoverIndex", () => {
    it("returns 0 for empty array", () => {
      expect(clampGalleryCoverIndex([], 5)).toBe(0);
    });

    it("clamps to last index", () => {
      const items = [
        createGalleryItemFromUrl("https://a.com/1.jpg"),
        createGalleryItemFromUrl("https://b.com/2.jpg"),
      ];
      expect(clampGalleryCoverIndex(items, 10)).toBe(1);
    });

    it("clamps negative to 0", () => {
      const items = [createGalleryItemFromUrl("https://a.com/1.jpg")];
      expect(clampGalleryCoverIndex(items, -3)).toBe(0);
    });

    it("returns valid index unchanged", () => {
      const items = [
        createGalleryItemFromUrl("https://a.com/1.jpg"),
        createGalleryItemFromUrl("https://b.com/2.jpg"),
        createGalleryItemFromUrl("https://c.com/3.jpg"),
      ];
      expect(clampGalleryCoverIndex(items, 1)).toBe(1);
    });
  });
});
