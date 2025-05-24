import { z } from "zod/v4";

export const PistonVersionManifest = z.object({
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
