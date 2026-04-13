/**
 * Parametric Models — structural validation tests.
 * Verifies all SCAD model templates are valid, non-empty, and contain
 * expected OpenSCAD constructs.
 */
import { describe, it, expect } from "vitest";

// Import all model templates
import { CABLE_CLIP_SCAD } from "../cable-clip";
import { DRAWER_ORGANIZER_TRAY_SCAD } from "../drawer-organizer-tray";
import { GRIDFINITY_BASE_SCAD } from "../gridfinity-base";
import { LAMP_SHADE_KIT_SCAD } from "../lamp-shade-kit";
import { NAMEPLATE_PRO_SCAD } from "../nameplate-pro";
import { PEG_LABEL_SYSTEM_SCAD } from "../peg-label-system";
import { PHONE_STAND_SCAD } from "../phone-stand";
import { PLANTER_DRIP_SYSTEM_SCAD } from "../planter-drip-system";
import { ROUNDED_BOX_SCAD } from "../rounded-box";
import { SKADIS_BIN_SCAD } from "../skadis-bin";
import { TEXT_KEYCHAIN_TAG_SCAD } from "../text-keychain-tag";
import { THREADED_JAR_SCAD } from "../threaded-jar";

const ALL_MODELS: Array<{ name: string; scad: string }> = [
  { name: "cable-clip", scad: CABLE_CLIP_SCAD },
  { name: "drawer-organizer-tray", scad: DRAWER_ORGANIZER_TRAY_SCAD },
  { name: "gridfinity-base", scad: GRIDFINITY_BASE_SCAD },
  { name: "lamp-shade-kit", scad: LAMP_SHADE_KIT_SCAD },
  { name: "nameplate-pro", scad: NAMEPLATE_PRO_SCAD },
  { name: "peg-label-system", scad: PEG_LABEL_SYSTEM_SCAD },
  { name: "phone-stand", scad: PHONE_STAND_SCAD },
  { name: "planter-drip-system", scad: PLANTER_DRIP_SYSTEM_SCAD },
  { name: "rounded-box", scad: ROUNDED_BOX_SCAD },
  { name: "skadis-bin", scad: SKADIS_BIN_SCAD },
  { name: "text-keychain-tag", scad: TEXT_KEYCHAIN_TAG_SCAD },
  { name: "threaded-jar", scad: THREADED_JAR_SCAD },
];

describe("parametric models — structural validation", () => {
  it.each(ALL_MODELS)("$name exports non-empty SCAD string", ({ scad }) => {
    expect(typeof scad).toBe("string");
    expect(scad.length).toBeGreaterThan(50);
  });

  it.each(ALL_MODELS)("$name contains valid OpenSCAD structure", ({ scad }) => {
    // Should have balanced braces
    const opens = (scad.match(/{/g) || []).length;
    const closes = (scad.match(/}/g) || []).length;
    expect(opens).toBe(closes);

    // Should have balanced parentheses
    const parensOpen = (scad.match(/\(/g) || []).length;
    const parensClose = (scad.match(/\)/g) || []).length;
    expect(parensOpen).toBe(parensClose);

    // Should have balanced brackets
    const bracketOpen = (scad.match(/\[/g) || []).length;
    const bracketClose = (scad.match(/\]/g) || []).length;
    expect(bracketOpen).toBe(bracketClose);
  });

  it.each(ALL_MODELS)("$name contains parameter annotations", ({ scad }) => {
    // All parametric models should have parameter comments like // [min:step:max]
    const hasParams = /\/\/\s*\[/.test(scad) || /=\s*\d/.test(scad);
    expect(hasParams).toBe(true);
  });

  it.each(ALL_MODELS)("$name ends with semicolons or closing braces", ({ scad }) => {
    const trimmed = scad.trim();
    const lastChar = trimmed[trimmed.length - 1];
    expect([";", "}"].includes(lastChar)).toBe(true);
  });
});
