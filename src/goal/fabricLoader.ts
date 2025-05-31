import { defineGoal, type VersionOutput } from "#core/goal.ts";
import fabricLoaderVersions, { FabricLoaderLibrary, type FabricLoaderInfo } from "#provider/fabricLoaderVersions.ts";
import type { VersionFileLibrary } from "#schema/format/v1/versionFile.ts";

export default defineGoal({
	id: "net.fabricmc.fabric-loader",
	name: "Fabric Loader",
	provider: fabricLoaderVersions,

	generate: data => data.map(transformInfo),
	recommend: first => first,
});

function transformInfo(info: FabricLoaderInfo): VersionOutput {
	return {
		version: info.version,
		releaseTime: info.lastModified.toISOString(),
		type: "release",

		requires: [{ uid: "net.fabricmc.intermediary" }],

		mainClass: info.mainClass.client,
		"+tweakers": [...info.launchWrapper.tweakers.client, ...info.launchWrapper.tweakers.common],

		libraries: [
			...info.libraries.client.map(transformLoaderLibrary),
			...info.libraries.common.map(transformLoaderLibrary),
		],
	};
}

function transformLoaderLibrary(library: FabricLoaderLibrary): VersionFileLibrary {
	return { name: library.name.value, url: library.url };
}
