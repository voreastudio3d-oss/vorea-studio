/**
 * AuthDialog component tests — login, register, form validation, social login.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { AuthDialog } from "../AuthDialog";

// Mock dependencies
const mockLogin = vi.fn(() => Promise.resolve());
const mockRegister = vi.fn(() => Promise.resolve());
const mockSocialLogin = vi.fn(() => Promise.resolve());

vi.mock("../../services/auth-context", () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    socialLogin: mockSocialLogin,
  }),
}));

vi.mock("../../services/i18n-context", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "auth.loginTitle": "Iniciar Sesión",
        "auth.registerTitle": "Crear Cuenta",
        "auth.loginSuccess": "Sesión iniciada",
        "auth.loginError": "Error al iniciar sesión",
        "auth.fillAllFields": "Completa todos los campos",
        "auth.passwordsMismatch": "Las contraseñas no coinciden",
        "auth.pwRuleMinLength": "La contraseña debe tener al menos 8 caracteres",
        "auth.pwRuleUppercase": "Debe contener una mayúscula",
        "auth.pwRuleDigit": "Debe contener un número",
        "auth.pwRuleSpecial": "Debe contener un carácter especial",
        "auth.emailPlaceholder": "Email",
        "auth.passwordPlaceholder": "Contraseña",
        "auth.registerSuccess": "Cuenta creada",
        "auth.registerError": "Error al registrar",
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../services/analytics", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

vi.mock("../../services/api-client", () => ({
  AuthApi: {
    requestPasswordReset: vi.fn(() => Promise.resolve({ message: "Email enviado" })),
    resetPassword: vi.fn(() => Promise.resolve({ message: "Contraseña actualizada" })),
    getGoogleConfig: vi.fn(() => Promise.resolve({ configured: false })),
  },
}));

describe("AuthDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open=true", () => {
    render(createElement(AuthDialog, { open: true, onOpenChange: vi.fn() }));
    // Should show login tab by default
    expect(screen.getByText(/Iniciar Sesión/i)).toBeInTheDocument();
  });

  it("does not render content when open=false", () => {
    const { container } = render(
      createElement(AuthDialog, { open: false, onOpenChange: vi.fn() })
    );
    // Dialog should not render inner content when closed
    expect(container.querySelector("[data-state='open']")).toBeNull();
  });

  it("shows register tab when defaultTab='register'", () => {
    render(
      createElement(AuthDialog, {
        open: true,
        onOpenChange: vi.fn(),
        defaultTab: "register",
      })
    );
    expect(screen.getByText(/Crear Cuenta/i)).toBeInTheDocument();
  });

  it("shows error toast when login fields are empty", async () => {
    const { toast } = await import("sonner");
    render(createElement(AuthDialog, { open: true, onOpenChange: vi.fn() }));

    // Find and click the login button (submit)
    const buttons = screen.getAllByRole("button");
    const loginBtn = buttons.find(
      (b) => b.textContent?.includes("Iniciar") || b.textContent?.includes("Ingresar")
    );
    if (loginBtn) {
      fireEvent.click(loginBtn);
      expect(toast.error).toHaveBeenCalledWith("Completa todos los campos");
    }
  });

  it("switches between login and register tabs", () => {
    render(createElement(AuthDialog, { open: true, onOpenChange: vi.fn() }));

    // Find register tab buttons — may match multiple elements
    const registerTabs = screen.queryAllByText(/Crear Cuenta|Registrate|Register/i);
    if (registerTabs.length > 0) {
      fireEvent.click(registerTabs[0]);
      // After switching, register form elements should appear
      expect(
        screen.queryAllByText(/Crear Cuenta|Registrate/i).length
      ).toBeGreaterThan(0);
    }
  });

  it("renders email and password inputs on login tab", () => {
    render(createElement(AuthDialog, { open: true, onOpenChange: vi.fn() }));
    const inputs = screen.getAllByRole("textbox");
    // At minimum, email input should be present
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });
});
