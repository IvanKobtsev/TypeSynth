export type GlobalMagicVariables = {
  magic__checksum: string | null;
};

export type GeneratorContext = {
  projectRoot: string;
  jobName: string;
};

export type GeneratorScript = (context: GeneratorContext) => void | Promise<void>;

export type TypeSynthJob = {
  generate: string | GeneratorScript;
};

export type TypeSynthConfig = {
  jobs?: Record<string, TypeSynthJob>;
};
