import { computeIfAbsent } from "#common/index.ts";
import { ruleSetAppliesByDefault } from "#common/types/pistonVersion.ts";
import pistonMetaGameVersions from "#provider/pistonMetaGameVersions.ts";
import { defineGoal, type VersionFileOutput } from "#types/goal.ts";
import type { VersionFileLibrary } from "#types/versionFile.ts";

function parseLibraryName(name: string) {
	const [groupID, artifactID, version, classifier] = name.split(":", 4);

	if (!groupID || !artifactID || !version)
		throw new Error(`Malformed library name: '${name}'`);

	return { groupID, artifactID, version, classifier };
}

export default defineGoal({
	id: "org.lwjgl3",
	name: "LWJGL 3",
	provider: pistonMetaGameVersions,

	generate(data): VersionFileOutput[] {
		const versions: Map<string, VersionFileLibrary[]> = new Map;

		for (const version of data) {
			for (const library of version.libraries) {
				const { groupID, artifactID, version } = parseLibraryName(library.name);

				if (groupID !== "org.lwjgl")
					continue;

				if (library.rules && !ruleSetAppliesByDefault(library.rules))
					continue;

				const versionLibs = computeIfAbsent(versions, version, () => []);

				if (versionLibs.some(x => parseLibraryName(x.name).artifactID === artifactID))
					continue;

				versionLibs.push(library);
			}
		}
		return [
			...versions.entries().map(([key, value]) => ({
				version: key,
				releaseTime: (new Date).toUTCString(),
				libraries: value,
			} satisfies VersionFileOutput))
		];
	}
});
