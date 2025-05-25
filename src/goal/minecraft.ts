import { throwError } from "#common/index.ts";
import type { PistonLibrary, PistonVersion } from "#common/schema/pistonVersion.ts";
import { isLWJGL2, isLWJGL2Dependency, isLWJGL3, ruleSetAppliesByDefault, transformPistonLibrary } from "#common/transformation/pistonVersion.ts";
import pistonMetaGameVersions from "#provider/gameVersions.ts";
import { defineGoal, type VersionFileOutput } from "#types/goal.ts";
import { VersionFileTrait, type VersionFileDependency } from "#types/versionFile.ts";

export default defineGoal({
	id: "net.minecraft",
	name: "Minecraft",
	provider: pistonMetaGameVersions,

	generate: data => data.map(transformVersion),
});

function transformVersion(version: PistonVersion): VersionFileOutput {
	const requires: VersionFileDependency[] = [];
	const traits: VersionFileTrait[] = [];
	let mainClass: string | undefined = version.mainClass;

	let libraries = version.libraries;

	libraries = libraries.filter(x => !processLWJGL(x, requires, traits));

	if (mainClass.startsWith("net.minecraft.launchwrapper.")) {
		libraries = libraries.filter(
			x => !x.name.full.startsWith("net.minecraft:launchwrapper:")
				&& x.name.groupID !== "net.sf.jopt-simple"
				&& x.name.groupID !== "org.ow2.asm"
		);

		mainClass = undefined;
		traits.push(VersionFileTrait.LegacyLaunch);
	}

	return {
		version: version.id,
		type: version.type,
		releaseTime: version.releaseTime,

		order: -2,
		requires,

		"+traits": traits,

		compatibleJavaMajors: [version?.javaVersion?.majorVersion].filter(x => x !== undefined),
		compatibleJavaName: version.javaVersion?.component,
		mainClass: version.mainClass,
		minecraftArguments: version.minecraftArguments
			?? version?.arguments?.game?.filter(x => typeof x === "string").join(" ")
			?? throwError("Neither minecraftArguments nor arguments present"),

		mainJar: {
			name: `com.mojang:minecraft:${version.id}:client`,
			downloads: { artifact: version.downloads.client }
		},
		assetIndex: version.assetIndex,
		libraries: libraries.map(transformPistonLibrary),
	};
}


function processLWJGL(lib: PistonLibrary, requires: VersionFileDependency[], traits: VersionFileTrait[]) {
	if (isLWJGL2Dependency(lib.name))
		return true;

	const lwjgl2 = isLWJGL2(lib.name);
	const lwjgl3 = isLWJGL3(lib.name);

	if (lwjgl2 || lwjgl3) {
		if (lib.rules && !ruleSetAppliesByDefault(lib.rules))
			return true;

		const uid = lwjgl3 ? "org.lwjgl3" : "org.lwjgl";
		const existing = requires.find(x => x.uid === uid);

		if (existing) {
			if (existing.suggests !== lib.name.version)
				throw new Error(`Multiple versions of LWJGL specified! (both ${existing.suggests} and ${lib.name.version} present)`);
			else
				return true;
		}

		if (lwjgl3)
			traits.push(VersionFileTrait.UseFirstThreadOnMacOS);

		requires.push({ uid, suggests: lib.name.version });
		return true;
	}

	return false;
}
