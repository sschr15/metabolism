import { PistonArtifact, PistonAssetIndexRef, PistonLibrary, PistonRule } from "#common/pistonVersion.ts";
import { z } from "zod/v4";

export const PistonArgument = z.union([
	z.string(),
	z.object({
		rules: z.array(PistonRule),
		value: z.union([z.string(), z.array(z.string())]),
	})
]);

export type PistonArgument = z.output<typeof PistonArgument>;

export const PistonVersion = z.object({
	arguments: z.object({
		game: z.array(PistonArgument).optional(),
		jvm: z.array(PistonArgument).optional(),
	}).optional(),
	assetIndex: PistonAssetIndexRef.optional(),
	downloads: z.object({ client: PistonArtifact.omit({ path: true }) }),
	id: z.string(),
	javaVersion: z.object({
		component: z.string(),
		majorVersion: z.number(),
	}).optional(),
	libraries: z.array(PistonLibrary).optional(),
	logging: z.object({
		client: z.object({
			argument: z.string(),
			file: PistonArtifact.omit({ path: true }).extend({ id: z.string() }),
			type: z.string(),
		}).optional(),
	}).optional(),
	mainClass: z.string(),
	minecraftArguments: z.string().optional(),
	releaseTime: z.string(),
	time: z.string(),
	type: z.string(),
});

export interface PistonVersion extends z.output<typeof PistonVersion> { }
