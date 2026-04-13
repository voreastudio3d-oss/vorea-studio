/**
 * CreditPackModal component tests
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { CreditPackModal } from "../CreditPackModal";

vi.mock("../../nav", () => ({
  useNavigate: () => vi.fn(),
}));

describe("CreditPackModal", () => {
  it("renders when open", () => {
    const { container } = render(
      createElement(CreditPackModal, {
        open: true,
        onClose: vi.fn(),
        currentBalance: 50,
      })
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("does not render content when closed", () => {
    const { container } = render(
      createElement(CreditPackModal, {
        open: false,
        onClose: vi.fn(),
        currentBalance: 0,
      })
    );
    // When closed, dialog content should not be visible
    expect(container.querySelector("[data-state='open']")).toBeNull();
  });

  it("shows current balance", () => {
    render(
      createElement(CreditPackModal, {
        open: true,
        onClose: vi.fn(),
        currentBalance: 42,
      })
    );
    // Should display the balance somewhere
    const text = document.body.textContent || "";
    expect(text).toContain("42");
  });

  it("handles null balance", () => {
    const { container } = render(
      createElement(CreditPackModal, {
        open: true,
        onClose: vi.fn(),
        currentBalance: null,
      })
    );
    expect(container).toBeTruthy();
  });
});
