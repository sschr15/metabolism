import type { PistonLibrary } from "#types/pistonVersion.ts";

export interface VersionFile {
	uid: string;
	name: string;
	formatVersion: 1;

	version: string;
	releaseTime: string;
	type?: string;
	order?: number; // legacy (to keep the JSON as close as possible for diffing)

	"+traits"?: string[];
	"+tweakers"?: string[];

	compatibleJavaMajors?: number[];
	compatibleJavaName?: string;
	"+jvmArgs"?: string[];
	mainClass?: string;
	minecraftArguments?: string;

	mainJar?: VersionFileLibrary;
	libraries?: VersionFileLibrary[];
	assetIndex?: {
		id: string;
		sha1: string;
		size: number;
		totalSize: number;
		url: string;
	};
}

export type VersionFileLibrary = PistonLibrary & {
	"MMC-hint"?: string,
	"MMC-absoluteUrl"?: string,
	"MMC-filename"?: string,
	"MMC-displayname"?: string,
};
