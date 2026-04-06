import { beforeEach, describe, expect, it } from "vitest";
import { syncDynamicHead, syncRouteHead } from "../../route-head";

describe("route head sync", () => {
  beforeEach(() => {
    document.head.innerHTML = "<title>Init</title>";
    document.documentElement.lang = "es";
    window.history.replaceState({}, "", "/");
  });

  it("updates shared head tags when locale changes on a static route", () => {
    syncRouteHead("/contact", "en");
    expect(document.title).toContain("Contact");
    expect(document.documentElement.lang).toBe("en");
    expect(document.head.querySelector('meta[property="og:locale"]')?.getAttribute("content")).toBe("en_US");
  });

  it("supports dynamic route overrides for localized news", () => {
    syncDynamicHead(
      {
        title: "New 3D printer | Noticias 3D | Vorea Studio",
        description: "English summary for the article.",
      },
      "/news/new-3d-printer",
      "en"
    );

    expect(document.title).toContain("New 3D printer");
    expect(document.head.querySelector('meta[name="twitter:description"]')?.getAttribute("content")).toBe(
      "English summary for the article."
    );
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toContain(
      "/news/new-3d-printer"
    );
  });

  it("uses specific marketing metadata for /for/* routes", () => {
    syncRouteHead("/for/makers", "es");

    expect(document.title).toBe("Diseño paramétrico 3D para makers | Vorea Studio");
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).toContain(
      "modelos 3D paramétricos"
    );
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute("content")).not.toContain(
      "listos para imprimir"
    );
  });
});
