import { resolveMavenLibrary } from "#common/transformation/maven.ts";
import { HTTPCacheMode } from "#types/httpCache.ts";
import { MavenLibraryName } from "#types/mavenLibraryName.ts";
import { defineProvider } from "#types/provider.ts";
import { z } from "zod/v4";

const LoaderVersions = z.array(z.object({
	maven: MavenLibraryName,
	version: z.string(),
	stable: z.boolean(),
}));

const LoaderLibrary = z.object({
	name: z.string(),
	url: z.string().optional(),
});

const FabricLoaderInfoBase = z.object({
	version: z.union([z.literal(1), z.literal(2)]),
	libraries: z.object({
		client: z.array(LoaderLibrary).default([]),
		common: z.array(LoaderLibrary).default([]),
	}),
	min_java_version: z.number().optional(),
	mainClass: z.union([
		z.object({ client: z.string(), }),
		z.string(),
	]).transform(input => (typeof input === "string" ? { client: input } : input)),
}).transform(input => ({
	formatVersion: input.version,
	minJavaVersion: input.min_java_version,
	libraries: input.libraries,
	mainClass: input.mainClass,
}));

export interface FabricLoaderInfo extends z.output<typeof FabricLoaderInfoBase> {
	version: string;
	lastModified: Date;
}

export default defineProvider({
	id: "fabric-loader-versions",

	async provide(http) {
		const list = LoaderVersions.parse(
			await http.fetchJSONContent(
				"versions_loader.json",
				"https://meta.fabricmc.net/v2/versions/loader"
			)
		);

		return await Promise.all(list.map(async (version): Promise<FabricLoaderInfo> => {
			const infoResponse = await http.fetchJSON(
				version.version + ".json",
				resolveMavenLibrary(
					"https://maven.fabricmc.net",
					version.maven,
					"json"
				),
				{ mode: HTTPCacheMode.Eternal }
			);

			if (infoResponse.lastModified === null)
				throw new Error("Missing Last-Modified header");

			return {
				version: version.version,
				lastModified: infoResponse.lastModified,
				...FabricLoaderInfoBase.parse(infoResponse.body),
			};
		}));
	},
});
