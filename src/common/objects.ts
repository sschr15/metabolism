export function mapObjectEntries<I, O>(obj: { [s: string]: I; }, callback: (value: [string, I]) => [string, O]) {
	return Object.fromEntries(Object.entries(obj)
		.map(callback));
}

export function mapObjectValues<I, O>(obj: { [s: string]: I; }, callback: (value: I) => O) {
	return mapObjectEntries(obj, ([key, value]) => [key, callback(value)]);
}

export function omitObjectKeys<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
	const copy = { ...obj };

	for (const key of keys)
		if (Object.hasOwn(copy, key))
			delete copy[key];

	return copy;
}
