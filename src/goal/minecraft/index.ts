import { mapObjectValues, throwError } from "#common/index.ts";
import { defineGoal, type VersionFileOutput } from "#types/goal.ts";
import { HTTPCacheMode } from "#types/httpCache.ts";
import { PistonVersion } from "./pistonMeta/pistonVersion.ts";
import { fetchPistonVersionManifest } from "./pistonMeta/pistonVersionManifest.ts";

export default defineGoal({
	id: "net.minecraft",
	name: "Minecraft",
	async prepare(http) {
		const manifest = await fetchPistonVersionManifest(http);

		return manifest.versions.map(async version => {
			const json = await http.fetchJSON(
				"versions/" + version.id + ".json",
				version.url,
				{ mode: HTTPCacheMode.CompareLocalDigest, algorithm: "sha-1", expected: version.sha1 }
			);

			return PistonVersion.parse(json);
		});
	},
	generate(input): VersionFileOutput {
		return {
			version: input.id,
			type: input.type,
			releaseTime: input.releaseTime,
			order: -2,

			"+traits": [],

			compatibleJavaMajors: [input?.javaVersion?.majorVersion].filter(x => x !== undefined),
			compatibleJavaName: input.javaVersion?.component,
			mainClass: input.mainClass,
			minecraftArguments: input.minecraftArguments
				?? input?.arguments?.game?.filter(x => typeof x === "string").join(" ")
				?? throwError("Neither minecraftArguments nor arguments present"),

			mainJar: {
				name: `com.mojang:minecraft:${input.id}`,
				downloads: { artifact: input.downloads.client }
			},
			libraries: (
				input.libraries
					?.map(x => ({ // strip path
						...x,
						downloads: x.downloads ? {
							artifact: x.downloads.artifact
								? { ...x.downloads.artifact, path: undefined }
								: undefined,
							classifiers: x.downloads.classifiers ?
								mapObjectValues(x.downloads.classifiers, value => ({ ...value, path: undefined }))
								: undefined,
						} : undefined
					}))
					.filter(x => !x.name.startsWith("org.lwjgl:") && !x.name.startsWith("org.lwjgl.lwjgl:"))
			),
			assetIndex: input.assetIndex,
		};
	}
});

