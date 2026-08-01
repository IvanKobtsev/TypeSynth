#  TypeSynth

TypeSynth helps you build maintainable TypeScript applications by generating code from your existing project structure.

Instead of manually maintaining registries, lookup tables, generated source files, or other repetitive code, TypeSynth lets you define the source of truth once and generate the rest automatically.

## Features

* 🚀 Generate source files using TypeScript scripts.
* 👀 Watch your project and regenerate files whenever relevant source code changes.
* 📝 Reworked Handlebars-based generation engine from **hbs-magic**.
* 🧩 Built-in source generators for common development patterns.
* 🔌 Write your own generators using plain TypeScript.
* ⚡ Incremental file watching designed for everyday development workflows.

## Installation

```bash
npm install --save-dev typesynth
```

or

```bash
yarn add -D typesynth
```

## Quick Start

Generate your project's source files once:

```bash
tsynth gen
```

Continuously watch your project and regenerate files as you work:

```bash
tsynth watch
```

Typically, `tsynth watch` is started alongside your development server so generated code always stays up to date.

## Custom Generators

TypeSynth is designed to be extensible.

Generators are written in TypeScript, allowing you to leverage the full TypeScript ecosystem instead of learning a custom DSL.

A generator can inspect your project, analyze files, and produce any additional source files your application requires.

This makes it possible to automate project-specific workflows while keeping all generation logic inside your repository.

## Built-in Generators

TypeSynth includes a growing collection of built-in generators for common development patterns.

### Registry Generator

The Registry Generator automatically builds registry files from your project, eliminating the need to manually keep collections synchronized.

Whether you're maintaining component registries, modal registries, command registries, plugin registries, or similar structures, TypeSynth can generate and update them automatically as your project evolves.

It can be used with both `tsynth gen` for one-time generation and `tsynth watch` for continuous synchronization during development.

Additional built-in generators will be added over time.

## Why TypeSynth?

As TypeScript applications grow, it's common to end up maintaining files that contain little more than repetitive mappings, registrations, exports, or metadata.

These files are easy to forget, tedious to update, and often become a source of merge conflicts.

TypeSynth encourages a different approach:

* Define information once.
* Generate derived code automatically.
* Keep generated files synchronized with your project.

This reduces boilerplate while making large codebases easier to maintain.

## Philosophy

TypeSynth is inspired by the idea that developers should spend their time writing business logic—not maintaining generated code.

Rather than introducing another framework or runtime dependency, TypeSynth works alongside your existing stack and integrates naturally into your development workflow.

## Roadmap

TypeSynth is in its early stages and will continue to evolve.

Planned areas of expansion include:

* Additional built-in generators
* More architectural patterns
* Improved project analysis
* Richer generation APIs
* Faster incremental processing
* Better IDE integration

## Contributing

Contributions, feature requests, and feedback are always welcome.

If you have an idea for a generator, workflow, or pattern that could help the TypeScript ecosystem, feel free to open an issue or start a discussion.

## License

[MIT](LICENSE) © Ivan Kobtsev

