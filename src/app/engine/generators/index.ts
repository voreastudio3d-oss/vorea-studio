import type { InstructionSpecV1, ParametricScadResult } from "../instruction-spec";
import { generateFdmUtilityScad } from "./fdm-utility";
import { generateOrganicDecorativeScad } from "./organic-decorative";
import { formatScadString, formatScadNumber } from "./parameter-values";

function generateDynamicScad(spec: InstructionSpecV1): ParametricScadResult {
  const sourcePrompt = spec.prompt.replace(/\n+/g, " ").trim();
  
  let header = `// AI Parametric Pipeline v1.0 (Dynamic CMS)\n`;
  header += `// Engine: ${spec.engine}\n`;
  header += `// Family: ${spec.family}\n`;
  header += `// Prompt: ${sourcePrompt}\n\n`;

  for (const param of spec.parameters) {
    let annotation = `// ${param.description || param.name}`;
    
    if (param.type === "number") {
      if (typeof param.min === "number" && typeof param.max === "number") {
        annotation = `// [${param.min}:${param.step || 1}:${param.max}] ${param.description || ""}`;
      }
    }
    
    let valStr = "";
    if (param.type === "number") {
      valStr = formatScadNumber(Number(param.defaultValue));
    } else if (param.type === "bool") {
      valStr = param.defaultValue ? "true" : "false";
    } else {
      valStr = `"${formatScadString(String(param.defaultValue))}"`; // strings need quotes in openSCAD
    }
    header += `${param.name} = ${valStr}; ${annotation}\n`;
  }
  
  header += `\n`;

  return {
    modelName: spec.family,
    scad: header + (spec.scadTemplate || `// ERROR: No scadTemplate provided matching family: ${spec.family}`),
  };
}

export function generateScadFromSpec(spec: InstructionSpecV1): ParametricScadResult {
  if (spec.scadTemplate) {
    return generateDynamicScad(spec);
  }
  
  // Legacy fallback for tests or missing templates
  if (spec.engine === "fdm") {
    return generateFdmUtilityScad(spec);
  }
  return generateOrganicDecorativeScad(spec);
}
