import { z } from "zod/v4";

export const MavenLibraryName = z.string().transform((name, context) => {
	const [groupID, artifactID, version, classifier] = name.split(":", 4);

	if (!groupID || !artifactID || !version) {
		context.addIssue("Required: <groupID>:<artifactID>:<version>");
		return z.NEVER;
	}

	const result = {
		full: name,
		groupID,
		artifactID,
		version,
		classifier,
	};

	return result;
});

export interface MavenLibraryName extends z.output<typeof MavenLibraryName> { }
