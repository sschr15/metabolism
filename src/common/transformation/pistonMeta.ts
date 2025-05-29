import type { VersionFileArtifact, VersionFileLibrary } from "#types/format/v1/versionFile.ts";
import type { PistonArtifact, PistonLibrary, PistonRule } from "#types/pistonMeta/pistonVersion.ts";
import { mapValues, omit } from "es-toolkit";
import { isEmpty } from "es-toolkit/compat";

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
		name: lib.name.full,
		downloads: lib.downloads ? {
			artifact: lib.downloads.artifact
				? transformPistonArtifact(lib.downloads.artifact)
				: undefined,
			classifiers: lib.downloads.classifiers
				? mapValues(lib.downloads.classifiers, transformPistonArtifact)
				: undefined,
		} : undefined,
	};
}

export function transformPistonArtifact(artifact: PistonArtifact): VersionFileArtifact {
	return omit(artifact, ["path"]);
}

export function isPlatformLibrary(lib: PistonLibrary) {
	return (lib.rules && !ruleSetAppliesByDefault(lib.rules))
		|| (lib.natives && !isEmpty(lib.natives));
}
