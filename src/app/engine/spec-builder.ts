import type {
  InstructionSpecV1,
  ParametricEngine,
  ParametricFamily,
  ParametricIntent,
  ParametricParameter,
  ParametricPipelineInput,
  QualityProfile,
} from "./instruction-spec";
import { PARAMETRIC_FAMILIES as FAMILY_MAP } from "./instruction-spec";

export function includesAny(prompt: string, words: string[]): boolean {
  return words.some((word) => prompt.includes(word));
}

function isFamilyForEngine(engine: ParametricEngine, family: string): boolean {
  return FAMILY_MAP[engine].includes(family as never);
}

function resolveFamilyFromPrompt(engine: ParametricEngine, normalizedPrompt: string): ParametricFamily {
  if (engine === "fdm") {
    if (
      includesAny(normalizedPrompt, [
        "pegboard",
        "peg board",
        "peg label",
        "bin label",
        "storage label",
        "shelf label",
        "workshop label",
        "tool label",
        "etiqueta de taller",
        "etiqueta de estante",
        "etiqueta de caja",
      ])
    ) {
      return "peg-label-system";
    }
    if (
      includesAny(normalizedPrompt, [
        "threaded jar",
        "screw lid",
        "jar",
        "frasco",
        "tarro",
        "bote",
        "container roscado",
        "contenedor roscado",
        "spice jar",
        "pill jar",
      ])
    ) {
      return "threaded-jar";
    }
    if (includesAny(normalizedPrompt, ["box", "caja", "contenedor", "storage", "bin"])) {
      return "storage-box";
    }
    if (includesAny(normalizedPrompt, ["planter", "maceta", "pot", "plant", "drip", "bandeja de goteo", "jardin"])) {
      return "planter-drip-system";
    }
    if (includesAny(normalizedPrompt, ["lamp", "lampara", "shade", "pantalla", "light", "luminaire", "screen"])) {
      return "lamp-shade-kit";
    }
    if (includesAny(normalizedPrompt, ["keychain", "llavero", "nametag", "name tag", "tag", "etiqueta", "nombre", "texto"])) {
      return "text-keychain-tag";
    }
    if (includesAny(normalizedPrompt, ["nameplate", "placa", "cartel", "letrero", "signage", "desk sign", "desk name"])) {
      return "nameplate-pro";
    }
    if (includesAny(normalizedPrompt, ["drawer", "tray", "organizer", "organizador", "bandeja", "cajon", "divider"])) {
      return "drawer-organizer-tray";
    }
    if (includesAny(normalizedPrompt, ["phone", "telefono", "stand", "soporte", "tablet"])) {
      return "phone-stand";
    }
    return "utility-hook";
  }

  if (includesAny(normalizedPrompt, ["vase", "jarron", "vasija", "florero"])) {
    return "vase-wave";
  }
  if (includesAny(normalizedPrompt, ["lamp", "lampara", "light", "iluminacion"])) {
    return "lamp-shell";
  }
  return "decorative-tower";
}

function resolveFamily(input: ParametricPipelineInput, normalizedPrompt: string): {
  family: ParametricFamily;
  warning?: string;
} {
  const hint = input.familyHint;
  if (hint && isFamilyForEngine(input.engine, hint)) {
    return { family: hint };
  }
  if (hint && !isFamilyForEngine(input.engine, hint)) {
    return {
      family: resolveFamilyFromPrompt(input.engine, normalizedPrompt),
      warning: `familyHint '${hint}' incompatible con engine '${input.engine}', se aplico deteccion automatica.`,
    };
  }
  return { family: resolveFamilyFromPrompt(input.engine, normalizedPrompt) };
}

function buildQualityParameter(engine: ParametricEngine, qualityProfile: QualityProfile): ParametricParameter {
  return {
    name: "quality_level",
    type: "number",
    defaultValue: qualityProfile === "final" ? 1 : 0,
    min: 0,
    max: 1,
    step: 1,
    description:
      engine === "fdm"
        ? "0=draft rapido, 1=final detallado"
        : "0=draft para iterar, 1=final para exportar",
  };
}

