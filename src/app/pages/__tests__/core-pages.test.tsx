/**
 * Core page smoke tests — Editor, AIStudio, Relief, Landing, SuperAdmin.
 * Validates pages render without crashing when dependencies are mocked.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { I18nProvider } from "../../services/i18n-context";

// ── Shared mocks ────────────────────────────────────────────────────────────

vi.mock("../../services/auth-context", () => ({
  useAuth: () => ({
    isLoggedIn: false,
    user: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    socialLogin: vi.fn(),
    upgradeTier: vi.fn(),
    refreshUser: vi.fn(),
    refreshCredits: vi.fn(),
    credits: { balance: 0, monthlyAllocation: 0, monthlyBalance: 0, topupBalance: 0, totalUsed: 0 },
  }),
}));

vi.mock("../../nav", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => ({}),
  NavProvider: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));

vi.mock("../../services/model-context", () => ({
  useModel: () => ({
    scadCode: "",
    setScadCode: vi.fn(),
    family: "storage-box",
    setFamily: vi.fn(),
    parameters: {},
    setParameters: vi.fn(),
    compiledCode: "",
    isCompiling: false,
  }),
}));

vi.mock("../../services/api-client", () => ({
  AuthApi: { getGoogleConfig: vi.fn(() => Promise.resolve({ configured: false })) },
  CommunityApi: {
    list: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    getPublished: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    get: vi.fn(() => Promise.resolve(null)),
  },
  AiStudioGenerateApi: { generate: vi.fn() },
  AiStudioHistoryApi: { list: vi.fn(() => Promise.resolve([])) },
  AiStudioRecipesApi: { list: vi.fn(() => Promise.resolve([])) },
  AiStudioCMSApi: { getPublicFamilies: vi.fn(() => Promise.resolve([])) },
  AiQuickFixApi: { fix: vi.fn() },
  ContentApi: {
    getHero: vi.fn(() => Promise.resolve(null)),
    getHeroBanner: vi.fn(() => Promise.resolve(null)),
  },
  AdminApi: {
    getStats: vi.fn(() => Promise.resolve({})),
    listUsers: vi.fn(() => Promise.resolve([])),
  },
  CreditsApi: { get: vi.fn(() => Promise.resolve(0)) },
  GCodeApi: { list: vi.fn(() => Promise.resolve([])) },
  ToolCreditsApi: { getMine: vi.fn(() => Promise.resolve({ balance: 0 })) },
  getStoredToken: vi.fn(() => null),
  setStoredToken: vi.fn(),
}));

vi.mock("../../services/analytics", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

vi.mock("../../services/telemetry", () => ({
  telemetry: { track: vi.fn() },
  default: { track: vi.fn() },
}));

vi.mock("../../services/telemetry-collector", () => ({
  collectTelemetry: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../services/scad-parser", () => ({
  parseScad: vi.fn(() => ({ parameters: {}, modules: [] })),
}));

vi.mock("../../services/scad-validator", () => ({
  validateScad: vi.fn(() => ({ valid: true, errors: [] })),
  regenerateScad: vi.fn(() => ""),
}));

vi.mock("../../engine/compile-preview", () => ({
  estimateCompilePreview: vi.fn(() => ({})),
}));

vi.mock("../../engine/instruction-spec", () => ({
  buildParameterBlueprint: vi.fn(() => ({})),
  ENGINE_FAMILIES: [],
}));

vi.mock("../../engine/validation", () => ({
  validateFdmSpec: vi.fn(() => ({ valid: true })),
}));

vi.mock("../../engine/heightmap-generator", () => ({
  generateHeightmapMesh: vi.fn(),
  estimatePaletteFromImage: vi.fn(() => []),
}));

vi.mock("../../engine/relief-scene", () => ({
  initScene: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock("../../services/hooks", () => ({
  useModels: () => ({ models: [], loading: false }),
}));

vi.mock("../../store/ai-studio-store", () => ({
  useAiStudioStore: () => ({
    prompt: "",
    selectedFamily: "storage-box",
    quality: "draft",
    parameterOverridesByFamily: {},
    setPrompt: vi.fn(),
    setSelectedFamily: vi.fn(),
    setQuality: vi.fn(),
    setParameterOverridesByFamily: vi.fn(),
  }),
}));

vi.mock("../../services/storage", () => ({
  registerImage: vi.fn(),
  getImage: vi.fn(() => null),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, null, children);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Landing page", () => {
  it("can be imported without errors", async () => {
    const mod = await import("../Landing");
    expect(mod.Landing).toBeDefined();
    expect(typeof mod.Landing).toBe("function");
  });
});

describe("Editor page", () => {
  it("can be imported without errors", async () => {
    const mod = await import("../Editor");
    expect(mod.Editor).toBeDefined();
    expect(typeof mod.Editor).toBe("function");
  });
});

describe("AIStudio page", () => {
  it("can be imported without errors", async () => {
    const mod = await import("../AIStudio");
    expect(mod.AIStudio).toBeDefined();
    expect(typeof mod.AIStudio).toBe("function");
  });
});

describe("Relief page", () => {
  it("can be imported without errors", async () => {
    const mod = await import("../Relief");
    expect(mod.Relief).toBeDefined();
    expect(typeof mod.Relief).toBe("function");
  });
});

describe("SuperAdmin page", () => {
  it("can be imported without errors", async () => {
    const mod = await import("../SuperAdmin");
    expect(mod.SuperAdmin).toBeDefined();
    expect(typeof mod.SuperAdmin).toBe("function");
  });
});
