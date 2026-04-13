import { describe, expect, it } from "vitest";

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

const ALL_MODELS = [
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

describe("3D model SCAD templates", () => {
  it.each(ALL_MODELS)(
    "$name exports a non-empty OpenSCAD template string",
    ({ scad }) => {
      expect(typeof scad).toBe("string");
      expect(scad.length).toBeGreaterThan(100);
    }
  );

  it.each(ALL_MODELS)(
    "$name template contains valid OpenSCAD syntax markers",
    ({ scad }) => {
      const hasModule = /module\s+\w+/.test(scad);
      const hasVariable = /\w+\s*=\s*.+;/.test(scad);
      expect(hasModule || hasVariable).toBe(true);
    }
  );
});
