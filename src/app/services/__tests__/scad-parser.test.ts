import { expect, test, describe } from "vitest";
import { parseScad, regenerateScad } from "../scad-parser";

describe("OpenSCAD Customizer Annotation Parser", () => {
  test("Extracts simple dropdown choices", () => {
    const raw = `
// Some section
size = 10; // [10:Small, 20:Medium, 30:Large]
color = "red"; // [red, green, blue]
`;
    const res = parseScad(raw);
    expect(res.params).toHaveLength(2);
    
    // Check size param
    expect(res.params[0].name).toBe("size");
    expect(res.params[0].type).toBe("number");
    expect(res.params[0].choices).toBeDefined();
    expect(res.params[0].choices).toEqual([
      { value: 10, label: "Small" },
      { value: 20, label: "Medium" },
      { value: 30, label: "Large" },
    ]);

    // Check color param
    expect(res.params[1].name).toBe("color");
    expect(res.params[1].type).toBe("string");
    expect(res.params[1].choices).toBeDefined();
    expect(res.params[1].choices).toEqual([
      { value: "red", label: "red" },
      { value: "green", label: "green" },
      { value: "blue", label: "blue" },
    ]);
  });

  test("Extracts array of options without labels", () => {
    const raw = `
thickness = 1.5; // [1.0, 1.5, 2.0]
    `;
    const res = parseScad(raw);
    expect(res.params[0].choices).toEqual([
      { value: 1.0, label: "1.0" },
      { value: 1.5, label: "1.5" },
      { value: 2.0, label: "2.0" },
    ]);
  });

  test("Ignores standard ranges", () => {
    const raw = `width = 50; // [1:100]`;
    const res = parseScad(raw);
    expect(res.params[0].choices).toBeUndefined();
    expect(res.params[0].range).toEqual({ min: 1, max: 100, step: 1 });
  });
});
