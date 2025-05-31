import { defineGoal, type VersionOutput } from "#core/goal.ts";
import fabricLoaderVersions, { type FabricLoaderInfo } from "#provider/fabricLoaderVersions.ts";

export default defineGoal({
	id: "net.fabricmc.fabric-loader",
	name: "Fabric Loader",
	provider: fabricLoaderVersions,

	generate: data => data.map(transformInfo),
	isRecommended: first => first,
});

function transformInfo(info: FabricLoaderInfo): VersionOutput {
	return {
		version: info.version,
		releaseTime: info.lastModified.toISOString(),
		type: "release",

		requires: [{ uid: "net.fabricmc.intermediary" }],

		mainClass: info.mainClass.client,

		libraries: [...info.libraries.client, ...info.libraries.common],
	};
}
