import { readFile, rm } from "node:fs/promises";

export async function readFileIfExists(path: string, encoding: BufferEncoding): Promise<string | null> {
	try {
		return await readFile(path, encoding);
	} catch (error) {
		if (!isENOENT(error))
			throw error;

		return null;
	}
}

export async function deleteFileIfExists(path: string): Promise<boolean> {
	try {
		await rm(path);

		return true;
	} catch (error) {
		if (!isENOENT(error))
			throw error;

		return false;
	}
}

function isENOENT(error: unknown) {
	if (!(error instanceof Error && "code" in error && typeof "code" === "string"))
		return false;

	if (error.code !== "ENOENT")
		return false;

	return true;
}
