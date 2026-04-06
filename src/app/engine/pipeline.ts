import type {
  InstructionSpecV1,
  ParametricGenerationResult,
  ParametricPipelineInput,
  ParametricScadResult,
} from "./instruction-spec";
import { generateScadFromSpec } from "./generators";
import { buildInstructionSpec } from "./spec-builder";

export function runParametricPipeline(input: ParametricPipelineInput): ParametricGenerationResult {
  const spec = buildInstructionSpec(input);
  const output = generateScadFromSpec(spec);
  return { spec, output };
}

export function generateScadFromInstructionSpec(spec: InstructionSpecV1): ParametricScadResult {
  return generateScadFromSpec(spec);
}
