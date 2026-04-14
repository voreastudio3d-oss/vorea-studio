import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../services/i18n-context";
import { Contact } from "../Contact";

const apiMocks = vi.hoisted(() => ({
  submit: vi.fn(),
}));

const analyticsMocks = vi.hoisted(() => ({
  trackAnalyticsEvent: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("../../services/api-client", () => ({
  ContactApi: apiMocks,
}));

vi.mock("../../services/analytics", () => ({
  trackAnalyticsEvent: analyticsMocks.trackAnalyticsEvent,
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

const subjectPlaceholder = /(what would you like to talk about|asunto|subject)/i;

describe("contact page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits the form and shows a tracked confirmation reference", async () => {
    apiMocks.submit.mockResolvedValue({
      success: true,
      contactId: "ct_demo123",
    });

    render(
      <I18nProvider>
        <Contact />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/(nombre|your name)/i), {
      target: { value: "Martín" },
    });
    fireEvent.change(screen.getByPlaceholderText(/(email|you@email\.com)/i), {
      target: { value: "martin@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(subjectPlaceholder), {
      target: { value: "Colaboración" },
    });
    fireEvent.change(screen.getByPlaceholderText(/(mensaje|tell us how we can help)/i), {
      target: { value: "Quiero hablar sobre una colaboración." },
    });

    fireEvent.click(screen.getByRole("button", { name: /(enviar|send)/i }));

    await waitFor(() =>
      expect(apiMocks.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Martín",
          email: "martin@example.com",
          subject: "Colaboración",
          message: "Quiero hablar sobre una colaboración.",
        })
      )
    );

    expect(analyticsMocks.trackAnalyticsEvent).toHaveBeenCalledWith(
      "contact_submit",
      expect.objectContaining({
        source: "contact_page",
        has_subject: true,
      })
    );
    expect(toastMocks.success).toHaveBeenCalled();
    expect(await screen.findByText(/(mensaje enviado|message sent)/i)).toBeInTheDocument();
    expect(screen.getByText(/ct_demo123/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(subjectPlaceholder)).toHaveValue("");
  });

  it("shows a validation toast when required fields are missing", async () => {
    render(
      <I18nProvider>
        <Contact />
      </I18nProvider>
    );

    fireEvent.submit(screen.getByRole("button", { name: /(enviar|send)/i }).closest("form")!);

    expect(apiMocks.submit).not.toHaveBeenCalled();
    expect(toastMocks.error).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when submission fails and resets the loading state", async () => {
    apiMocks.submit.mockRejectedValue(new Error("Servicio temporalmente no disponible"));

    render(
      <I18nProvider>
        <Contact />
      </I18nProvider>
    );

    fireEvent.change(screen.getByPlaceholderText(/(nombre|your name)/i), {
      target: { value: "Martín" },
    });
    fireEvent.change(screen.getByPlaceholderText(/(email|you@email\.com)/i), {
      target: { value: "martin@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(subjectPlaceholder), {
      target: { value: "Soporte" },
    });
    fireEvent.change(screen.getByPlaceholderText(/(mensaje|tell us how we can help)/i), {
      target: { value: "Necesito ayuda con una publicación." },
    });

    fireEvent.submit(screen.getByRole("button", { name: /(enviar|send)/i }).closest("form")!);

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("Servicio temporalmente no disponible")
    );

    expect(analyticsMocks.trackAnalyticsEvent).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /(enviar|send)/i })).not.toBeDisabled();
  });
});
