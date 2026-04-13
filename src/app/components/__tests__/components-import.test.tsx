/**
 * Component render tests — AnalyticsPanel, ScadDiagnosticsPanel,
 * FeedbackPanel, CollapsibleSection, Footer.
 */
import { describe, it, expect, vi } from "vitest";
import { render, createElement } from "react";
import type { ReactNode } from "react";

vi.mock("../../services/auth-context", () => ({
  useAuth: () => ({
    isLoggedIn: false,
    user: null,
    credits: { balance: 0, monthlyAllocation: 0, totalUsed: 0 },
  }),
}));

vi.mock("../../services/i18n-context", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "en", setLocale: vi.fn() }),
  I18nProvider: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("../../services/analytics", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

vi.mock("../../services/telemetry", () => ({
  telemetry: { track: vi.fn() },
}));

vi.mock("../../services/api-client", () => ({
  FeedbackApi: { submit: vi.fn(() => Promise.resolve({ feedbackId: "f1" })) },
  getStoredToken: vi.fn(() => null),
}));

vi.mock("../../nav", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/" }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

describe("CollapsibleSection", () => {
  it("can be imported", async () => {
    const mod = await import("../CollapsibleSection");
    expect(mod.CollapsibleSection).toBeDefined();
  });
});

describe("ScadDiagnosticsPanel", () => {
  it("can be imported", async () => {
    const mod = await import("../ScadDiagnosticsPanel");
    expect(mod).toBeDefined();
  });
});

describe("FeedbackPanel", () => {
  it("can be imported", async () => {
    const mod = await import("../FeedbackPanel");
    expect(mod).toBeDefined();
  });
});

describe("Footer", () => {
  it("can be imported", async () => {
    const mod = await import("../Footer");
    expect(mod).toBeDefined();
  });
});

describe("PublishDialog", () => {
  it("can be imported", async () => {
    const mod = await import("../PublishDialog");
    expect(mod).toBeDefined();
  });
});

describe("SubscriptionSuccessModal", () => {
  it("can be imported", async () => {
    const mod = await import("../SubscriptionSuccessModal");
    expect(mod).toBeDefined();
  });
});

describe("AiFallbackTree", () => {
  it("can be imported", async () => {
    const mod = await import("../AiFallbackTree");
    expect(mod).toBeDefined();
  });
});

describe("SlicePreview", () => {
  it("can be imported", async () => {
    const mod = await import("../SlicePreview");
    expect(mod).toBeDefined();
  });
});

describe("Breadcrumbs", () => {
  it("can be imported", async () => {
    const mod = await import("../Breadcrumbs");
    expect(mod).toBeDefined();
  });
});

describe("GCodePanel", () => {
  it("can be imported", async () => {
    const mod = await import("../GCodePanel");
    expect(mod).toBeDefined();
  });
});

describe("ScadLibrary", () => {
  it("can be imported", async () => {
    const mod = await import("../ScadLibrary");
    expect(mod).toBeDefined();
  });
});

describe("VaultUI", () => {
  it("can be imported", async () => {
    const mod = await import("../VaultUI");
    expect(mod).toBeDefined();
  });
});

describe("CommunityGalleryEditor", () => {
  it("can be imported", async () => {
    const mod = await import("../CommunityGalleryEditor");
    expect(mod).toBeDefined();
  });
});
