import { mapObjectValues, throwError } from "#common/index.ts";
import pistonMetaGameVersions from "#provider/pistonMetaGameVersions.ts";
import { defineGoal, type VersionFileOutput } from "#types/goal.ts";

export default defineGoal({
	id: "net.minecraft",
	name: "Minecraft",
	provider: pistonMetaGameVersions,

	generate(data): VersionFileOutput[] {
		return data.map(input => ({
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
		}));
	}
});

