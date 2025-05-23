export function throwError(error: Error | string): never {
	if (typeof error === "string")
		throw new Error(error);
	else
		throw error;
}
