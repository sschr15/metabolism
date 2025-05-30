import type { DiskHTTPCache } from "#runner/diskHTTPCache.ts";
import { HTTPCacheMode, type HTTPCache } from "#types/httpCache.ts";
import { PistonVersion } from "#types/pistonMeta/pistonVersion.ts";
import { PistonVersionManifest, PistonVersionRef } from "#types/pistonMeta/pistonVersionManifest.ts";
import { defineProvider } from "#types/provider.ts";
import { sortBy } from "es-toolkit";
import { OMNIARCHIVE_MAPPINGS } from "./omniarchiveMappings.ts";

export default defineProvider({
	id: "game-versions",

	async provide(http): Promise<PistonVersion[]> {
		return Promise.all([pistonMetaVersions(http), omniarchiveVersions(http)])
			.then(versions => sortBy(versions.flat(), [version => version.releaseTime]));
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

// not all omniarchive versions - just enough to maintain backwards compat :)
async function omniarchiveVersions(http: DiskHTTPCache): Promise<PistonVersion[]> {
	const base = "omniarchive";

	const manifest = PistonVersionManifest.parse(
		await http.fetchJSONContent(
			base + "/manifest.json",
			"https://meta.omniarchive.uk/v1/manifest.json"
		)
	);

	const versions = manifest.versions
		.filter(x => Object.hasOwn(OMNIARCHIVE_MAPPINGS, x.id))
		.map(x => ({ ...x, ...OMNIARCHIVE_MAPPINGS[x.id]! }));

	return getVersions(http, base, versions);
}

async function getVersions(http: HTTPCache, base: string, versions: PistonVersionRef[]): Promise<PistonVersion[]> {
	return await Promise.all(versions.map(async (version): Promise<PistonVersion> => {
		const json = await http.fetchJSONContent(
			base + "/" + version.id + ".json",
			version.url,
			{ mode: HTTPCacheMode.CompareLocalDigest, algorithm: "sha-1", expected: version.sha1 }
		);

		// manifest ID and type should take precidence - in some cases we override it
		return { ...PistonVersion.parse(json), id: version.id, type: version.type };
	}));
}

