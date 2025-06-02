import { defineGoal, type VersionOutput } from "#core/goal.ts";
import { FabricLoaderLibrary, fabricLoaderVersions, quiltLoaderVersions, type FabricLoaderInfo } from "#provider/fabrishLoaderVersions.ts";
import type { VersionFileLibrary } from "#schema/format/v1/versionFile.ts";

const fabricLoader = defineGoal({
	id: "net.fabricmc.fabric-loader",
	name: "Fabric Loader",
	provider: fabricLoaderVersions,

	generate: data => data.map(info => ({ ...transformInfo(info), type: "release" })),
	recommend: first => first,
});

const quiltLoader = defineGoal({
	id: "org.quiltmc.quilt-loader",
	name: "Quilt Loader",
	provider: quiltLoaderVersions,

	generate: data => data.map(info => {
		let type = "release";

		if (info.version.includes("-")) {
			let suffix = info.version.substring(info.version.lastIndexOf("-") + 1);

			if (info.separator && suffix.includes(info.separator))
				suffix = suffix.substring(0, suffix.indexOf(info.separator));

			if (suffix === "pre")
				type = "prerelease";
			else if (suffix.length !== 0)
				type = suffix;
		}

		return { ...transformInfo(info), type };
	}),
	recommend: first => first,
});

export default [fabricLoader, quiltLoader];

function transformInfo(info: FabricLoaderInfo): VersionOutput {
	return {
		version: info.version,
		releaseTime: info.lastModified.toISOString(),

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
