import { HTTPCacheMode } from "#core/httpClient.ts";
import type { DiskCachedClient } from "#core/impl/http/diskCachedClient.ts";
import { defineProvider } from "#core/provider.ts";
import { FabricInstallerData } from "#schema/fabric/fabricInstallerData.ts";
import { FabricMetaVersion, FabricMetaVersions } from "#schema/fabric/fabricMeta.ts";
import { FABRIC_MAVEN, FABRIC_META, QUILT_MAVEN, QUILT_META } from "#util/constants/urls.ts";

export const fabricLoaderVersions = defineProvider({
	id: "fabric-loader-versions",

	provide: http => provide(http, new URL("v2/", FABRIC_META), FABRIC_MAVEN),
});

export const quiltLoaderVersions = defineProvider({
	id: "quilt-loader-versions",

	provide: http => provide(http, new URL("v3/", QUILT_META), QUILT_MAVEN),
});

export default [fabricLoaderVersions, quiltLoaderVersions];

async function provide(http: DiskCachedClient, meta: string | URL, maven: string | URL): Promise<FabricLoaderVersion[]> {
	const list = FabricMetaVersions.parse(
		(await http.getCached(
			"loader-versions.json",
			new URL("versions/loader", meta)
		)).json()
	);

	return await Promise.all(list.map(async (version): Promise<FabricLoaderVersion> => {
		const installerDataResponse = await http.getCached(
			version.version + ".json",
			version.maven.url(maven, "json"),
			{ mode: HTTPCacheMode.Eternal }
		);

		if (!installerDataResponse.lastModified)
			throw new Error("Missing Last-Modified header");

		const installerData = FabricInstallerData.parse(installerDataResponse.json());

		return {
			installerData,
			lastModified: installerDataResponse.lastModified,
			...version,
		};
	}));
}

export interface FabricLoaderVersion extends FabricMetaVersion {
	installerData: FabricInstallerData;
	lastModified: Date;
}
