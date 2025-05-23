import { moduleLogger } from "#logger.ts";
import { type Goal } from "#types/goal.ts";
import type { Provider } from "#types/provider.ts";
import type { VersionFile } from "#types/versionFile.ts";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path, { relative } from "node:path";
import { DiskHTTPCache } from "./diskHTTPCache.ts";

const logger = moduleLogger();

export const ALL_GOALS = await importGoals();

export interface RunnerOptions {
	userAgent: string;
	cacheDir: string;
	outputDir: string;
	assumeUpToDate: boolean;
}

export async function runAll(goals: Goal[], options: RunnerOptions): Promise<void> {
	const startTime = Date.now();

	const providers: Set<Provider> = new Set;
	const dependents: Map<Provider, Goal[]> = new Map;

	for (const goal of goals) {
		providers.add(goal.provider);

		let providerDependents = dependents.get(goal.provider);

		if (!providerDependents) {
			providerDependents = [];
			dependents.set(goal.provider, providerDependents);
		}

		providerDependents.push(goal);
	}

	await Promise.all(providers.values().map(async provider => {
		const data = await runProvider(provider, options);

		logger.info(`Got data from provider '${provider.id}'!`);

		return await Promise.all(dependents.get(provider)!.map(async goal => {
			await runGoal(goal, data, options);
			logger.info(`Done goal '${goal.id}'!`);
		}));
	}));

	const elapsedTime = Date.now() - startTime;
	const formattedTime = elapsedTime < 1000 ? elapsedTime + "ms" : (elapsedTime / 1000) + "s";

	logger.info(`Done all ${goals.length} goals (${formattedTime})!`);
}

async function runProvider(provider: Provider, options: RunnerOptions): Promise<unknown> {
	const http = new DiskHTTPCache({
		dir: path.join(options.cacheDir, provider.id),
		encoding: "utf-8",
		userAgent: options.userAgent,
		assumeUpToDate: options.assumeUpToDate,
	});

	return await provider.provide(http);
}

async function runGoal(goal: Goal, data: unknown, options: RunnerOptions): Promise<void> {
	const files = goal.generate(data);
	const outputDir = path.join(options.outputDir, goal.id);

	await mkdir(outputDir, { recursive: true });

	await Promise.all(files.map(async file => {
		const outputFile = path.join(outputDir, file.version + ".json");
		const outputContent = JSON.stringify({ uid: goal.id, name: goal.name, formatVersion: 1, ...file } satisfies VersionFile);

		await writeFile(outputFile, outputContent);

		logger.debug(`Wrote '${outputFile}'`);
	}));
}

async function importGoals(): Promise<Goal[]> {
	const result: Goal[] = [];
	const entries = await readdir(path.join(import.meta.dirname, "..", "goal"), { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory() && !entry.name.endsWith(".ts"))
			continue;

		let importPath = path.join(entry.parentPath, entry.name);

		if (entry.isDirectory())
			importPath = path.join(importPath, "index.ts");

		const goal = await import(importPath).then(module => module.default);

		if (typeof goal.generate !== "function")
			throw new Error(`Expected \`export default exportGoal\` for '${relative(".", importPath)}'!`);

		result.push(goal);
	}

	return result;
}
