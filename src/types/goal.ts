import type { Provider } from "./provider.ts";
import type { VersionFile } from "./versionFile.ts";

export function defineGoal<TProvider extends Provider>(goal: Goal<TProvider>): Goal<TProvider> {
	return goal;
}

export interface Goal<TProvider extends Provider = Provider> {
	/** ID (based on reverse domain name) for output - e.g. net.minecraft for Minecraft */
	id: string;
	name: string;
	provider: TProvider;

	generate(data: TProvider extends Provider<infer TData> ? TData : never): VersionFileOutput[];
}

export type VersionFileOutput = Omit<VersionFile, "uid" | "name" | "formatVersion">;

