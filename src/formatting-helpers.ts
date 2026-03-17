import { execSync } from "node:child_process";
import path from "path";
import prettier from "prettier";
import fs from "fs";

const jsExtensions = [".ts", ".tsx", ".js", ".jsx"];
export async function formatJsFileWithPrettier(sourcePath: string) {
  const filePath = path.resolve(sourcePath);
  const source = fs.readFileSync(filePath, "utf8");

  const options = await prettier.resolveConfig(filePath);

  const formatted = await prettier.format(source, {
    ...options,
    filepath: filePath,
  });

  if (formatted !== source) {
    fs.writeFileSync(filePath, formatted, "utf8");
  }
}

const csExtensions = [".cs"];
function formatCsFileWithCSharpier(filePath: string) {
  const resolved = path.resolve(filePath);

  execSync(`dotnet csharpier format "${resolved}"`, {
    stdio: "inherit",
  });
}

enum OutputFileType {
  JavaScript,
  Csharp,
}

interface OutputFileFormatter {
  extensions: string[];
  formatterFunc: (inputFilePath: string) => Promise<void> | void;
}

const outputFileTypeMap: Record<OutputFileType, OutputFileFormatter> = {
  [OutputFileType.JavaScript]: {
    extensions: jsExtensions,
    formatterFunc: formatJsFileWithPrettier,
  },
  [OutputFileType.Csharp]: {
    extensions: csExtensions,
    formatterFunc: formatCsFileWithCSharpier,
  },
};

/*
 * Detects the file type based on extension and formats it with the appropriate formatter.
 * Currently supports JavaScript/TypeScript files with Prettier and C# files with CSharpier.
 */
export async function formatSourceFile(filePath: string) {
  const ext = filePath.slice(filePath.lastIndexOf("."));

  for (const formatter of Object.values(outputFileTypeMap)) {
    if (formatter.extensions.includes(ext)) {
      await formatter.formatterFunc(filePath);
      return;
    }
  }

  throw new Error(`Unsupported output file type: ${ext}`);
}
