import { type HTTPCache } from "#types/httpCache.ts";
import { Buffer } from 'node:buffer';
import { z } from "zod/v4";

const PistonVersionManifest = z.object({
	latest: z.object({
		release: z.string(),
		snapshot: z.string(),
	}),
	versions: z.array(z.object({
		id: z.string(),
		type: z.enum(["release", "snapshot", "old_beta", "old_alpha"]),
		url: z.url(),
		time: z.coerce.date(),
		releaseTime: z.coerce.date(),
		sha1: z.string().transform(input => Buffer.from(input, "hex")),
	})),
});

export interface PistonVersionManifest extends z.output<typeof PistonVersionManifest> { }

export async function fetchPistonVersionManifest(client: HTTPCache): Promise<PistonVersionManifest> {
	return PistonVersionManifest.parse(await client.fetchJSON("versions.json", "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"));
}