function buildFamilyParameters(family: ParametricFamily): ParametricParameter[] {
  switch (family) {
    case "storage-box":
      return [
        { name: "width", type: "number", defaultValue: 90, min: 30, max: 220, step: 5, description: "Ancho de caja" },
        { name: "depth", type: "number", defaultValue: 60, min: 20, max: 180, step: 5, description: "Profundidad" },
        { name: "height", type: "number", defaultValue: 45, min: 15, max: 140, step: 5, description: "Altura" },
        { name: "wall", type: "number", defaultValue: 2.2, min: 1.2, max: 6, step: 0.2, description: "Grosor de pared" },
        { name: "corner_r", type: "number", defaultValue: 4, min: 0, max: 15, step: 1, description: "Radio de esquina" },
        { name: "lip", type: "number", defaultValue: 1.0, min: 0, max: 3, step: 0.2, description: "Labio superior" },
      ];
    case "phone-stand":
      return [
        { name: "base_w", type: "number", defaultValue: 82, min: 45, max: 140, step: 1, description: "Ancho base" },
        { name: "base_d", type: "number", defaultValue: 70, min: 35, max: 130, step: 1, description: "Profundidad base" },
        { name: "base_h", type: "number", defaultValue: 6, min: 3, max: 16, step: 1, description: "Espesor base" },
        { name: "back_h", type: "number", defaultValue: 118, min: 60, max: 190, step: 2, description: "Altura respaldo" },
        { name: "angle", type: "number", defaultValue: 67, min: 45, max: 82, step: 1, description: "Angulo" },
        { name: "lip_h", type: "number", defaultValue: 12, min: 6, max: 28, step: 1, description: "Altura labio" },
        { name: "thick", type: "number", defaultValue: 4, min: 2, max: 8, step: 0.5, description: "Grosor" },
      ];
    case "drawer-organizer-tray":
      return [
        { name: "width", type: "number", defaultValue: 140, min: 50, max: 280, step: 5, description: "Ancho exterior" },
        { name: "depth", type: "number", defaultValue: 95, min: 40, max: 220, step: 5, description: "Profundidad exterior" },
        { name: "height", type: "number", defaultValue: 34, min: 12, max: 90, step: 2, description: "Altura total" },
        { name: "wall", type: "number", defaultValue: 2.4, min: 1.2, max: 6, step: 0.2, description: "Grosor de pared" },
        { name: "floor", type: "number", defaultValue: 1.8, min: 1, max: 5, step: 0.2, description: "Grosor de base" },
        { name: "cells_x", type: "number", defaultValue: 3, min: 1, max: 8, step: 1, description: "Cantidad de celdas en X" },
        { name: "cells_y", type: "number", defaultValue: 2, min: 1, max: 6, step: 1, description: "Cantidad de celdas en Y" },
        { name: "corner_r", type: "number", defaultValue: 6, min: 0, max: 18, step: 1, description: "Radio de esquina" },
        { name: "lip", type: "number", defaultValue: 1.2, min: 0, max: 4, step: 0.2, description: "Refuerzo superior" },
      ];
    case "planter-drip-system":
      return [
        { name: "top_d", type: "number", defaultValue: 128, min: 60, max: 240, step: 2, description: "Diametro superior" },
        { name: "bottom_d", type: "number", defaultValue: 88, min: 40, max: 200, step: 2, description: "Diametro inferior" },
        { name: "pot_h", type: "number", defaultValue: 96, min: 40, max: 220, step: 2, description: "Altura de maceta" },
        { name: "wall", type: "number", defaultValue: 2.2, min: 1.2, max: 6, step: 0.2, description: "Grosor de pared" },
        { name: "floor", type: "number", defaultValue: 2.4, min: 1.2, max: 6, step: 0.2, description: "Grosor de base" },
        { name: "drain_holes", type: "number", defaultValue: 5, min: 1, max: 12, step: 1, description: "Cantidad de drenajes" },
        { name: "drain_d", type: "number", defaultValue: 6, min: 2, max: 14, step: 0.5, description: "Diametro de drenaje" },
        { name: "tray_gap", type: "number", defaultValue: 3.2, min: 1, max: 10, step: 0.2, description: "Holgura entre maceta y bandeja" },
        { name: "tray_depth", type: "number", defaultValue: 14, min: 6, max: 32, step: 1, description: "Profundidad de bandeja" },
        { name: "foot_h", type: "number", defaultValue: 4, min: 0, max: 12, step: 0.5, description: "Altura de patas" },
      ];
    case "lamp-shade-kit":
      return [
        { name: "top_d", type: "number", defaultValue: 158, min: 80, max: 260, step: 2, description: "Diametro superior" },
        { name: "bottom_d", type: "number", defaultValue: 92, min: 50, max: 180, step: 2, description: "Diametro inferior" },
        { name: "shade_h", type: "number", defaultValue: 148, min: 60, max: 280, step: 2, description: "Altura de pantalla" },
        { name: "wall", type: "number", defaultValue: 1.8, min: 1.2, max: 4, step: 0.1, description: "Grosor de pared" },
        { name: "openings", type: "number", defaultValue: 18, min: 6, max: 36, step: 1, description: "Aberturas por fila" },
        { name: "vent_rows", type: "number", defaultValue: 4, min: 1, max: 8, step: 1, description: "Filas de ventilacion" },
        { name: "vent_d", type: "number", defaultValue: 9, min: 3, max: 18, step: 0.5, description: "Diametro de abertura" },
        { name: "seat_d", type: "number", defaultValue: 42, min: 20, max: 80, step: 0.5, description: "Diametro del kit" },
        { name: "seat_h", type: "number", defaultValue: 12, min: 4, max: 28, step: 1, description: "Altura del collar" },
        { name: "fit", type: "number", defaultValue: 0.5, min: 0.1, max: 2, step: 0.1, description: "Holgura del encastre" },
      ];
    case "text-keychain-tag":
      return [
        { name: "tag_w", type: "number", defaultValue: 72, min: 40, max: 120, step: 2, description: "Ancho total del llavero" },
        { name: "tag_h", type: "number", defaultValue: 28, min: 18, max: 54, step: 1, description: "Altura total del llavero" },
        { name: "thick", type: "number", defaultValue: 3.2, min: 2, max: 6, step: 0.2, description: "Espesor del cuerpo" },
        { name: "corner_r", type: "number", defaultValue: 7, min: 0, max: 18, step: 0.5, description: "Radio de esquina" },
        { name: "hole_d", type: "number", defaultValue: 5, min: 3, max: 10, step: 0.2, description: "Diametro del ojal" },
        { name: "hole_margin", type: "number", defaultValue: 10, min: 5, max: 22, step: 0.5, description: "Margen del ojal desde el borde" },
        { name: "text_size", type: "number", defaultValue: 9, min: 4, max: 18, step: 0.5, description: "Tamano del texto" },
        { name: "text_depth", type: "number", defaultValue: 1.1, min: 0.4, max: 3, step: 0.1, description: "Altura o profundidad del texto" },
        { name: "label_text", type: "string", defaultValue: "VOREA", description: "Texto principal del llavero" },
        { name: "engraved", type: "bool", defaultValue: false, description: "Texto grabado en vez de relieve" },
      ];
    case "nameplate-pro":
      return [
        { name: "plate_w", type: "number", defaultValue: 120, min: 60, max: 220, step: 2, description: "Ancho total de la placa" },
        { name: "plate_h", type: "number", defaultValue: 36, min: 20, max: 80, step: 1, description: "Alto visible de la placa" },
        { name: "plate_d", type: "number", defaultValue: 4.2, min: 2, max: 10, step: 0.2, description: "Espesor del cuerpo" },
        { name: "corner_r", type: "number", defaultValue: 4, min: 0, max: 16, step: 0.5, description: "Radio de esquina" },
        { name: "text_size", type: "number", defaultValue: 14, min: 6, max: 28, step: 0.5, description: "Tamano del texto" },
        { name: "text_depth", type: "number", defaultValue: 1.2, min: 0.4, max: 4, step: 0.1, description: "Relieve o grabado del texto" },
        { name: "border_w", type: "number", defaultValue: 2.2, min: 0.8, max: 6, step: 0.2, description: "Ancho del marco frontal" },
        { name: "stand_angle", type: "number", defaultValue: 74, min: 60, max: 88, step: 1, description: "Angulo de lectura" },
        { name: "label_text", type: "string", defaultValue: "VOREA", description: "Texto principal de la placa con auto-ajuste y hasta 2 lineas" },
        { name: "border", type: "bool", defaultValue: true, description: "Agregar marco frontal" },
        { name: "base_stand", type: "bool", defaultValue: true, description: "Agregar base de apoyo" },
        { name: "engraved", type: "bool", defaultValue: false, description: "Texto grabado en vez de relieve" },
      ];
    case "peg-label-system":
      return [
        { name: "label_w", type: "number", defaultValue: 84, min: 40, max: 180, step: 2, description: "Ancho frontal de la etiqueta" },
        { name: "label_h", type: "number", defaultValue: 24, min: 16, max: 60, step: 1, description: "Alto frontal de la etiqueta" },
        { name: "label_d", type: "number", defaultValue: 3.2, min: 2, max: 8, step: 0.2, description: "Espesor del cuerpo" },
        { name: "corner_r", type: "number", defaultValue: 4, min: 0, max: 14, step: 0.5, description: "Radio de esquina" },
        { name: "text_size", type: "number", defaultValue: 8.5, min: 4, max: 20, step: 0.5, description: "Tamano del texto" },
        { name: "text_depth", type: "number", defaultValue: 1, min: 0.4, max: 3, step: 0.1, description: "Relieve o grabado del texto" },
        { name: "border_w", type: "number", defaultValue: 1.6, min: 0.6, max: 5, step: 0.2, description: "Ancho del marco frontal" },
        { name: "hook_gap", type: "number", defaultValue: 4.2, min: 1.5, max: 12, step: 0.2, description: "Espesor del soporte donde engancha" },
        { name: "hook_depth", type: "number", defaultValue: 8, min: 4, max: 20, step: 0.5, description: "Profundidad del clip trasero" },
        { name: "hook_drop", type: "number", defaultValue: 12, min: 6, max: 32, step: 0.5, description: "Caida vertical del clip" },
        { name: "hook_spacing", type: "number", defaultValue: 42, min: 18, max: 120, step: 1, description: "Separacion entre clips" },
        { name: "label_text", type: "string", defaultValue: "BITS", description: "Texto principal de la etiqueta con auto-ajuste y hasta 2 lineas" },
        { name: "border", type: "bool", defaultValue: true, description: "Agregar marco frontal" },
        { name: "engraved", type: "bool", defaultValue: false, description: "Texto grabado en vez de relieve" },
      ];
    case "threaded-jar":
      return [
        { name: "body_d", type: "number", defaultValue: 74, min: 36, max: 140, step: 2, description: "Diametro exterior del frasco" },
        { name: "jar_h", type: "number", defaultValue: 82, min: 30, max: 180, step: 2, description: "Altura total del frasco" },
        { name: "wall", type: "number", defaultValue: 2.4, min: 1.2, max: 6, step: 0.2, description: "Grosor de pared" },
        { name: "floor", type: "number", defaultValue: 3, min: 1.2, max: 8, step: 0.2, description: "Espesor de base" },
        { name: "neck_h", type: "number", defaultValue: 16, min: 8, max: 36, step: 0.5, description: "Altura de zona roscada" },
        { name: "thread_pitch", type: "number", defaultValue: 4, min: 2, max: 8, step: 0.2, description: "Paso de la rosca" },
        { name: "thread_turns", type: "number", defaultValue: 2.5, min: 1, max: 5, step: 0.25, description: "Vueltas de rosca" },
        { name: "thread_depth", type: "number", defaultValue: 1.75, min: 0.8, max: 4, step: 0.05, description: "Altura radial visible de la rosca" },
        { name: "thread_clearance", type: "number", defaultValue: 0.35, min: 0.1, max: 1.2, step: 0.05, description: "Holgura radial de la rosca" },
        { name: "fit_slop", type: "number", defaultValue: 0.12, min: 0, max: 0.6, step: 0.02, description: "Compensacion extra por material o slicer" },
        { name: "lead_in", type: "number", defaultValue: 1.2, min: 0.4, max: 4, step: 0.1, description: "Entrada de guiado para iniciar la rosca" },
        { name: "lid_h", type: "number", defaultValue: 20, min: 10, max: 40, step: 0.5, description: "Altura de tapa" },
        { name: "lid_clearance", type: "number", defaultValue: 0.6, min: 0.2, max: 1.6, step: 0.05, description: "Holgura entre tapa y frasco" },
        { name: "lid_knurl", type: "number", defaultValue: 18, min: 0, max: 36, step: 1, description: "Cantidad de nervios exteriores" },
      ];
    case "utility-hook":
      return [
        { name: "hook_w", type: "number", defaultValue: 20, min: 10, max: 60, step: 1, description: "Ancho gancho" },
        { name: "hook_h", type: "number", defaultValue: 48, min: 20, max: 120, step: 1, description: "Alto gancho" },
        { name: "hook_d", type: "number", defaultValue: 26, min: 10, max: 80, step: 1, description: "Profundidad gancho" },
        { name: "thick", type: "number", defaultValue: 4, min: 2, max: 10, step: 0.5, description: "Grosor" },
        { name: "screw_d", type: "number", defaultValue: 4.2, min: 3, max: 8, step: 0.1, description: "Diametro tornillo" },
      ];
    case "vase-wave":
      return [
        { name: "base_r", type: "number", defaultValue: 26, min: 12, max: 80, step: 1, description: "Radio base" },
        { name: "top_r", type: "number", defaultValue: 38, min: 12, max: 90, step: 1, description: "Radio superior" },
        { name: "height", type: "number", defaultValue: 120, min: 40, max: 260, step: 2, description: "Altura" },
        { name: "wall", type: "number", defaultValue: 2.1, min: 1.2, max: 5, step: 0.1, description: "Grosor" },
        { name: "waves", type: "number", defaultValue: 8, min: 2, max: 16, step: 1, description: "Ondas" },
        { name: "twist", type: "number", defaultValue: 26, min: 0, max: 160, step: 1, description: "Twist" },
      ];
    case "lamp-shell":
      return [
        { name: "outer_r", type: "number", defaultValue: 52, min: 20, max: 120, step: 1, description: "Radio exterior" },
        { name: "inner_r", type: "number", defaultValue: 47, min: 15, max: 110, step: 1, description: "Radio interior" },
        { name: "height", type: "number", defaultValue: 145, min: 60, max: 320, step: 2, description: "Altura" },
        { name: "holes", type: "number", defaultValue: 16, min: 6, max: 32, step: 1, description: "Cantidad de perforaciones" },
        { name: "hole_r", type: "number", defaultValue: 4.8, min: 2, max: 12, step: 0.2, description: "Radio de perforacion" },
        { name: "twist", type: "number", defaultValue: 18, min: 0, max: 80, step: 1, description: "Twist" },
      ];
    case "decorative-tower":
      return [
        { name: "radius", type: "number", defaultValue: 28, min: 10, max: 80, step: 1, description: "Radio" },
        { name: "height", type: "number", defaultValue: 130, min: 50, max: 320, step: 2, description: "Altura" },
        { name: "lobes", type: "number", defaultValue: 5, min: 3, max: 10, step: 1, description: "Lobulos" },
        { name: "twist", type: "number", defaultValue: 42, min: 0, max: 180, step: 1, description: "Twist" },
      ];
    default:
      return [];
  }
}

