type Writable = {
  write(chunk: string): unknown;
  isTTY?: boolean;
};

type ReporterOptions = {
  stdout?: Writable;
  stderr?: Writable;
  env?: NodeJS.ProcessEnv;
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
};

const frames = ["|", "/", "-", "\\"];

export class CliReporter {
  private readonly stdout: Writable;
  private readonly stderr: Writable;
  private readonly env: NodeJS.ProcessEnv;
  private readonly makeInterval: typeof globalThis.setInterval;
  private readonly removeInterval: typeof globalThis.clearInterval;
  private readonly spinnerStream: Writable | undefined;
  private readonly tasks = new Map<string, string>();
  private timer: ReturnType<typeof globalThis.setInterval> | undefined;
  private frame = 0;
  private rendered = false;

  constructor(options: ReporterOptions = {}) {
    this.stdout = options.stdout ?? process.stdout;
    this.stderr = options.stderr ?? process.stderr;
    this.env = options.env ?? process.env;
    this.makeInterval = options.setInterval ?? globalThis.setInterval;
    this.removeInterval = options.clearInterval ?? globalThis.clearInterval;
    this.spinnerStream = this.env.CI
      ? undefined
      : this.stderr.isTTY
        ? this.stderr
        : this.stdout.isTTY
          ? this.stdout
          : undefined;
  }

  private useColor(stream: Writable) {
    if (this.env.FORCE_COLOR === "0") return false;
    if (this.env.FORCE_COLOR !== undefined) return true;
    if (this.env.NO_COLOR !== undefined) return false;
    return stream.isTTY === true;
  }

  private color(text: string, code: number, stream: Writable) {
    return this.useColor(stream) ? `\u001b[${code}m${text}\u001b[0m` : text;
  }

  private taskText() {
    if (this.tasks.size === 1)
      return `Processing ${this.tasks.values().next().value}…`;
    return `Processing ${this.tasks.size} TypeSynth tasks…`;
  }

  private clearFrame() {
    if (this.rendered && this.spinnerStream) {
      this.spinnerStream.write("\r\u001b[2K");
      this.rendered = false;
    }
  }

  private render() {
    if (!this.spinnerStream || this.tasks.size === 0) return;
    this.clearFrame();
    this.spinnerStream.write(
      `${frames[this.frame++ % frames.length]} ${this.taskText()}`,
    );
    this.rendered = true;
  }

  start(key: string, label: string) {
    const wasEmpty = this.tasks.size === 0;
    this.tasks.set(key, label);
    if (!this.spinnerStream) {
      this.stderr.write(`${this.taskText()}\n`);
      return;
    }
    this.render();
    if (wasEmpty) this.timer = this.makeInterval(() => this.render(), 80);
  }

  stop(key: string) {
    this.tasks.delete(key);
    if (this.tasks.size === 0) {
      if (this.timer) this.removeInterval(this.timer);
      this.timer = undefined;
      this.clearFrame();
    } else {
      this.render();
    }
  }

  info(message: string) {
    this.clearFrame();
    this.stdout.write(`${message}\n`);
    this.render();
  }

  success(message: string) {
    this.clearFrame();
    this.stdout.write(`${this.color(message, 32, this.stdout)}\n`);
    this.render();
  }

  warn(message: string) {
    this.clearFrame();
    this.stderr.write(`${this.color(message, 33, this.stderr)}\n`);
    this.render();
  }

  error(message: string, error?: unknown) {
    this.clearFrame();
    const detail = error
      ? ` ${error instanceof Error ? error.message : String(error)}`
      : "";
    this.stderr.write(
      `${this.color(`${message}${detail}`, 31, this.stderr)}\n`,
    );
    this.render();
  }

  async task<T>(
    key: string,
    label: string,
    action: () => Promise<T>,
    successMessage?: string | ((result: T) => string | undefined),
  ) {
    this.start(key, label);
    try {
      const result = await action();
      this.stop(key);
      const message =
        typeof successMessage === "function"
          ? successMessage(result)
          : successMessage;
      if (message) this.success(message);
      return result;
    } catch (error) {
      this.stop(key);
      throw error;
    }
  }

  close() {
    this.tasks.clear();
    if (this.timer) this.removeInterval(this.timer);
    this.timer = undefined;
    this.clearFrame();
  }
}

export const reporter = new CliReporter();
