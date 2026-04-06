import type { InstructionSpecV1 } from "../instruction-spec";

export function getNumberParameter(spec: InstructionSpecV1, name: string, fallback: number): number {
  const parameter = spec.parameters.find((item) => item.name === name);
  const value = Number(parameter?.defaultValue);
  return Number.isFinite(value) ? value : fallback;
}

export function getStringParameter(spec: InstructionSpecV1, name: string, fallback: string): string {
  const parameter = spec.parameters.find((item) => item.name === name);
  return typeof parameter?.defaultValue === "string" ? parameter.defaultValue : fallback;
}

export function getBoolParameter(spec: InstructionSpecV1, name: string, fallback: boolean): boolean {
  const parameter = spec.parameters.find((item) => item.name === name);
  return typeof parameter?.defaultValue === "boolean" ? parameter.defaultValue : fallback;
}

export function formatScadString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ");
}

export function formatScadNumber(value: number): string {
  const normalized = Number(value.toFixed(4));
  return Number.isInteger(normalized) ? `${normalized}` : `${normalized}`;
}