export function buildParameterBlueprint(
  engine: ParametricEngine,
  family: ParametricFamily,
  qualityProfile: QualityProfile
): ParametricParameter[] {
  return [buildQualityParameter(engine, qualityProfile), ...buildFamilyParameters(family)];
}

function applyParameterOverrides(
  parameters: ParametricParameter[],
  overrides?: Record<string, number | string | boolean>
): { parameters: ParametricParameter[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!overrides || Object.keys(overrides).length === 0) {
    return { parameters, warnings };
  }

  const nextParameters = parameters.map((parameter) => ({ ...parameter }));
  const byName = new Map(nextParameters.map((parameter) => [parameter.name, parameter]));

  for (const [name, rawValue] of Object.entries(overrides)) {
    const target = byName.get(name);
    if (!target) {
      warnings.push(`Parametro override desconocido: ${name}.`);
      continue;
    }

    if (target.type !== "number") {
      target.defaultValue = rawValue;
      continue;
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      warnings.push(`Parametro ${name} invalido: se esperaba numero.`);
      continue;
    }

    let normalized = value;
    if (typeof target.min === "number" && normalized < target.min) {
      warnings.push(`Parametro ${name} por debajo de min (${target.min}). Se ajusto.`);
      normalized = target.min;
    }
    if (typeof target.max === "number" && normalized > target.max) {
      warnings.push(`Parametro ${name} por encima de max (${target.max}). Se ajusto.`);
      normalized = target.max;
    }

    target.defaultValue = normalized;
  }

  return { parameters: nextParameters, warnings };
}

