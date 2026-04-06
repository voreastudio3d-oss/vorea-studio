import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NavProvider } from "../../nav";
import { Root } from "../../Root";

vi.mock("../../services/auth-context", () => ({
  useAuth: () => ({
    isLoggedIn: false,
    user: null,
    logout: vi.fn(),
    isSuperAdmin: false,
    creditBalance: null,
  }),
}));

vi.mock("../../services/i18n-context", () => ({
  useI18n: () => ({
    locale: "es",
    displayCode: "ES",
    setLocale: vi.fn(),
    availableLocales: [{ code: "es", label: "Español", flag: "ES" }],
    t: (key: string) =>
      ({
        "nav.home": "Inicio",
        "nav.studio": "Studio",
        "nav.tools": "Herramientas",
        "nav.community": "Comunidad",
        "nav.news": "Noticias",
        "nav.plans": "Planes",
        "nav.login": "Ingresar",
        "nav.loginRegister": "Ingresar / Registrarse",
        "nav.tool.studio": "Paramétrico",
        "nav.tool.organic": "Orgánico",
        "nav.tool.relief": "Relieve",
        "nav.tool.aiStudio": "IA Studio",
        "nav.tool.makerworld": "MakerWorld",
        "nav.tool.gcode": "Colección GCode",
        "nav.tool.feedbackAI": "Feedback IA",
      }[key] ?? key),
  }),
}));

vi.mock("../../components/Breadcrumbs", () => ({
  Breadcrumbs: () => <div>Breadcrumbs</div>,
}));

vi.mock("../../components/Footer", () => ({
  Footer: () => <div>Footer</div>,
}));

vi.mock("../../components/AuthDialog", () => ({
  AuthDialog: () => null,
}));

function renderWithProviders(node: ReactNode) {
  return render(<NavProvider>{node}</NavProvider>);
}

describe("root tool navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("vorea-locale", "es");
    window.history.replaceState({}, "", "/");
  });

  it("navigates when a tool is selected from the dropdown", () => {
    renderWithProviders(<Root><div>Child</div></Root>);

    fireEvent.click(screen.getByRole("button", { name: /herramientas/i }));
    fireEvent.click(screen.getAllByRole("link", { name: /ia studio/i })[0]);

    expect(window.location.pathname).toBe("/es/ai-studio");
  });

  it("marks the parametric tool as active when query params are present", () => {
    window.history.replaceState({}, "", "/studio?mode=parametric&project=abc");
    renderWithProviders(<Root><div>Child</div></Root>);

    fireEvent.click(screen.getByRole("button", { name: /herramientas/i }));

    const parametricLinks = screen.getAllByRole("link", { name: /paramétrico/i });
    expect(parametricLinks[0].className).toContain("text-primary");
  });
});
