import { string, z } from "zod/v4";
import { MavenArtifactRef } from "../mavenLibraryName.ts";

export const PistonRule = z.object({
	action: z.enum(["allow", "disallow"]),
	features: z.object({
		is_demo_user: z.boolean().optional(),
		has_custom_resolution: z.boolean().optional(),
		has_quick_plays_support: z.boolean().optional(),
		is_quick_play_singleplayer: z.boolean().optional(),
		is_quick_play_multiplayer: z.boolean().optional(),
		is_quick_play_realms: z.boolean().optional(),
	}).optional(),
	os: z.object({
		name: z.string().optional(),
		version: z.string().optional(),
		arch: z.string().optional(),
	}).optional(),
});

export interface PistonRule extends z.output<typeof PistonRule> { }

export const PistonArtifact = z.object({
	url: z.string(),
	sha1: z.string(),
	size: z.number(),
	path: z.string().optional(),
});

export interface PistonArtifact extends z.output<typeof PistonArtifact> { }

export const PistonLibrary = z.object({
	name: MavenArtifactRef,
	url: z.string().optional(),

	downloads: z.object({
		artifact: PistonArtifact.optional(),
		classifiers: z.record(string(), PistonArtifact).optional(),
	}).optional(),

	rules: z.array(PistonRule).optional(),
	natives: z.object({
		windows: string().optional(),
		osx: string().optional(),
		linux: string().optional(),
	}).optional(),
	extract: z.object({ exclude: z.array(string()) }).optional(),
});

export interface PistonLibrary extends z.output<typeof PistonLibrary> { }

export function parsePistonLibraryName(name: string) {
	const [groupID, artifactID, version, classifier] = name.split(":", 4);

	if (!groupID || !artifactID || !version)
		throw new Error(`Malformed library name: '${name}'`);

	return { groupID, artifactID, version, classifier };
}

export const PistonAssetIndexRef = z.object({
	id: z.string(),
	sha1: z.string(),
	size: z.number(),
	totalSize: z.number(),
	url: z.string(),
});

export interface PistonAssetIndexRef extends z.output<typeof PistonAssetIndexRef> { }


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
	libraries: z.array(PistonLibrary),
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
	complianceLevel: z.number().optional(),
});

export interface PistonVersion extends z.output<typeof PistonVersion> { }

