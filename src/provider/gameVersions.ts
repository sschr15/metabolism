import { PistonVersion } from "#common/schema/pistonMeta/pistonVersion.ts";
import { PistonVersionManifest } from "#common/schema/pistonMeta/pistonVersionManifest.ts";
import { HTTPCacheMode } from "#types/httpCache.ts";
import { defineProvider } from "#types/provider.ts";

export default defineProvider({
	id: "game-versions",

	async provide(http) {
		const manifest = PistonVersionManifest.parse(
			await http.fetchJSONContent(
				"piston-meta/version_manifest_v2.json",
				"https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
			)
		);

		return await Promise.all(manifest.versions.map(async (version): Promise<PistonVersion> => {
			const json = await http.fetchJSONContent(
				"piston-meta/" + version.id + ".json",
				version.url,
				{ mode: HTTPCacheMode.CompareLocalDigest, algorithm: "sha-1", expected: version.sha1 }
			);

			return PistonVersion.parse(json);
		}));
	}
});
``;
