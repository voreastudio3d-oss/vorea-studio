import type { InstructionSpecV1 } from "./instruction-spec";

export interface FdmValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateFdmSpec(spec: InstructionSpecV1): FdmValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const wall = Number(spec.constraints.min_wall_thickness_mm ?? 0);
  if (!Number.isFinite(wall) || wall <= 0) {
    errors.push("min_wall_thickness_mm debe ser un numero positivo.");
  } else if (wall < 1.2) {
    warnings.push("Espesor minimo menor a 1.2mm puede fallar en FDM.");
  }

  if (spec.printProfile !== "fdm") {
    errors.push("printProfile invalido para este validador.");
  }

  const qualityParameter = spec.parameters.find((parameter) => parameter.name === "quality_level");
  if (!qualityParameter) {
    errors.push("Falta parametro quality_level.");
  }

  if (spec.engine === "organic" && spec.family === "lamp-shell") {
    warnings.push("Revisar puentes largos en geometria de lampara.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
