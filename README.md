# Metabolism

Scripts to generate Prism Launcher metadata based on external sources - [TypeScript rewrite](https://gist.github.com/TheKodeToad/b36761965b05ea1e62b8d717d7aa3c13).

## Usage
Because football is cool, this project uses terms named after it.

"Goals" are essentially metadata targets to build.

First, run `install` with your prefered package manager (pnpm is recommended - `pnpm install`).

The available scripts are `start` and `startBun` to run with Node.JS and Bun respectively (with pnpm: `pnpm start` or `pnpm startBun`).

Pass no arguments to see a list of options and goals.
To build everything, run with `all`.
To build a limited set of goals, specify them separated by spaces.
To download files but not transform them, use `--prepareOnly`.

Bun is also supported - use `pnpm startBun` instead of `pnpm start`. This is recommended for performance if you have it installed.
Deno *works*, but there's not much reason to use it for this.
