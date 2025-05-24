import type { Goal } from "#types/goal.ts";
import type { Provider } from "#types/provider.ts";
import { readdir } from "node:fs/promises";
import path, { relative } from "node:path";

export const GOALS = await importGoals();
export const PROVIDERS = await importProviders();

async function* importDir(dir: string): AsyncGenerator<any, void, unknown> {
	const entries = await readdir(path.join(import.meta.dirname, dir), { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory() && !entry.name.endsWith(".ts"))
			continue;

		let importPath = path.join(entry.parentPath, entry.name);

		if (entry.isDirectory())
			importPath = path.join(importPath, "index.ts");

		yield [
			relative(".", importPath),
			await import(importPath).then(module => module.default)
		];
	}
}

async function importGoals(): Promise<Map<string, Goal>> {
	const result: Map<string, Goal> = new Map;

	for await (const [path, defaultExport] of importDir("../goal")) {
		if (typeof defaultExport.generate !== "function")
			throw new Error(`Expected \`export default exportGoal\` for '${path}'!`);

		result.set(defaultExport.id, defaultExport);
	}

	return result;
}

async function importProviders(): Promise<Map<string, Provider>> {
	const result: Map<string, Provider> = new Map;

	for await (const [path, defaultExport] of importDir("../provider")) {
		if (typeof defaultExport.provide !== "function")
			throw new Error(`Expected \`export default exportProvider\` for '${path}'!`);

		result.set(defaultExport.id, defaultExport);
	}

	return result;
}
