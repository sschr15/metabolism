# Metabolism
Scripts to generate Prism Launcher metadata based on external sources - TypeScript rewrite.

TODO: reminder to self to fix that vulnerability :)

## Usage
First, run `pnpm install`.
To run `pnpm start` (Node.JS) or `pnpm startBun` (might improve performance).

There are two key concepts - providers and goals. Providers are metadata sources, and goals are metadata targets.
For example, the `com.mojang.piston-meta.game-versions` provider provides data to the `net.minecraft` goal.
Goals always specify a single dependency on a source (for the sake of simplicity).

Pass nothing to see full usage with a list of providers and goals.

Available commands:

### `prepare <provider>...`
Prepare data from the specified providers.

### `sync <provider>...` (recommended)
`prepare`, then run dependent goals.

### `build <goal>...`
Runs `prepare` for all dependencies of the specified goals.

### `all`
Prepare and build everything.

## Why

[The Rust rewrite (mcmeta)](https://github.com/PrismLauncher/mcmeta) has been in the works for over two years - it can continue to coexist as a future alternative - but as of May 2025 something to replace [our MultiMC meta fork](https://github.com/prismLauncher/meta) feels long overdue.
I (TheKodeToad) chose TypeScript as I am more familiar with it. But the main difference is that this rewrite is less ambition - this only intends to generate metadata in the existing format simply with (hopefully) cleaner code.

Licensing should not be a concern as no code is taken from the original project.
