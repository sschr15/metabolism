import { z } from "zod/v4";
import { MavenArtifactRef } from "./mavenArtifactRef.ts";

export const FabricMetaVersion = z.object({
	maven: MavenArtifactRef,
	version: z.string(),
	separator: z.string().optional(),
});

export interface FabricMetaVersion extends z.output<typeof FabricMetaVersion> { }

export const FabricMetaVersions = z.array(FabricMetaVersion);
