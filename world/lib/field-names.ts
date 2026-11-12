// The files on disk, the OMS tables and the model's JSON use snake_case names, such as smart_meter.
// The code uses camelCase names, such as smartMeter. These two functions translate at that edge,
// so every file and every recorded prompt stays exactly as it was written.

const SNAKE_CASE_NAME = /^[a-z][a-z0-9_]*$/;
const CAMEL_CASE_NAME = /^[a-z][A-Za-z0-9]*$/;

function snakeToCamel(name: string): string {
  if (!SNAKE_CASE_NAME.test(name)) return name;
  return name.replace(/_([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

function camelToSnake(name: string): string {
  if (!CAMEL_CASE_NAME.test(name)) return name;
  return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// Rename every field in a value, and in every value inside it.
// Ids such as "RPT-0001" are left alone.
function renameFields(value: unknown, rename: (name: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => renameFields(item, rename));
  if (value === null || typeof value !== "object") return value;
  const renamed: Record<string, unknown> = {};
  for (const [name, inner] of Object.entries(value)) {
    renamed[rename(name)] = renameFields(inner, rename);
  }
  return renamed;
}

// Read data written with snake_case names: { smart_meter: true } becomes { smartMeter: true }.
export function withCamelCaseNames<Shape>(value: unknown): Shape {
  return renameFields(value, snakeToCamel) as Shape;
}

// Write data with snake_case names: { smartMeter: true } becomes { smart_meter: true }.
export function withSnakeCaseNames(value: unknown): unknown {
  return renameFields(value, camelToSnake);
}
