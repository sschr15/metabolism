import { moduleLogger } from "#logger.ts";
import type { Goal } from "#types/goal.ts";
import type { VersionFile } from "#types/versionFile.ts";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path, { relative } from "node:path";
import { DiskHTTPCache } from "./diskHTTPCache.ts";
import { compareStrings } from "./util/strings.ts";

const logger = moduleLogger();

export interface RunnerOptions {
	userAgent: string;
	cacheDir: string;
	outputDir: string;
	assumeUpToDate: boolean;
	prepareOnly: boolean;
}

export async function runAll(goals: Goal<unknown>[], options: RunnerOptions): Promise<void> {
	const startTime = Date.now();

	await Promise.all(goals.map(goal =>
		run(goal, options)
			.then(() => logger.info(`Done ${goal.id}!`))
	));

	const elapsedTime = Date.now() - startTime;
	const formattedTime = elapsedTime < 1000 ? elapsedTime + "ms" : (elapsedTime / 1000) + "s";

	logger.info(`Done all ${goals.length} goals (${formattedTime})!`);
}

export async function run<D>(goal: Goal<D>, options: RunnerOptions): Promise<void> {
	const client = new DiskHTTPCache({
		dir: path.join(options.cacheDir, goal.id),
		encoding: "utf-8",
		userAgent: options.userAgent,
		assumeUpToDate: options.assumeUpToDate,
	});

	const outputDir = path.join(options.outputDir, goal.id);

	await mkdir(outputDir, { recursive: true });

	const inputs = await goal.prepare(client);

	await Promise.all(inputs.map(promise => promise.then(input => {
		if (options.prepareOnly)
			return;

		const output = goal.generate(input);

		const outputFile = path.join(outputDir, output.version + ".json");
		const outputContent = JSON.stringify({ uid: goal.id, name: goal.name, formatVersion: 1, ...output } satisfies VersionFile);

		logger.debug(`Generated '${outputFile}'`);

		return writeFile(outputFile, outputContent).then(() => logger.debug(`Wrote '${outputFile}'`));
	})));
}

export async function importGoals(): Promise<Goal<unknown>[]> {
	const result: Goal<unknown>[] = [];
	const entries = await readdir(path.join(import.meta.dirname, "..", "goal"), { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory())
			continue;

		const importPath = path.join(entry.parentPath, entry.name, "index.ts");
		const goal = await import(importPath).then(module => module.default);

		if (goal?.__defineGoal_marker !== true)
			throw new Error(`Expected \`export default defineGoal\` for '${relative(".", importPath)}'!`);

		result.push(goal);
	}

	result.sort((a, b) => compareStrings(a.id, b.id));

	return result;
}
