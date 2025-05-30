import { setIfAbsent } from "#common/index.ts";
import { isLWJGL2, isLWJGL2Dependency, isLWJGL3 } from "#common/transformation/maven.ts";
import { isPlatformLibrary, transformPistonArtifact, transformPistonLibrary } from "#common/transformation/pistonMeta.ts";
import { moduleLogger } from "#logger.ts";
import pistonMetaGameVersions from "#provider/gameVersions.ts";
import type { VersionFileArtifact, VersionFileDependency, VersionFileLibrary, VersionFilePlatform } from "#types/format/v1/versionFile.ts";
import { defineGoal, type VersionOutput } from "#types/goal.ts";
import type { MavenArtifactRef } from "#types/mavenLibraryName.ts";
import { PistonLibrary, PistonVersion } from "#types/pistonMeta/pistonVersion.ts";
import { omit } from "es-toolkit";
import { isEmpty } from "es-toolkit/compat";

const logger = moduleLogger();

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

type VersionNamePredicate = (name: MavenArtifactRef) => boolean;

interface LWJGLVersion {
	modules: Map<string, LWJGLModule>;
	firstSeen: string;
	used: boolean;
	preferSplit?: boolean;
}

interface LWJGLModule {
	javaCode?: VersionFileArtifact;
	nativeCode: Map<VersionFilePlatform, VersionFileArtifact & { classifier: string; }>;
}

function generate(data: PistonVersion[], conflictUIDs: string[], filter: VersionNamePredicate, filterDep: VersionNamePredicate) {
	const versions: Map<string, LWJGLVersion> = new Map;
	const sharedDeps: Map<string, PistonLibrary> = new Map;

	data.forEach(gameVersion => gameVersion.libraries.forEach(lib => {
		if (filterDep(lib.name)) {
			if (!sharedDeps.has(lib.name.full))
				sharedDeps.set(lib.name.full, lib);

			return;
		}

		if (!filter(lib.name))
			return;

		const version = setIfAbsent(
			versions,
			lib.name.version,
			{ modules: new Map, used: false, firstSeen: "" }
		);

		// always set - we are going from newest to oldest and want the oldest to have the final say
		version.firstSeen = gameVersion.releaseTime;
		version.used ||= !isPlatformLibrary(lib);

		const module = setIfAbsent(
			version.modules,
			lib.name.format(["group", "artifact"]), // org.lwjgl:lwjgl-thing
			{ nativeCode: new Map }
		);

		if (lib.downloads?.artifact) {
			const classifier = lib.name.classifier;

			if (classifier) {
				const platform = mapClassifier(classifier);

				if (platform) {
					const artifact = transformPistonArtifact(lib.downloads.artifact);

					version.preferSplit ??= true;
					setIfAbsent(module.nativeCode, platform, { ...artifact, classifier });
				} else
					logger.warn(`Could not determine platform from LWJGL classifier: '${lib.name.classifier}'`);

				return;
			} else
				module.javaCode = transformPistonArtifact(lib.downloads.artifact);
		}

		const classifierLookup = lib.downloads?.classifiers;

		if (lib.natives && !isEmpty(classifierLookup)) {
			for (const [platform, classifier] of Object.entries(lib.natives)) {
				if (!Object.hasOwn(classifierLookup, classifier))
					continue;

				const artifact = transformPistonArtifact(classifierLookup[classifier]!);

				version.preferSplit ??= false;
				setIfAbsent(module.nativeCode, platform as keyof typeof lib.natives, { ...artifact, classifier });
			}

			return;
		}
	}));

	const conflicts: VersionFileDependency[] = conflictUIDs.map(uid => ({ uid }));

	const result = versions.entries()
		.filter(([_, version]) => version.used)
		.map(([versionKey, version]): VersionOutput => ({
			version: versionKey,
			releaseTime: version.firstSeen,
			type: "release",

			order: -1,
			conflicts,
			volatile: true,

			libraries: [
				...sharedDeps.values().map(transformPistonLibrary),
				...version.modules.entries().flatMap(([moduleKey, module]) => {
					const name = `${moduleKey}:${versionKey}`;

					if (version.preferSplit)
						return transformModuleSplit(name, module);
					else
						return transformModuleMerged(name, module);
				}),
			]
		}));

	return [...result];
}

function transformModuleMerged(name: string, module: LWJGLModule): VersionFileLibrary[] {
	const result: VersionFileLibrary[] = [];

	if (module.javaCode !== undefined)
		result.push({ name, downloads: { artifact: module.javaCode } });

	if (!isEmpty(module.nativeCode)) {
		const classifiers = Object.fromEntries(
			module.nativeCode.values()
				.map(artifact => [artifact.classifier, omit(artifact, ["classifier"])])
		);

		const natives = Object.fromEntries(
			module.nativeCode.entries()
				.map(([platform, artifact]) => [platform, artifact.classifier])
		);

		result.push({ name, downloads: { classifiers }, natives });
	}

	return result;
}

function transformModuleSplit(name: string, module: LWJGLModule): VersionFileLibrary[] {
	const result: VersionFileLibrary[] = [];

	if (module.javaCode !== undefined)
		result.push({ name, downloads: { artifact: module.javaCode } });

	for (const [platform, artifact] of module.nativeCode) {
		result.push({
			name: name + ":" + artifact.classifier,
			downloads: { artifact: omit(artifact, ["classifier"]) },
			rules: [{
				action: "allow",
				os: { name: platform }
			}]
		});
	}

	return result;
}

function mapClassifier(classifier: string): VersionFilePlatform | undefined {
	const prefix = "natives-";

	if (!classifier.startsWith(prefix))
		return undefined;

	classifier = classifier.substring(prefix.length);

	const optionalSuffix = "-patch";

	if (classifier.endsWith(optionalSuffix))
		classifier = classifier.slice(0, -optionalSuffix.length);

	switch (classifier) {
		case "windows":
		case "windows-x86":
		case "windows-arm64":
		case "osx":
		case "linux":
		case "linux-arm64":
		case "linux-arm32":
		case "freebsd":
			return classifier;

		case "macos": return "osx";
		case "macos-arm64": return "osx-arm64";
	}

	return undefined;
}

export default [lwjgl3, lwjgl2];
