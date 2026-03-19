import fs from "fs";
import Handlebars from "handlebars";
import { getDefaultExport } from "./file-helpers.js";

export type HbsPartial = {
  name: string;
  content: string;
};

export async function registerHbsHelpersFromFile(fullPath: string) {
  const hbsHelpers = await getDefaultExport(fullPath);

  for (const [name, value] of Object.entries(hbsHelpers)) {
    if (typeof value === "function") {
      Handlebars.registerHelper(name, value as Handlebars.HelperDelegate);
    }
  }
}

export async function registerHbsPartials(partials: HbsPartial[]) {
  for (const partial of partials) {
    Handlebars.registerPartial(partial.name, partial.content);
  }
}

export async function compileHbsTemplateAndWriteToFile(
  templatePath: string,
  inputObject: any,
  outputFilePath: string,
) {
  const template = fs.readFileSync(templatePath, "utf8");
  const compiled = Handlebars.compile(template);

  const result = compiled(inputObject);
  fs.writeFileSync(outputFilePath, result);
}
