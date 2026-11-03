import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";
import stringify from "json-stable-stringify";
import { getDefaultExport, getInputDataPath, runPreparationScript } from "./file-helpers.js";
import { getInputObject } from "./process-helpers.js";
import { formatSourceFile } from "./formatting-helpers.js";
import { getMagicChecksum } from "./index.js";
import { createPathResolver } from "./path-resolution.js";
import type { Generate, GeneratorScript, TypeSynthJob } from "./types.js";

function contained(root: string, relative: string) {
  if (!relative || path.isAbsolute(relative) || path.win32.isAbsolute(relative))
    throw new Error(`Expected a relative path: ${relative}`);
  const full = path.resolve(root, relative);
  const remaining = path.relative(root, full);
  if (
    !remaining ||
    remaining === ".." ||
    remaining.startsWith(`..${path.sep}`) ||
    path.isAbsolute(remaining)
  )
    throw new Error(`Path must remain inside ${root}: ${relative}`);
  return full;
}

export async function runGenerator(jobName: string, job: TypeSynthJob, projectRoot: string) {
  try {
    if (!job || typeof job.sources !== "string" || typeof job.output !== "string")
      throw new Error("Job requires sources and output paths.");
    const resolve = createPathResolver(projectRoot);
    const sources = resolve(job.sources);
    const output = resolve(job.output);
    const hbs = Handlebars.create();
    const optional = (name: string) => {
      const full = path.join(sources, name);
      return fs.existsSync(full) ? full : undefined;
    };
    const preparation = await runPreparationScript(optional("preparation-script.ts"));
    const input = job.input
      ? /^https?:\/\//.test(job.input)
        ? job.input
        : resolve(job.input)
      : undefined;
    const data = await getInputObject(input, preparation, getInputDataPath(sources));
    const helpers = optional("hbs-helpers.ts");
    if (helpers) {
      const loaded = await getDefaultExport(helpers);
      if (!loaded || typeof loaded !== "object")
        throw new Error("hbs-helpers.ts must export a helper object.");
      for (const [name, helper] of Object.entries(loaded))
        if (typeof helper === "function")
          hbs.registerHelper(name, helper as Handlebars.HelperDelegate);
    }
    for (const entry of fs.readdirSync(sources, { withFileTypes: true })) {
      if (
        entry.isFile() &&
        entry.name.startsWith("template_partial_") &&
        entry.name.endsWith(".hbs")
      )
        hbs.registerPartial(
          entry.name.slice("template_partial_".length, -4),
          fs.readFileSync(path.join(sources, entry.name), "utf8"),
        );
    }
    const overrides = job.overrides ?? {};
    if (typeof overrides !== "object" || Array.isArray(overrides))
      throw new Error("overrides must be a template-name/path map.");
    const compiled = new Map<string, Handlebars.TemplateDelegate>();
    const render = async (
      name: string,
      templatePath: string,
      renderData: any,
      destination: string,
    ) => {
      try {
        let template = compiled.get(templatePath);
        if (!template) {
          template = hbs.compile(fs.readFileSync(templatePath, "utf8"));
          compiled.set(templatePath, template);
        }
        const result = template({
          ...renderData,
          magic__checksum: await getMagicChecksum(stringify(renderData) ?? ""),
        });
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, result);
        if (job.formatting !== false) await formatSourceFile(destination);
      } catch (error) {
        throw new Error(
          `Template "${name}" (${templatePath}), output "${destination}": ${error instanceof Error ? error.message : error}`,
        );
      }
    };
    const generate: Generate = async (name, renderData, relativeOutput) => {
      if (typeof name !== "string" || !name || name.endsWith(".hbs"))
        throw new Error("Template names must omit .hbs.");
      const defaultPath = contained(path.join(sources, "templates"), `${name}.hbs`);
      const templatePath = Object.prototype.hasOwnProperty.call(overrides, name)
        ? resolve(overrides[name])
        : defaultPath;
      await render(name, templatePath, renderData, contained(output, relativeOutput));
    };
    const main = optional("main.ts");
    if (main) {
      const script = (await getDefaultExport(main)) as GeneratorScript;
      if (typeof script !== "function") throw new Error("main.ts must default-export a function.");
      await script({ data, generate, projectRoot, jobName });
    } else {
      await render(
        "template",
        Object.prototype.hasOwnProperty.call(overrides, "template")
          ? resolve(overrides.template)
          : path.join(sources, "template.hbs"),
        data,
        output,
      );
    }
  } catch (error) {
    throw new Error(`Job "${jobName}": ${error instanceof Error ? error.message : error}`);
  }
}
