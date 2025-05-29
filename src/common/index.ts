export function throwError(error: Error | string): never {
	if (typeof error === "string")
		throw new Error(error);
	else
		throw error;
}

// we need to do this for inheritence without interference
type InferKey<T extends Map<any, any>> = T extends Map<infer K, infer _> ? K : never;
type InferValue<T extends Map<any, any>> = T extends Map<infer _, infer V> ? V : never;

/** Equivilent to map[key] ??= defaultValue */
export function setIfAbsent<TMap extends Map<any, any>>(map: TMap, key: InferKey<TMap>, defaultValue: InferValue<TMap>): InferValue<TMap> {
	let result = map.get(key);

	if (result === undefined) {
		result = defaultValue;
		map.set(key, defaultValue);
	}

	return result;
}
