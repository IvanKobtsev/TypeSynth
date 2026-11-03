export type GeneratorContext = { projectRoot: string; jobName: string };
export type Generate = (
  templateName: string,
  data: any,
  relativeOutputPath: string,
) => Promise<void>;
export type GeneratorScriptProps<TData = any> = GeneratorContext & {
  data: TData;
  generate: Generate;
};
export type GeneratorScript<TData = any> = (
  props: GeneratorScriptProps<TData>,
) => void | Promise<void>;
export type TypeSynthJob = {
  sources: string;
  output: string;
  overrides?: Record<string, string>;
  input?: string;
  formatting?: boolean;
};
export type TypeSynthJobs = Record<string, TypeSynthJob>;
