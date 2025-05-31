import { z } from "zod/v4";

export const PistonVersionRef = z.object({
	id: z.string(),
	type: z.string(),
	url: z.url(),
	sha1: z.string(),
});

export interface PistonVersionRef extends z.output<typeof PistonVersionRef> { }

export const PistonVersionManifest = z.object({ versions: z.array(PistonVersionRef) });

export interface PistonVersionManifest extends z.output<typeof PistonVersionManifest> { }
