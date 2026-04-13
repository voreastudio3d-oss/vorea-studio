/**
 * Image registry tests — register, get, remove, clear.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  registerImageData,
  getImage,
  getRegisteredImageNames,
  hasImage,
  removeImage,
  clearImages,
  type DecodedImage,
} from "../image-registry";

function fakeImage(w = 4, h = 4): DecodedImage {
  return {
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
  };
}

describe("image-registry", () => {
  beforeEach(() => {
    clearImages();
  });

  it("registerImageData stores an image", () => {
    registerImageData("test.png", fakeImage());
    expect(hasImage("test.png")).toBe(true);
  });

  it("getImage returns registered image", () => {
    const img = fakeImage(8, 8);
    registerImageData("photo.jpg", img);
    const result = getImage("photo.jpg");
    expect(result).not.toBeNull();
    expect(result!.width).toBe(8);
    expect(result!.height).toBe(8);
  });

  it("getImage is case-insensitive", () => {
    registerImageData("Image.PNG", fakeImage());
    expect(getImage("image.png")).not.toBeNull();
    expect(getImage("IMAGE.PNG")).not.toBeNull();
  });

  it("getImage returns null for unregistered name", () => {
    expect(getImage("nonexistent.png")).toBeNull();
  });

  it("hasImage checks existence", () => {
    expect(hasImage("missing.png")).toBe(false);
    registerImageData("exists.png", fakeImage());
    expect(hasImage("exists.png")).toBe(true);
  });

  it("hasImage is case-insensitive", () => {
    registerImageData("CaseSensitive.PNG", fakeImage());
    expect(hasImage("casesensitive.png")).toBe(true);
  });

  it("removeImage deletes an image", () => {
    registerImageData("remove-me.png", fakeImage());
    expect(hasImage("remove-me.png")).toBe(true);
    removeImage("remove-me.png");
    expect(hasImage("remove-me.png")).toBe(false);
  });

  it("clearImages removes all images", () => {
    registerImageData("a.png", fakeImage());
    registerImageData("b.png", fakeImage());
    registerImageData("c.png", fakeImage());
    expect(getRegisteredImageNames()).toHaveLength(3);
    clearImages();
    expect(getRegisteredImageNames()).toHaveLength(0);
  });

  it("getRegisteredImageNames returns all names", () => {
    registerImageData("alpha.png", fakeImage());
    registerImageData("beta.jpg", fakeImage());
    const names = getRegisteredImageNames();
    expect(names).toContain("alpha.png");
    expect(names).toContain("beta.jpg");
  });

  it("registerImageData overwrites existing image", () => {
    registerImageData("dup.png", fakeImage(4, 4));
    registerImageData("dup.png", fakeImage(16, 16));
    const img = getImage("dup.png");
    expect(img!.width).toBe(16);
  });
});
