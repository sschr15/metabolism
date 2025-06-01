import { HTTPCacheMode } from "#core/httpCache.ts";
import { defineProvider } from "#core/provider.ts";
import { FabricMetaVersion, FabricMetaVersions } from "#schema/fabricMeta.ts";
import { FABRIC_MAVEN, FABRIC_META } from "#util/constants/domains.ts";

export default defineProvider({
	id: "fabric-intermediary-versions",

	async provide(http) {
		const list = FabricMetaVersions.parse(
			(await http.fetchJSON(
				"versions_loader.json",
				new URL("v2/versions/intermediary", FABRIC_META)
			)).body
		);

		return await Promise.all(list.map(async (version): Promise<FabricIntermediaryVersion> => {
			const infoResponse = await http.fetchMetadata(
				version.version + ".jar",
				version.maven.url(FABRIC_MAVEN, "jar"),
				{ mode: HTTPCacheMode.Eternal }
			);

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
