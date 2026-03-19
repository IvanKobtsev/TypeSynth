/**
 * Converts TS types into their C# equivalents.
 */
function csType(type: string): string {
  switch (type) {
    case "string":
      return "string";
    case "number":
      return "int";
    case "boolean":
      return "bool";
    case "array":
      return "List<string>";
    case "date":
      return "DateTime";
    default:
      throw new Error(`Unknown type "${type}"`);
  }
}

/**
 * Checks if the node is a group (i.e., has children but no route).
 * Groups are used for organizational purposes and do not correspond to actual endpoints.
 */
function isGroup(node: any) {
  return !node.route;
}

/**
 * Checks if the node is a route (i.e., has a route property).
 */
function isRoute(node: any) {
  return !!node.route;
}

/**
 * Converts a field name into its C# property name equivalent by capitalizing the first letter.
 */
function csFieldName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Produces a C# expression (depending on type) that checks
 * whether the value is null or not.
 */
function csNullableCheck(fieldName: string, type: string) {
  const csField = csFieldName(fieldName);

  switch (type) {
    case "string":
      return `!string.IsNullOrEmpty(${csField})`;
    case "number":
    case "boolean":
    case "date":
      return `${csField} != null`;
    case "array":
      return `${csField} is { Count: > 0 }`;
    default:
      throw new Error(`Unknown type "${type}" for field "${fieldName}"`);
  }
}

/**
 * Produces a C# expression that retrieves
 * the value to then concatenate it as query parameter.
 */
function csNullableValue(fieldName: string, type: string) {
  const csField = csFieldName(fieldName);

  switch (type) {
    case "string":
      return csField;
    case "boolean":
    case "number":
      return `${csField}.Value`;
    case "array":
      return `string.Join(",", ${csField})`;
    case "date":
      return `${csField}.Value`;
    default:
      throw new Error(`Unknown type "${type}" for field "${fieldName}"`);
  }
}

export default {
  isGroup,
  isRoute,
  csType,
  csFieldName,
  csNullableCheck,
  csNullableValue,
};
