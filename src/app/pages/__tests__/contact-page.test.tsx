import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../services/i18n-context";
import { Contact } from "../Contact";

const apiMocks = vi.hoisted(() => ({
  submit: vi.fn(),
}));

vi.mock("../../services/api-client", () => ({
  ContactApi: apiMocks,
}));

vi.mock("../../services/analytics", () => ({
  trackAnalyticsEvent: vi.fn(),
}));

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
    fireEvent.change(screen.getByPlaceholderText(/(mensaje|tell us how we can help)/i), {
      target: { value: "Quiero hablar sobre una colaboración." },
    });

    fireEvent.click(screen.getByRole("button", { name: /(enviar|send)/i }));

    await waitFor(() =>
      expect(apiMocks.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Martín",
          email: "martin@example.com",
          message: "Quiero hablar sobre una colaboración.",
        })
      )
    );

    expect(await screen.findByText(/(mensaje enviado|message sent)/i)).toBeInTheDocument();
    expect(screen.getByText(/ct_demo123/)).toBeInTheDocument();
  });
});
