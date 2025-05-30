import type { DiskHTTPCache } from "#runner/diskHTTPCache.ts";
import { HTTPCacheMode, type HTTPCache } from "#types/httpCache.ts";
import { PistonVersion } from "#types/pistonMeta/pistonVersion.ts";
import { PistonVersionManifest, PistonVersionRef } from "#types/pistonMeta/pistonVersionManifest.ts";
import { defineProvider } from "#types/provider.ts";

export default defineProvider({
	id: "game-versions",

	async provide(http): Promise<PistonVersion[]> {
		return Promise.all([pistonMetaVersions(http), fabricMavenExperimentalVersions(http)])
			.then(versions => versions.flat());
	}
});

async function pistonMetaVersions(http: DiskHTTPCache): Promise<PistonVersion[]> {
	const base = "piston-meta";

	const manifest = PistonVersionManifest.parse(
		await http.fetchJSONContent(
			base + "/versions.json",
			"https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
		)
	);

	return await getVersions(http, base, manifest.versions);
}

async function fabricMavenExperimentalVersions(http: DiskHTTPCache): Promise<PistonVersion[]> {
	const base = "fabric-maven";

	const experimentalManifest = PistonVersionManifest.parse(
		await http.fetchJSONContent(
			base + "/experimental-versions.json",
			"https://maven.fabricmc.net/net/minecraft/experimental_versions.json"
		)
	);

	const versions = experimentalManifest.versions
		.filter(version => version.type === "pending");

	const full = await getVersions(http, base, versions);

	return full.map(version => ({ ...version, type: "experiment" }));
}

async function getVersions(http: HTTPCache, base: string, versions: PistonVersionRef[]): Promise<PistonVersion[]> {
	return await Promise.all(versions.map(async (version): Promise<PistonVersion> => {
		const json = await http.fetchJSONContent(
			base + "/" + version.id + ".json",
			version.url,
			{ mode: HTTPCacheMode.CompareLocalDigest, algorithm: "sha-1", expected: version.sha1 }
		);

		return PistonVersion.parse(json);
	}));
}

