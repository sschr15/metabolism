import { HTTPCacheMode } from "#core/httpCache.ts";
import { defineProvider } from "#core/provider.ts";
import { FabricMetaVersion, FabricMetaVersions } from "#schema/fabricMeta.ts";

export default defineProvider({
	id: "fabric-intermediary-versions",

	async provide(http) {
		const list = FabricMetaVersions.parse(
			await http.fetchJSONContent(
				"versions_loader.json",
				"https://meta.fabricmc.net/v2/versions/intermediary"
			)
		);

		return await Promise.all(list.map(async (version): Promise<FabricIntermediaryVersion> => {
			const infoResponse = await http.fetch(
				version.version + ".jar.sha1",
				version.maven.url("https://maven.fabricmc.net", "jar.sha1"),
				undefined,
				{ mode: HTTPCacheMode.Eternal }
			);

			if (infoResponse.lastModified === null)
				throw new Error("Missing Last-Modified header");

			return {
				...version,
				lastModified: infoResponse.lastModified,
				sha1: infoResponse.body,
			};
		}));
	},
});

export interface FabricIntermediaryVersion extends FabricMetaVersion {
	lastModified: Date;
	sha1: string;
}
