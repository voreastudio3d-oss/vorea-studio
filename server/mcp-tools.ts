import type { InstructionSpecV1, ParametricPipelineInput, ParametricFamily } from "../src/app/engine/instruction-spec";
import { buildInstructionSpec } from "../src/app/engine/spec-builder";
import { generateScadFromInstructionSpec, runParametricPipeline } from "../src/app/engine/pipeline";
import { validateFdmSpec } from "../src/app/engine/validation";
import { estimateCompilePreview } from "../src/app/engine/compile-preview";

export type McpInternalToolName =
  | "generate_spec"
  | "generate_scad"
  | "validate_fdm"
  | "compile_preview";

export interface McpToolSuccess {
  ok: true;
  tool: McpInternalToolName;
  output: Record<string, unknown>;
}

export interface McpToolFailure {
  ok: false;
  tool: McpInternalToolName;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type McpToolResult = McpToolSuccess | McpToolFailure;

function fail(
  tool: McpInternalToolName,
  code: string,
  message: string,
  details?: Record<string, unknown>
): McpToolFailure {
  return { ok: false, tool, error: { code, message, details } };
}

function success(tool: McpInternalToolName, output: Record<string, unknown>): McpToolSuccess {
  return { ok: true, tool, output };
}

export function executeMcpInternalTool(
  tool: McpInternalToolName,
  input: Record<string, unknown>
): McpToolResult {
  try {
    if (tool === "generate_spec") {
      const prompt = String(input.prompt || "").trim();
      const engine = input.engine === "organic" ? "organic" : "fdm";
      const qualityProfile = input.qualityProfile === "final" ? "final" : "draft";
      const familyHint = typeof input.familyHint === "string" ? (input.familyHint as ParametricFamily) : undefined;
      const parameterOverrides =
        input.parameterOverrides && typeof input.parameterOverrides === "object"
          ? (input.parameterOverrides as Record<string, number | string | boolean>)
          : undefined;
      if (!prompt) {
        return fail(tool, "VALIDATION_ERROR", "prompt es requerido");
      }
      const specInput: ParametricPipelineInput = {
        prompt,
        engine,
        qualityProfile,
        familyHint,
        parameterOverrides,
      };
      const spec = buildInstructionSpec(specInput);
      return success(tool, { spec });
    }

    if (tool === "generate_scad") {
      const spec = input.spec as InstructionSpecV1 | undefined;
      if (!spec || typeof spec !== "object") {
        return fail(tool, "VALIDATION_ERROR", "spec es requerido");
      }
      const output = generateScadFromInstructionSpec(spec);
      return success(tool, output as unknown as Record<string, unknown>);
    }

    if (tool === "validate_fdm") {
      const spec = input.spec as InstructionSpecV1 | undefined;
      if (!spec || typeof spec !== "object") {
        return fail(tool, "VALIDATION_ERROR", "spec es requerido");
      }
      const validation = validateFdmSpec(spec);
      return success(tool, validation as unknown as Record<string, unknown>);
    }

    if (tool === "compile_preview") {
      const scad = String(input.scad || "");
      const quality = input.quality === "final" ? "final" : "draft";
      if (!scad.trim()) {
        return fail(tool, "VALIDATION_ERROR", "scad es requerido");
      }
      const preview = estimateCompilePreview(scad, quality);
      return success(tool, preview as unknown as Record<string, unknown>);
    }

    return fail(tool, "TOOL_NOT_SUPPORTED", "Herramienta MCP no soportada");
  } catch (error: any) {
    return fail(tool, "INTERNAL_ERROR", error?.message || "Error interno al ejecutar herramienta");
  }
}

export function runFullGenerationForMcp(input: ParametricPipelineInput): McpToolResult {
  try {
    const result = runParametricPipeline(input);
    const validation = validateFdmSpec(result.spec);
    const preview = estimateCompilePreview(result.output.scad, input.qualityProfile);
    return success("generate_scad", {
      spec: result.spec,
      output: result.output,
      validation,
      compilePreview: preview,
    });
  } catch (error: any) {
    return fail("generate_scad", "INTERNAL_ERROR", error?.message || "No se pudo generar el modelo");
  }
}
