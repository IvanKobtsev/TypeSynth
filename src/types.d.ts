export type GlobalMagicVariables = {
  magic__checksum: string | null;
};

export type FileChangeType =
  | "add"
  | "change"
  | "unlink"
  | "addDir"
  | "unlinkDir";

export type FileChange = {
  path: string;
  type: FileChangeType;
};

export type GeneratorTrigger = "manual" | "initial" | "watch";

export type GeneratorContext<TChanges = FileChange[]> = {
  trigger: GeneratorTrigger;
  changes: TChanges | undefined;
  projectRoot: string;
  jobName: string;
};

export type WatcherContext = Pick<GeneratorContext, "projectRoot" | "jobName">;

export type GeneratorScript<TChanges = FileChange[]> = (
  context: GeneratorContext<TChanges>,
) => void | Promise<void>;

export type WatcherScript<TChanges = FileChange[]> = (
  events: FileChange[],
  context: WatcherContext,
) => TChanges | false | Promise<TChanges | false>;

export type TypeSynthWatchOptions<TChanges = FileChange[]> = {
  files: string | string[];
  debounce?: number;
  script?: string | WatcherScript<TChanges>;
};

export type TypeSynthJob<TChanges = FileChange[]> = {
  generate: string | GeneratorScript<TChanges>;
  watch?: TypeSynthWatchOptions<TChanges>;
};

export type TypeSynthConfig = {
  jobs: Record<string, TypeSynthJob<any>>;
};
