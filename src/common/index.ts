export function throwError(error: Error | string): never {
	if (typeof error === "string")
		throw new Error(error);
	else
		throw error;
}

export function isEmpty(obj: {} | undefined | null): boolean {
	for (const key in obj)
		if (typeof obj !== "object" || Object.hasOwn(obj, key))
			return false;

	return true;
}
