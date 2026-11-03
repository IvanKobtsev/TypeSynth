import { execFile, execSync } from "node:child_process";
import path from "path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import fs from "fs";

const jsExtensions = [".ts", ".tsx", ".js", ".jsx"];
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const oxfmtCli = path.join(path.dirname(require.resolve("oxfmt/package.json")), "bin", "oxfmt");

export async function formatJsFileWithOxfmt(sourcePath: string) {
  const filePath = path.resolve(sourcePath);
  await execFileAsync(process.execPath, [oxfmtCli, filePath], {
    cwd: path.dirname(filePath),
  });
}

const csExtensions = [".cs"];
function formatCsFileWithCSharpier(filePath: string) {
  const resolved = path.resolve(filePath);

  const toolDir = path.join(process.cwd(), ".csharpier");

  if (!fs.existsSync(toolDir)) {
    fs.mkdirSync(toolDir);

    execSync("dotnet new tool-manifest", { cwd: toolDir, stdio: "ignore" });
    execSync("dotnet tool install csharpier", {
      cwd: toolDir,
      stdio: "ignore",
    });
  }

  execSync(`dotnet tool run csharpier format "${resolved}"`, {
    cwd: toolDir,
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
    formatterFunc: formatJsFileWithOxfmt,
  },
  [OutputFileType.Csharp]: {
    extensions: csExtensions,
    formatterFunc: formatCsFileWithCSharpier,
  },
};

/*
 * Detects the file type based on extension and formats it with the appropriate formatter.
 * Currently supports JavaScript/TypeScript files with oxfmt and C# files with CSharpier.
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
