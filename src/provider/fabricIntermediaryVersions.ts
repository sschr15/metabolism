import { defineProvider } from "#core/provider.ts";
import { FabricMetaVersion, FabricMetaVersions } from "#schema/fabric/fabricMeta.ts";
import { FABRIC_MAVEN, FABRIC_META } from "#util/constants/urls.ts";

export default defineProvider({
	id: "fabric-intermediary-versions",

	async provide(http) {
		const list = FabricMetaVersions.parse(
			(await http.getCached(
				"intermediary-versions.json",
				new URL("v2/versions/intermediary", FABRIC_META)
			)).json()
		);

		return await Promise.all(list.map(async (version): Promise<FabricIntermediaryVersion> => {
			const infoResponse = await http.headCached(version.version + ".jar", version.maven.url(FABRIC_MAVEN, "jar"));

			if (!infoResponse.lastModified)
				throw new Error("Missing Last-Modified header");

			return {
				...version,
				lastModified: infoResponse.lastModified,
			};
		}));
	},
});

export interface FabricIntermediaryVersion extends FabricMetaVersion {
	lastModified: Date;
}
