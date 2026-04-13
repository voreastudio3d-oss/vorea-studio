/**
 * Tests for Footer, Breadcrumbs, CollapsibleSection components.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { I18nProvider } from "../../services/i18n-context";
import { Footer } from "../Footer";
import { Breadcrumbs } from "../Breadcrumbs";
import { CollapsibleSection } from "../CollapsibleSection";

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockPathname = "/";
const mockNavigate = vi.fn();

vi.mock("../../nav", () => ({
  useLocation: () => ({ pathname: mockPathname }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...rest }: any) => createElement("a", { href: to, ...rest }, children),
  pathStartsWith: (pathname: string, prefix: string) => pathname.startsWith(prefix),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, null, children);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Footer
// ═══════════════════════════════════════════════════════════════════════════════

describe("Footer", () => {
  it("renders on the home page", () => {
    mockPathname = "/";
    const { container } = render(<Footer />, { wrapper: Wrapper });
    expect(container.querySelector("footer")).not.toBeNull();
  });

  it("renders link sections", () => {
    mockPathname = "/community";
    render(<Footer />, { wrapper: Wrapper });
    // Footer should have the logo image
    const logo = screen.getByAltText("Vorea Studio");
    expect(logo).toBeInTheDocument();
  });

  it("hides on /studio path", () => {
    mockPathname = "/studio";
    const { container } = render(<Footer />, { wrapper: Wrapper });
    expect(container.querySelector("footer")).toBeNull();
  });

  it("renders legal links", () => {
    mockPathname = "/";
    render(<Footer />, { wrapper: Wrapper });
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Breadcrumbs
// ═══════════════════════════════════════════════════════════════════════════════

describe("Breadcrumbs", () => {
  it("renders nothing on home page", () => {
    mockPathname = "/";
    const { container } = render(<Breadcrumbs />, { wrapper: Wrapper });
    expect(container.children.length).toBe(0);
  });

  it("renders breadcrumbs on tool page", () => {
    mockPathname = "/organic";
    render(<Breadcrumbs />, { wrapper: Wrapper });
    // Should show Home + Tools + Organic breadcrumbs
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders breadcrumbs on /relief page", () => {
    mockPathname = "/relief";
    render(<Breadcrumbs />, { wrapper: Wrapper });
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders breadcrumbs for model detail", () => {
    mockPathname = "/modelo/abc123";
    render(<Breadcrumbs />, { wrapper: Wrapper });
    expect(screen.getByText("Modelo")).toBeInTheDocument();
  });

  it("renders breadcrumbs for user page", () => {
    mockPathname = "/user/someone";
    render(<Breadcrumbs />, { wrapper: Wrapper });
    expect(screen.getByText("Usuario")).toBeInTheDocument();
  });

  it("renders nothing on /comunidad", () => {
    mockPathname = "/comunidad";
    const { container } = render(<Breadcrumbs />, { wrapper: Wrapper });
    // /comunidad is not in TOOL_PAGES and not a special case
    expect(container.children.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CollapsibleSection
// ═══════════════════════════════════════════════════════════════════════════════

describe("CollapsibleSection", () => {
  it("renders title", () => {
    render(
      <CollapsibleSection title="Test Section" isOpen={false} onToggle={vi.fn()}>
        <p>Content</p>
      </CollapsibleSection>
    );
    expect(screen.getByText("Test Section")).toBeInTheDocument();
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection title="Click Me" isOpen={false} onToggle={onToggle}>
        <p>Content</p>
      </CollapsibleSection>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows children when open", () => {
    render(
      <CollapsibleSection title="Open" isOpen={true} onToggle={vi.fn()}>
        <p>Visible Content</p>
      </CollapsibleSection>
    );
    expect(screen.getByText("Visible Content")).toBeInTheDocument();
  });

  it("renders step number badge", () => {
    render(
      <CollapsibleSection title="Step" stepNumber={1} isOpen={false} onToggle={vi.fn()}>
        <p>Content</p>
      </CollapsibleSection>
    );
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows check icon when complete", () => {
    render(
      <CollapsibleSection title="Done" stepNumber={1} isOpen={false} isComplete={true} onToggle={vi.fn()}>
        <p>Content</p>
      </CollapsibleSection>
    );
    // The check icon replaces the step number
    expect(screen.queryByText("1")).toBeNull();
  });

  it("disabled state prevents toggle", () => {
    const onToggle = vi.fn();
    render(
      <CollapsibleSection title="Disabled" isOpen={false} onToggle={onToggle} disabled={true}>
        <p>Content</p>
      </CollapsibleSection>
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("renders custom icon", () => {
    render(
      <CollapsibleSection 
        title="With Icon" 
        icon={createElement("span", { "data-testid": "custom-icon" }, "⚙️")} 
        isOpen={true} 
        onToggle={vi.fn()}
      >
        <p>Content</p>
      </CollapsibleSection>
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });
});
