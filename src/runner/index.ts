import { pushTo } from "#common/index.ts";
import { moduleLogger } from "#logger.ts";
import { type Goal } from "#types/goal.ts";
import type { Provider } from "#types/provider.ts";
import type { VersionFile } from "#types/versionFile.ts";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DiskHTTPCache } from "./diskHTTPCache.ts";
import { GOALS } from "./registry.ts";

const logger = moduleLogger();

export interface RunnerOptions {
	userAgent: string;
	cacheDir: string;
	outputDir: string;
}

export async function prepare(providers: Set<Provider>, options: RunnerOptions): Promise<void> {
	await run(providers, new Map, options);
}

export async function sync(providers: Set<Provider>, options: RunnerOptions): Promise<void> {
	const dependents: Map<Provider, Goal[]> = new Map;

	for (const goal of GOALS.values()) {
		if (!providers.has(goal.provider))
			continue;

		pushTo(dependents, goal.provider, goal);
	}

	await run(providers, dependents, options);
}

export async function build(goals: Iterable<Goal>, options: RunnerOptions) {
	const providers: Set<Provider> = new Set;
	const dependents: Map<Provider, Goal[]> = new Map;

	for (const goal of goals) {
		providers.add(goal.provider);
		pushTo(dependents, goal.provider, goal);
	}

	await run(providers, dependents, options);
}

async function run(providers: Set<Provider>, dependents: Map<Provider, Goal[]>, options: RunnerOptions): Promise<void> {
	const startTime = Date.now();

	let goalCount = 0;

	await Promise.all(providers.values().map(async provider => {
		const data = await runProvider(provider, options);

		logger.info(`Got data from provider '${provider.id}'!`);

		const providerDependents = dependents.get(provider) ?? [];

		return await Promise.all(providerDependents.map(async goal => {
			++goalCount;

			await runGoal(goal, data, options);
			logger.info(`Done goal '${goal.id}'!`);
		}));
	}));

	const elapsedTime = Date.now() - startTime;
	const formattedTime = elapsedTime < 1000 ? elapsedTime + "ms" : (elapsedTime / 1000) + "s";

	logger.info({ providerCount: providers.size, goalCount }, "Summary");

	logger.info(`Done in ${formattedTime}!`);
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
