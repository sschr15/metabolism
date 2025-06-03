import { HTTPCacheMode } from "#core/httpClient.ts";
import type { DiskCachedClient } from "#core/impl/http/diskCachedClient.ts";
import { defineProvider } from "#core/provider.ts";
import { FabricMetaVersions } from "#schema/fabricMeta.ts";
import { MavenArtifactRef } from "#schema/mavenArtifactRef.ts";
import { FABRIC_MAVEN, FABRIC_META, QUILT_MAVEN, QUILT_META } from "#util/constants/domains.ts";
import { z } from "zod/v4";

export const fabricLoaderVersions = defineProvider({
	id: "fabric-loader-versions",

	provide: http => provide(http, new URL("v2/", FABRIC_META), FABRIC_MAVEN),
});

export const quiltLoaderVersions = defineProvider({
	id: "quilt-loader-versions",

	provide: http => provide(http, new URL("v3/", QUILT_META), new URL("repository/release/", QUILT_MAVEN)),
});

export default [fabricLoaderVersions, quiltLoaderVersions];

async function provide(http: DiskCachedClient, meta: string | URL, maven: string | URL): Promise<FabricLoaderInfo[]> {
	const list = FabricMetaVersions.parse(
		(await http.getCached(
			"versions_loader.json",
			new URL("versions/loader", meta)
		)).json()
	);

	return await Promise.all(list.map(async (version): Promise<FabricLoaderInfo> => {
		const infoResponse = await http.getCached(
			version.version + ".json",
			version.maven.url(maven, "json"),
			{ mode: HTTPCacheMode.Eternal }
		);

		if (!infoResponse.lastModified)
			throw new Error("Missing Last-Modified header");

		const info = LoaderInfo.parse(infoResponse.json());

		return {
			...info,
			libraries: {
				...info.libraries,
				common: [{ name: version.maven, url: maven.toString() }, ...info.libraries.common],
			},
			version: version.version,
			separator: version.separator,
			lastModified: infoResponse.lastModified,
		};
	}));
}

export interface FabricLoaderInfo extends z.output<typeof LoaderInfo> {
	version: string;
	separator?: string;
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
