import type { HTTPCache } from "./httpCache.ts";
import type { VersionFile } from "./versionFile.ts";

export function defineGoal<D>(goal: Goal<D>): Goal<D> {
	goal["__defineGoal_marker"] = true;
	return goal;
}

export interface Goal<D> {
	/** ID (based on reverse domain name) for cache and output - e.g. net.minecraft for Minecraft */
	id: string;
	name: string;

	/**
	 * Prepare inputs.
	 * @param http Caching HTTP client - use this to request data
	 * @return inputs for {@link Goal.generate}
	 */
	prepare(http: HTTPCache): Promise<Promise<D>[]>;

	/**
	 * Generate output.
	 * @param data The input data
	 */
	generate(data: D): VersionFileOutput;
}

export type VersionFileOutput = Omit<VersionFile, "uid" | "name" | "formatVersion">;

