import { HTTPCacheMode } from "#types/httpCache.ts";
import { defineProvider } from "#types/provider.ts";
import { PistonVersion } from "./types/pistonVersion.ts";
import { fetchPistonVersionManifest } from "./types/pistonVersionManifest.ts";

export default defineProvider({
	id: "com.mojang.piston-meta",

	async provide(http) {
		const manifest = await fetchPistonVersionManifest(http);

		return Promise.all(manifest.versions.map(async version => {
			const json = await http.fetchJSON(
				"versions/" + version.id + ".json",
				version.url,
				{ mode: HTTPCacheMode.CompareLocalDigest, algorithm: "sha-1", expected: version.sha1 }
			);

			return PistonVersion.parse(json);
		}));
	}
});
