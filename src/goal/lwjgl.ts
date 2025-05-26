import { PistonLibrary, PistonLibraryName, PistonVersion } from "#common/schema/pistonVersion.ts";
import { isLWJGL2, isLWJGL2Dependency, isLWJGL3, ruleSetAppliesByDefault, transformPistonLibrary } from "#common/transformation/pistonVersion.ts";
import pistonMetaGameVersions from "#provider/gameVersions.ts";
import type { VersionFileDependency } from "#types/format/v1/versionFile.ts";
import { defineGoal, type VersionOutput } from "#types/goal.ts";

const lwjgl3 = defineGoal({
	id: "org.lwjgl3",
	name: "LWJGL 3",
	provider: pistonMetaGameVersions,

	generate: data => generate(data, ["org.lwjgl"], isLWJGL3, () => false)
});

const lwjgl2 = defineGoal({
	id: "org.lwjgl",
	name: "LWJGL 2",
	provider: pistonMetaGameVersions,

	generate: data => generate(data, ["org.lwjgl3"], isLWJGL2, isLWJGL2Dependency)
});

type VersionNamePredicate = (name: PistonLibraryName) => boolean;

function generate(data: PistonVersion[], conflictUIDs: string[], filter: VersionNamePredicate, filterDep: VersionNamePredicate) {
	const versions: Map<string, [string, PistonLibrary[]]> = new Map;
	const sharedDeps: PistonLibrary[] = [];

	for (const version of data) {
		for (const lib of version.libraries) {
			if (lib.rules && !ruleSetAppliesByDefault(lib.rules))
				continue;

			if (filter(lib.name)) {
				let entry = versions.get(lib.name.version);

				if (entry === undefined) {
					entry = [version.releaseTime, []];
					versions.set(lib.name.version, entry);
				} else
					entry[0] = version.releaseTime; // set to oldest

				const entryLibs = entry[1];
				const alreadyPresent = entryLibs.some(x => x.name.artifactID === lib.name.artifactID);

				if (alreadyPresent)
					continue;

				entryLibs.push(lib);
			} else if (filterDep(lib.name)) {
				const alreadyPresent = sharedDeps.some(
					x => x.name.groupID === lib.name.groupID
						&& x.name.artifactID === lib.name.artifactID
				);

				if (alreadyPresent)
					continue;

				sharedDeps.push(lib);
			}
		}
	}

	const conflicts: VersionFileDependency[] = conflictUIDs.map(uid => ({ uid }));

	return [
		...versions.entries().map(([version, [releaseTime, libraries]]): VersionOutput => ({
			version,
			releaseTime,
			type: "release",

			order: -1,
			conflicts,
			volatile: true,

			libraries: [...sharedDeps, ...libraries].map(transformPistonLibrary),
		}))
	];
}

export default [lwjgl3, lwjgl2];
