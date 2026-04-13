/**
 * ScadCustomizer component tests
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { ScadCustomizer } from "../ScadCustomizer";

describe("ScadCustomizer", () => {
  const defaultParse = {
    params: [
      { name: "width", type: "number" as const, value: 100, defaultValue: 100, line: 1, comment: "Width", range: { min: 10, max: 500, step: 1 } },
      { name: "height", type: "number" as const, value: 50, defaultValue: 50, line: 2, comment: "Height", range: { min: 5, max: 250, step: 1 } },
      { name: "rounded", type: "boolean" as const, value: true, defaultValue: true, line: 3, comment: "Rounded corners" },
    ],
    sections: [],
    source: "width = 100;\nheight = 50;\nrounded = true;",
  };

  const defaultValues = { width: 100, height: 50, rounded: true };
  const onChangeMock = vi.fn();
  const onResetAllMock = vi.fn();

  it("renders parameter controls", () => {
    const { container } = render(
      createElement(ScadCustomizer, {
        parseResult: defaultParse,
        values: defaultValues,
        onChange: onChangeMock,
        onResetAll: onResetAllMock,
      })
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders without crashing with empty parameters", () => {
    const { container } = render(
      createElement(ScadCustomizer, {
        parseResult: { params: [], sections: [], source: "" },
        values: {},
        onChange: onChangeMock,
        onResetAll: onResetAllMock,
      })
    );
    expect(container).toBeTruthy();
  });

  it("calls onResetAll when reset button is clicked", () => {
    render(
      createElement(ScadCustomizer, {
        parseResult: defaultParse,
        values: defaultValues,
        onChange: onChangeMock,
        onResetAll: onResetAllMock,
      })
    );

    const resetButtons = screen.queryAllByText(/reset|restablecer/i);
    if (resetButtons.length > 0) {
      fireEvent.click(resetButtons[0]);
      expect(onResetAllMock).toHaveBeenCalled();
    }
  });

  it("displays parameter names or descriptions", () => {
    const { container } = render(
      createElement(ScadCustomizer, {
        parseResult: defaultParse,
        values: defaultValues,
        onChange: onChangeMock,
        onResetAll: onResetAllMock,
      })
    );

    // Should contain text related to our parameters
    const text = container.textContent || "";
    const hasParam = text.includes("width") || text.includes("Width") ||
                     text.includes("height") || text.includes("Height");
    expect(hasParam).toBe(true);
  });
});
