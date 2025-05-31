import { HTTPCacheMode } from "#core/httpCache.ts";
import { defineProvider } from "#core/provider.ts";
import { FabricMetaVersions } from "#schema/fabricMeta.ts";
import { MavenArtifactRef } from "#schema/mavenArtifactRef.ts";
import { z } from "zod/v4";

export default defineProvider({
	id: "fabric-loader-versions",

	async provide(http) {
		const list = FabricMetaVersions.parse(
			await http.fetchJSONContent(
				"versions_loader.json",
				"https://meta.fabricmc.net/v2/versions/loader"
			)
		);

		return await Promise.all(list.map(async (version): Promise<FabricLoaderInfo> => {
			const mavenBase = "https://maven.fabricmc.net";

			const infoResponse = await http.fetchJSON(
				version.version + ".json",
				version.maven.url(mavenBase, "json"),
				{ mode: HTTPCacheMode.Eternal }
			);

			if (infoResponse.lastModified === null)
				throw new Error("Missing Last-Modified header");

			const info = LoaderInfo.parse(infoResponse.body);

			return {
				...info,
				libraries: {
					...info.libraries,
					common: [{ name: version.maven, url: mavenBase }, ...info.libraries.common],
				},
				version: version.version,
				lastModified: infoResponse.lastModified,
			};
		}));
	},
});

export interface FabricLoaderInfo extends z.output<typeof LoaderInfo> {
	version: string;
	lastModified: Date;
}

export const FabricLoaderLibrary = z.object({
	name: MavenArtifactRef,
	url: z.string().optional(),
	sha1: z.string().optional(),
	size: z.number().optional(),
});

export interface FabricLoaderLibrary extends z.output<typeof FabricLoaderLibrary> { }

const LoaderInfo = z.object({
	version: z.union([z.literal(1), z.literal(2)]),
	libraries: z.object({
		client: z.array(FabricLoaderLibrary).default([]),
		common: z.array(FabricLoaderLibrary).default([]),
	}),
	min_java_version: z.number().optional(),
	mainClass: z.union([
		z.object({ client: z.string(), }),
		z.string(),
	]).transform(input => (typeof input === "string" ? { client: input } : input)),
	launchwrapper: z.object({
		tweakers: z.object({
			client: z.array(z.string()).default([]),
			common: z.array(z.string()).default([])
		}).prefault({}),
	}).prefault({}),
}).transform(input => ({
	formatVersion: input.version,
	minJavaVersion: input.min_java_version,
	libraries: input.libraries,
	mainClass: input.mainClass,
	launchWrapper: input.launchwrapper,
}));
