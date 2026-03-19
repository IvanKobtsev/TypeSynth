import {
  Project,
  SyntaxKind,
  ObjectLiteralExpression,
  Node,
  Symbol,
} from "ts-morph";
import ts from "typescript";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const externalInputPath =
  "examples/advanced_csharp-url-helpers/external-input/links.ts";
project.addSourceFileAtPath(externalInputPath);
const sourceFile = project.getSourceFileOrThrow(externalInputPath);

const paramTypeMap: Record<string, string> = {
  StringParam: "string",
  RequiredStringParam: "string",
  NumberParam: "number",
  RequiredNumberParam: "number",
  BooleanParam: "boolean",
  RequiredBooleanParam: "boolean",
  DateParam: "date",
  RequiredDateParam: "date",
  ArrayParam: "array",
  RequiredArrayParam: "array",
};

function isFlagPresent(symbol: Symbol, flag: ts.SymbolFlags): boolean {
  return (symbol.getFlags() & flag) !== 0;
}

function resolveSpreadObject(node: Node): ObjectLiteralExpression | undefined {
  let symbol = node.getSymbol();
  if (!symbol) return;

  if (isFlagPresent(symbol, ts.SymbolFlags.Alias)) {
    symbol = symbol.getAliasedSymbol();
  }

  const declarations = symbol?.getDeclarations() ?? [];

  for (const decl of declarations) {
    if (Node.isVariableDeclaration(decl)) {
      const init = decl.getInitializer();

      if (Node.isObjectLiteralExpression(init)) {
        return init;
      }
    }
  }

  return;
}

function convertParams(obj?: ObjectLiteralExpression) {
  if (!obj) return undefined;

  const result: Record<string, any> = {};

  for (const prop of obj.getProperties()) {
    if (Node.isPropertyAssignment(prop)) {
      const key = prop.getName();
      const valueText = prop.getInitializer()?.getText() ?? "";

      result[key] = paramTypeMap[valueText] ?? valueText;
    }

    if (Node.isSpreadAssignment(prop)) {
      const spreadExpr = prop.getExpression();

      const spreadObj = resolveSpreadObject(spreadExpr);

      if (spreadObj) {
        const expanded = convertParams(spreadObj);
        Object.assign(result, expanded);
      }
    }
  }

  return result;
}

function transformObject(obj: ObjectLiteralExpression): any {
  const result: Record<string, any> = {};

  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;

    const key = prop.getName();
    const initializer = prop.getInitializer();

    if (!initializer) continue;

    if (Node.isCallExpression(initializer)) {
      if (initializer.getExpression().getText() === "createRoute") {
        const args = initializer.getArguments();

        const route = args[0]?.getText().replace(/['"]/g, "");

        const routeParams = Node.isObjectLiteralExpression(args[1])
          ? args[1]
          : undefined;

        const queryParams = Node.isObjectLiteralExpression(args[2])
          ? args[2]
          : undefined;

        result[key] = {
          route,
          ...(routeParams ? { routeParams: convertParams(routeParams) } : {}),
          ...(queryParams ? { queryParams: convertParams(queryParams) } : {}),
        };

        continue;
      }
    }

    if (Node.isObjectLiteralExpression(initializer)) {
      result[key] = transformObject(initializer);
    }
  }

  return result;
}

function getQueryParamCollections(
  routesObject: any,
): Record<string, Record<string, string>> {
  const collections: Record<string, Record<string, string>> = {};

  function traverse(obj: any) {
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === "object") {
        if (obj[key].queryParams) {
          collections[key] = obj[key].queryParams;
        }
        traverse(obj[key]);
      }
    }
  }

  traverse(routesObject);
  return collections;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 *  Example of preparation script that transforms a nested object with route definitions into a JSON `input-data.json`
 *  for Handlebars template input. It also extracts query parameter collections for easier access in the template.
 */
export default function preparationScript() {
  const rootObject = sourceFile.getFirstDescendantByKindOrThrow(
    SyntaxKind.ObjectLiteralExpression,
  );

  const routesObject = transformObject(rootObject);
  const resultJson = {
    Routes: routesObject,
    QueryParamCollections: getQueryParamCollections(routesObject),
  };

  fs.writeFileSync(
    path.join(__dirname, "input-data.json"),
    JSON.stringify(resultJson, null, 2),
  );
}