function buildWarnings(input: ParametricPipelineInput, familyWarning?: string, overrideWarnings: string[] = []): string[] {
  const warnings: string[] = [];
  if (familyWarning) warnings.push(familyWarning);
  warnings.push(...overrideWarnings);

  if (input.prompt.trim().length < 12) {
    warnings.push("Prompt corto: la geometria sera generica.");
  }
  if (input.engine === "organic" && input.qualityProfile === "final") {
    warnings.push("Perfil final en organico puede incrementar tiempo de compilacion.");
  }
  return warnings;
}

export function classifyPromptIntent(normalizedPrompt: string): ParametricIntent {
  if (
    includesAny(normalizedPrompt, [
      "engrave",
      "engraved",
      "engraving",
      "grabado",
      "grabar",
      "texto",
      "text",
      "nombre",
      "name",
      "lettering",
      "label",
      "letras",
    ])
  ) {
    return "text_or_engraving";
  }

  if (
    includesAny(normalizedPrompt, [
      "template",
      "plantilla",
      "adapt",
      "adaptar",
      "modify",
      "modificar",
      "variant",
      "variante",
      "based on",
      "basado en",
      "usar base",
    ])
  ) {
    return "adapt_template";
  }

  if (
    includesAny(normalizedPrompt, [
      "mm",
      "cm",
      "diametro",
      "diámetro",
      "radius",
      "radio",
      "alto",
      "altura",
      "ancho",
      "profundidad",
      "width",
      "height",
      "depth",
      "x",
      "medidas",
      "measurements",
    ])
  ) {
    return "dimension_customization";
  }

  if (includesAny(normalizedPrompt, ["functional", "funcional", "resistente", "fuerte", "utilitario", "utility"])) {
    return "functional_part";
  }

  if (includesAny(normalizedPrompt, ["decorative", "decorativo", "artistico", "artístico", "organico", "organic"])) {
    return "decorative_part";
  }

  return "create_from_scratch";
}

export function buildInstructionSpec(input: ParametricPipelineInput): InstructionSpecV1 {
  const prompt = input.prompt.trim();
  const normalizedPrompt = prompt.toLowerCase();
  const { family, warning: familyWarning } = resolveFamily(input, normalizedPrompt);

  const tags: string[] = [input.engine, family, input.qualityProfile];
  if (includesAny(normalizedPrompt, ["fdm", "print", "impresion", "imprimir"])) {
    tags.push("print");
  }

  const constraints: Record<string, string | number | boolean> = {
    min_wall_thickness_mm: input.engine === "fdm" ? 1.2 : 0.8,
    allow_supports: input.engine === "organic",
    profile: input.qualityProfile,
  };

  const blueprint = buildParameterBlueprint(input.engine, family, input.qualityProfile);
  const { parameters, warnings: overrideWarnings } = applyParameterOverrides(
    blueprint,
    input.parameterOverrides
  );

  return {
    version: "1.0",
    prompt,
    engine: input.engine,
    family,
    intent: classifyPromptIntent(normalizedPrompt),
    qualityProfile: input.qualityProfile,
    printProfile: "fdm",
    tags,
    constraints,
    parameters,
    warnings: buildWarnings(input, familyWarning, overrideWarnings),
  };
}
