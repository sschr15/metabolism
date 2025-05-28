import { isEmpty } from "#common/index.ts";
import { mapObjectValues, omitObjectKeys } from "#common/objects.ts";
import type { PistonLibrary, PistonRule } from "#common/schema/pistonMeta/pistonVersion.ts";
import type { VersionFileLibrary } from "#types/format/v1/versionFile.ts";

export function ruleSetAppliesByDefault(rules: PistonRule[]): boolean {
	if (rules.length === 0)
		return true;

	const highestPrecedence = rules.findLast(rule =>
		isEmpty(rule.features) && isEmpty(rule.os)
	);

	return highestPrecedence?.action === "allow";
}

export function transformPistonLibrary(lib: PistonLibrary): VersionFileLibrary {
	return {
		...lib,
		name: lib.name.classifier
			? `${lib.name.groupID}:${lib.name.artifactID}-${lib.name.classifier}:${lib.name.version}`
			: lib.name.full,
		downloads: lib.downloads ? {
			artifact: lib.downloads.artifact
				? omitObjectKeys(lib.downloads.artifact, "path")
				: undefined,
			classifiers: lib.downloads.classifiers
				? mapObjectValues(lib.downloads.classifiers, value => omitObjectKeys(value, "path"))
				: undefined,
		} : undefined
	};
}


