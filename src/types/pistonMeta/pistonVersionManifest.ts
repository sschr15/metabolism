import { z } from "zod/v4";

export const PistonVersionRef = z.object({
	id: z.string(),
	type: z.string(),
	url: z.url(),
	time: z.coerce.date(),
	releaseTime: z.coerce.date(),
	sha1: z.string().transform(input => Buffer.from(input, "hex")),
});

export interface PistonVersionRef extends z.output<typeof PistonVersionRef> { }

export const PistonVersionManifest = z.object({ versions: z.array(PistonVersionRef) });

export interface PistonVersionManifest extends z.output<typeof PistonVersionManifest> { }
