import { defineGoal, type VersionOutput } from "#core/goal.ts";
import pistonMetaGameVersions from "#provider/gameVersions/index.ts";
import { VersionFileTrait, type VersionFileDependency } from "#schema/format/v1/versionFile.ts";
import type { PistonArgument, PistonLibrary, PistonVersion } from "#schema/pistonMeta/pistonVersion.ts";
import { throwError } from "#util/general.ts";
import { isLWJGL2, isLWJGL2Dependency, isLWJGL3 } from "#util/transformation/maven.ts";
import { isPlatformLibrary, ruleSetAppliesByDefault, transformPistonLibrary } from "#util/transformation/pistonMeta.ts";

export default defineGoal({
	id: "net.minecraft",
	name: "Minecraft",
	provider: pistonMetaGameVersions,

	generate: data => data.map(transformVersion),
	recommend: (first, version) => first && version.type === "release",
});

function transformVersion(version: PistonVersion): VersionOutput {
	const requires: VersionFileDependency[] = [];
	const traits: VersionFileTrait[] = [];
	let mainClass: string | undefined = version.mainClass;

	let libraries = version.libraries;

	libraries = libraries.filter(x => !processLWJGL(x, requires, traits));

	if (mainClass?.startsWith("net.minecraft.launchwrapper.")) {
		libraries = libraries.filter(
			x => !x.name.value.startsWith("net.minecraft:launchwrapper:")
				&& x.name.group !== "net.sf.jopt-simple"
				&& x.name.group !== "org.ow2.asm"
		);

		mainClass = undefined;
		traits.push(VersionFileTrait.LegacyLaunch);
	}

	if (version.arguments?.game) {
		const featureObjects = version.arguments.game
			.filter(x => typeof x === "object")
			.flatMap(x => x.rules)
			.map(x => x.features)
			.filter(x => typeof x === "object");

		if (featureObjects.some(x => x.is_quick_play_singleplayer))
			traits.push(VersionFileTrait.QuickPlaySingleplayerAware);

		if (featureObjects.some(x => x.is_quick_play_multiplayer))
			traits.push(VersionFileTrait.QuickPlayMultiplayerAware);
	}

	return {
		version: version.id,
		type: version.type,
		releaseTime: version.releaseTime.toISOString(),

		requires,

		"+traits": traits,

		compatibleJavaMajors: [version?.javaVersion?.majorVersion].filter(x => x !== undefined),
		compatibleJavaName: version.javaVersion?.component,
		mainClass,
		minecraftArguments: version.minecraftArguments
			?? (version.arguments?.game ? transformNewArgs(version.arguments.game) : undefined)
			?? throwError("Neither minecraftArguments nor arguments.game present"),

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
		// determine version based on non-pltaform-specific libraries in case the version varies
		if (isPlatformLibrary(lib))
			return true;

		const uid = lwjgl3 ? "org.lwjgl3" : "org.lwjgl";
		const existing = requires.find(x => x.uid === uid);

		if (existing) {
			if (existing.suggests !== lib.name.version)
				throw new Error(`Multiple versions of LWJGL specified! (both '${existing.suggests}' and '${lib.name.version}' present)`);
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

const ARG_REF_PATTERN = /\$\{(\w+)\}/g;
const KNOWN_ARG_REFS = [
	"assets_index_name", "assets_root", "auth_access_token", "auth_player_name", "auth_session",
	"auth_uuid", "game_assets", "game_directory", "profile_name", "user_properties",
	"user_type", "version_name", "version_type"
];

// transform new arguments to legacy arguments because we're *still* using them :D
// NOTE: this might break in edge cases - but it's very unlikely
function transformNewArgs(args: PistonArgument[]): string {
	const result = [...flattenArgs(args)];

	for (let i = result.length - 1; i >= 0; --i) {
		const arg = result[i]!;
		const prevArg = result[i - 1];

		const refs = [...arg.matchAll(ARG_REF_PATTERN)].map(match => match[1]!);

		if (refs.every(ref => KNOWN_ARG_REFS.includes(ref)))
			continue;

		// if we have unknown references, remove them
		result.splice(i, 1);

		if (arg.startsWith("-"))
			continue;

		// if the previous argument expects a value, remove it too
		if (prevArg?.startsWith("-") && !prevArg.includes("=")) {
			result.splice(i - 1, 1);
			--i;
		}
	}

	return result.join(" ");
}

function* flattenArgs(args: PistonArgument[]): Generator<string> {
	for (const arg of args) {
		if (typeof arg === "string")
			yield arg;
		else {
			if (arg.rules && !ruleSetAppliesByDefault(arg.rules))
				continue;

			if (typeof arg.value === "string")
				yield arg.value;
			else
				yield* arg.value;
		}
	}
}
