export function throwError(error: Error | string): never {
	if (typeof error === "string")
		throw new Error(error);
	else
		throw error;
}

export function isEmpty(obj: {} | undefined | null) {
	for (const key in obj)
		if (typeof obj !== "object" || Object.hasOwn(obj, key))
			return false;

	return true;
}

export function mapObjectEntries<I, O>(obj: { [s: string]: I; }, callback: (value: [string, I]) => [string, O]) {
	return Object.fromEntries(Object.entries(obj)
		.map(callback));
}

export function mapObjectValues<I, O>(obj: { [s: string]: I; }, callback: (value: I) => O) {
	return mapObjectEntries(obj, ([key, value]) => [key, callback(value)]);
}

export function pushTo<TKey, TItem>(map: Map<TKey, TItem[]>, key: TKey, value: TItem) {
	let array = map.get(key);

	if (array === undefined) {
		array = [];
		map.set(key, array);
	}

	array.push(value);
}
