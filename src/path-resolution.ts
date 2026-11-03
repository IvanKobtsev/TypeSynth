import path from "node:path";
import ts from "typescript";

export function createPathResolver(projectRoot: string) {
  let parsed: ts.ParsedCommandLine | undefined;
  return (value: string): string => {
    if (typeof value !== "string" || !value) throw new Error("Expected a nonempty path.");
    if (path.isAbsolute(value)) return path.normalize(value);
    if (!value.startsWith("@/")) return path.resolve(projectRoot, value);
    if (!parsed) {
      const config = ts.findConfigFile(projectRoot, ts.sys.fileExists);
      if (!config) throw new Error(`Cannot resolve alias ${value}: tsconfig.json not found.`);
      parsed = ts.getParsedCommandLineOfConfigFile(
        config,
        {},
        {
          ...ts.sys,
          onUnRecoverableConfigFileDiagnostic: (d) => {
            throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
          },
        },
      );
      if (!parsed) throw new Error(`Cannot read ${config}.`);
    }
    const mappings = Object.entries(parsed.options.paths ?? {}).sort(([a], [b]) => {
      if (!a.includes("*")) return -1;
      if (!b.includes("*")) return 1;
      return b.indexOf("*") - a.indexOf("*") || b.length - a.length;
    });
    for (const [pattern, targets] of mappings) {
      const star = pattern.indexOf("*");
      const matches =
        star < 0
          ? value === pattern
          : value.startsWith(pattern.slice(0, star)) &&
            value.endsWith(pattern.slice(star + 1)) &&
            value.length >= pattern.length - 1;
      if (!matches || !targets.length) continue;
      const capture = star < 0 ? "" : value.slice(star, value.length - (pattern.length - star - 1));
      const base =
        parsed.options.baseUrl ??
        (parsed.options as ts.CompilerOptions & { pathsBasePath?: string }).pathsBasePath ??
        projectRoot;
      return path.resolve(base, targets[0].replace("*", capture));
    }
    throw new Error(`Unresolved tsconfig alias: ${value}`);
  };
}
