import { isEmpty } from "#common/index.ts";
import { mapObjectValues, omitObjectKeys } from "#common/objects.ts";
import type { PistonLibrary, PistonLibraryName, PistonRule } from "#common/schema/pistonVersion.ts";
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

export function isLWJGL3(name: PistonLibraryName) {
	return name.groupID === "org.lwjgl";
}

export function isLWJGL2(name: PistonLibraryName) {
	return name.groupID === "org.lwjgl.lwjgl";
}

/**
 * Is it an indirect dependency from LWJGL 2?
 * @param name Library name
 * @returns true for jinput and -> jutils - libraries which Minecraft does not require directly but LWJGL does
 */
export function isLWJGL2Dependency(name: PistonLibraryName) {
	return name.groupID === "net.java.jinput" || name.groupID === "net.java.jutils";
}
