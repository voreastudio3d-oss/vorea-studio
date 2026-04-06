export type ParametricEngine = "fdm" | "organic";
export type QualityProfile = "draft" | "final";
export type ParametricIntent =
  | "create_from_scratch"
  | "adapt_template"
  | "dimension_customization"
  | "text_or_engraving"
  | "functional_part"
  | "decorative_part";
export const PARAMETRIC_FAMILIES = {
  fdm: [
    "storage-box",
    "drawer-organizer-tray",
    "planter-drip-system",
    "lamp-shade-kit",
    "text-keychain-tag",
    "nameplate-pro",
    "peg-label-system",
    "threaded-jar",
    "phone-stand",
    "utility-hook",
  ],
  organic: ["vase-wave", "lamp-shell", "decorative-tower"],
} as const;
export type FdmFamily = typeof PARAMETRIC_FAMILIES.fdm[number];
export type OrganicFamily = typeof PARAMETRIC_FAMILIES.organic[number];
export type ParametricFamily = string;

export type ParametricValueType = "number" | "bool" | "string";

export interface ParametricParameter {
  name: string;
  type: ParametricValueType;
  defaultValue: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  description: string;
}

export interface InstructionSpecV1 {
  version: "1.0";
  prompt: string;
  engine: ParametricEngine;
  family: ParametricFamily;
  intent: ParametricIntent;
  qualityProfile: QualityProfile;
  printProfile: "fdm";
  tags: string[];
  constraints: Record<string, string | number | boolean>;
  parameters: ParametricParameter[];
  warnings: string[];
  scadTemplate?: string;
}

export interface ParametricPipelineInput {
  prompt: string;
  engine: ParametricEngine;
  qualityProfile: QualityProfile;
  familyHint?: ParametricFamily;
  parameterOverrides?: Record<string, number | string | boolean>;
  scadTemplate?: string;
  parametersBlueprint?: ParametricParameter[];
}

export interface ParametricScadResult {
  modelName: string;
  scad: string;
}

export interface ParametricGenerationResult {
  spec: InstructionSpecV1;
  output: ParametricScadResult;
}
