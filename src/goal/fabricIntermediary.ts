import { defineGoal, type VersionOutput } from "#core/goal.ts";
import fabricIntermediaryVersions, { type FabricIntermediaryVersion } from "#provider/fabricIntermediaryVersions.ts";

export default defineGoal({
	id: "net.fabricmc.intermediary",
	name: "Fabric Intermediary",
	provider: fabricIntermediaryVersions,

	generate: data => data.map(transformVersion),
	recommend: () => true,
});

function transformVersion(version: FabricIntermediaryVersion): VersionOutput {
	return {
		version: version.version,
		releaseTime: version.lastModified.toISOString(),
		type: "release",

		requires: [{ uid: "net.minecraft", equals: version.version }],
		volatile: true,

		libraries: [{ name: version.maven.value, url: "https://maven.fabricmc.net", }],
	};
}
