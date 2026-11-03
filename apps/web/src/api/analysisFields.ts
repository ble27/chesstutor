import { isRecord } from "./validation";

export function object(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Expected object");
  return value;
}
export function text(value: unknown, max = 200): string {
  if (typeof value !== "string" || value.length > max || !value.length)
    throw new Error("Invalid text");
  return value;
}
export function integer(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error("Invalid integer");
  return value;
}
export function flag(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("Expected boolean");
  return value;
}
export function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error("Invalid array");
  return value;
}
export function color(value: unknown): "white" | "black" {
  if (value !== "white" && value !== "black") throw new Error("Invalid color");
  return value;
}
export function identifier(value: unknown): string {
  const id = text(value, 36);
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id))
    throw new Error("Invalid id");
  return id;
}
export function date(value: unknown): string {
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error("Invalid date");
  return result;
}
