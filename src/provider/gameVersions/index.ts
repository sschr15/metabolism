import { HTTPCacheMode, type HTTPCache } from "#core/httpCache.ts";
import type { DiskHTTPCache } from "#core/impl/diskHTTPCache.ts";
import { defineProvider } from "#core/provider.ts";
import { PistonVersion } from "#schema/pistonMeta/pistonVersion.ts";
import { PistonVersionManifest, PistonVersionRef } from "#schema/pistonMeta/pistonVersionManifest.ts";
import { OMNIARCHIVE_META, PISTON_META } from "#util/constants/domains.ts";
import { sortBy } from "es-toolkit";
import { OMNIARCHIVE_MAPPINGS } from "./omniarchiveMappings.ts";

export default defineProvider({
	id: "game-versions",

	async provide(http): Promise<PistonVersion[]> {
		return Promise.all([pistonMetaVersions(http), omniarchiveVersions(http)])
			.then(versions => sortBy(versions.flat(), [version => -version.releaseTime]));
	}
});

async function pistonMetaVersions(http: DiskHTTPCache): Promise<PistonVersion[]> {
	const base = "piston-meta";

	const manifest = PistonVersionManifest.parse(
		(await http.fetchJSON(
			base + "/versions.json",
			new URL("mc/game/version_manifest_v2.json", PISTON_META)
		)).body
	);

	return await getVersions(http, base, manifest.versions);
}

// not all omniarchive versions - just enough to maintain backwards compat :)
async function omniarchiveVersions(http: DiskHTTPCache): Promise<PistonVersion[]> {
	const base = "omniarchive";

	const manifest = PistonVersionManifest.parse(
		(await http.fetchJSON(
			base + "/manifest.json",
			new URL("v1/manifest.json", OMNIARCHIVE_META)
		)).body
	);

	const versions = manifest.versions
		.filter(x => Object.hasOwn(OMNIARCHIVE_MAPPINGS, x.id))
		.map(x => ({ ...x, ...OMNIARCHIVE_MAPPINGS[x.id]! }));

	return getVersions(http, base, versions);
}

async function getVersions(http: HTTPCache, base: string, versions: PistonVersionRef[]): Promise<PistonVersion[]> {
	return await Promise.all(versions.map(async (version): Promise<PistonVersion> => {
		const response = await http.fetchJSON(
			base + "/" + version.id + ".json",
			version.url,
			{ mode: HTTPCacheMode.CompareLocalDigest, algorithm: "sha-1", expected: version.sha1 }
		);
		const parsed = PistonVersion.parse(response.body);

		// manifest ID and type should take precidence - in some cases we override it
		return { ...parsed, id: version.id, type: version.type };
	}));
}

