import type { MavenLibraryName } from "#common/schema/maven.ts";
import { PistonLibrary, PistonVersion } from "#common/schema/pistonMeta/pistonVersion.ts";
import { isLWJGL2, isLWJGL2Dependency, isLWJGL3 } from "#common/transformation/maven.ts";
import { isPlatformLibrary, transformPistonLibrary } from "#common/transformation/pistonMeta.ts";
import pistonMetaGameVersions from "#provider/gameVersions.ts";
import type { VersionFileDependency } from "#types/format/v1/versionFile.ts";
import { defineGoal, type VersionOutput } from "#types/goal.ts";
import { omit } from "es-toolkit";
import { isEmpty } from "es-toolkit/compat";

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

type VersionNamePredicate = (name: MavenLibraryName) => boolean;

interface LWGJLEntry {
	modules: Map<string, PistonLibrary>;
	firstSeen: string;
	used: boolean;
}

function generate(data: PistonVersion[], conflictUIDs: string[], filter: VersionNamePredicate, filterDep: VersionNamePredicate) {
	const versions: Map<string, LWGJLEntry> = new Map;
	const sharedDeps: Map<string, PistonLibrary> = new Map;

	const conflicts: VersionFileDependency[] = conflictUIDs.map(uid => ({ uid }));

	data.forEach(version => version.libraries.forEach(lib => {
		if (filterDep(lib.name)) {
			if (!sharedDeps.has(lib.name.full))
				sharedDeps.set(lib.name.full, lib);

			return;
		}

		if (!filter(lib.name))
			return;

		let entry = versions.get(lib.name.version);

		if (!entry) {
			entry = { modules: new Map, firstSeen: "", used: false };
			versions.set(lib.name.version, entry);
		}

		entry.firstSeen = version.releaseTime; // (we are going from newest to oldest)
		entry.used ||= !isPlatformLibrary(lib);

		const existingModule = entry.modules.get(lib.name.full);

		if (existingModule) {
			// merge as much data as possible into one library - populate fields which aren't already present

			if (lib.natives) {
				existingModule.natives = {
					...lib.natives,
					...existingModule.natives
				};
			}

			if (lib.downloads) {
				existingModule.downloads ??= {};

				if (lib.downloads.artifact && !existingModule.downloads.artifact)
					existingModule.downloads.artifact = lib.downloads.artifact;

				if (lib.downloads.classifiers) {
					existingModule.downloads.classifiers = {
						...lib.downloads.classifiers,
						...existingModule.downloads.classifiers
					};
				}
			}

			if (lib.extract && !existingModule.extract)
				existingModule.extract = lib.extract;
		} else {
			// remove rules only if this is old-style merged natives
			// it is essential to keep them for new separated natives as they will otherwise be downloaded on all platforms!
			//
			// note:
			// the `natives` property was originally used as LWJGL natives had to be extracted by the launcher, and couldn't simply be put on the classpath
			// this was presumably changed as it's not needed for new LWJGL versions and this format (probably) does not support architecture (only OS)
			// Prism Launcher certainly does support this (possibly as an extension to the format?)
			// however, it's probably best to stay as close to what the official launcher is doing for each version

			const pureLib = lib.name.classifier ? lib : omit(lib, ["rules"]);

			entry.modules.set(lib.name.full, pureLib);
		}
	}));

	return [
		...versions.entries().filter(([_, entry]) => entry.used).map(([version, entry]): VersionOutput => ({
			version,
			releaseTime: entry.firstSeen,
			type: "release",

			order: -1,
			conflicts,
			volatile: true,

			libraries: [...sharedDeps.values(), ...entry.modules.values().flatMap(splitClassifiers)].map(transformPistonLibrary),
		}))
	];
}

export default [lwjgl3, lwjgl2];

function splitClassifiers(library: PistonLibrary) {
	if (!library.downloads?.artifact || isEmpty(library.downloads.classifiers))
		return [library];

	return [
		{ ...omit(library, ["natives"]), downloads: { artifact: library.downloads.artifact } },
		{ ...library, downloads: { classifiers: library.downloads.classifiers } }
	];
}
