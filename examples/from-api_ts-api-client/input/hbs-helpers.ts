/**
 * Builds a function name from operationId or falls back to method + path.
 */
function operationName(op: any, method: string, path: string) {
  if (op.operationId) return op.operationId;

  return (
    method +
    path
      .replace(/[{}]/g, "")
      .split("/")
      .filter(Boolean)
      .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join("")
  );
}

/**
 * Extracts parameters array safely.
 */
function getParams(op: any) {
  return op.parameters || [];
}

function hasParams(op: any) {
  return op.parameters && op.parameters.length > 0;
}

/**
 * Converts OpenAPI types to TypeScript types (very minimal).
 */
function tsType(schema: any): string {
  if (!schema) return "any";

  switch (schema.type) {
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return `${tsType(schema.items)}[]`;
    default:
      return "string";
  }
}

export default {
  operationName,
  getParams,
  hasParams,
  tsType,
};
