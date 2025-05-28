import fabricLoaderVersions, { type FabricLoaderInfo } from "#provider/fabricLoaderVersions.ts";
import { defineGoal, type VersionOutput } from "#types/goal.ts";

export default defineGoal({
	id: "net.fabricmc.fabric-loader",
	name: "Fabric Loader",
	provider: fabricLoaderVersions,

	generate: data => data.map(transformInfo),
});

function transformInfo(info: FabricLoaderInfo): VersionOutput {
	return {
		version: info.version,
		releaseTime: info.lastModified.toISOString(),
		type: "release",

		order: 10,
		requires: [{ uid: "net.fabricmc.intermediary" }],

		mainClass: info.mainClass.client,

		libraries: [...info.libraries.client, ...info.libraries.common],
	};
}
