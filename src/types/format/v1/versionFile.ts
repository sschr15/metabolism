import { PistonArtifact, PistonLibrary, type PistonAssetIndexRef } from "#common/schema/pistonVersion.ts";

export interface VersionFile {
	uid: string;
	name: string;
	formatVersion: 1;

	version: string;
	releaseTime: string;
	type?: string;

	order?: number; // legacy (to keep the JSON as close as possible for diffing)
	volatile?: boolean;
	requires?: VersionFileDependency[];
	conflicts?: VersionFileDependency[];

	"+traits"?: VersionFileTrait[];
	"+tweakers"?: string[];

	compatibleJavaMajors?: number[];
	compatibleJavaName?: string;
	"+jvmArgs"?: string[];
	mainClass?: string;
	minecraftArguments?: string;

	mainJar?: VersionFileLibrary;
	libraries?: VersionFileLibrary[];
	assetIndex?: PistonAssetIndexRef;
}

export type VersionFileArtifact = Omit<PistonArtifact, "path">;

export type VersionFileLibrary = Omit<PistonLibrary, "name" | "downloads"> & {
	name: string;

	downloads?: {
		artifact?: VersionFileArtifact;
		classifiers?: Record<string, VersionFileArtifact>;
	};

	"MMC-hint"?: string,
	"MMC-absoluteUrl"?: string,
	"MMC-filename"?: string,
	"MMC-displayname"?: string,
};

export interface VersionFileDependency {
	uid: string;
	equals?: string;
	suggests?: string;
}

export enum VersionFileTrait {
	UseFirstThreadOnMacOS = "FirstThreadOnMacOS",
	LegacyLaunch = "legacyLaunch",
	LaunchWithoutApplet = "noapplet",
	UseOnlineFixes = "legacyServices",
	QuickPlaySingleplayerAware = "feature:is_quick_play_singleplayer",
	QuickPlayMultiplayerAware = "feature:is_quick_play_multiplayer",
	XRInitial = "XR:Initial", // Uses initial player safety implementation ??? (unused)
}
