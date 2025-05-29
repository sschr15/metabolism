// we need to do this for inheritence without interference
type InferKey<T extends Map<any, any>> = T extends Map<infer K, infer _> ? K : never;
type InferValue<T extends Map<any, any>> = T extends Map<infer _, infer V> ? V : never;

export function setIfAbsent<TMap extends Map<any, any>>(map: TMap, key: InferKey<TMap>, defaultValue: InferValue<TMap>): InferValue<TMap> {
	let result = map.get(key);

	if (result === undefined) {
		result = defaultValue;
		map.set(key, defaultValue);
	}

	return result;
}

export function pushTo<TKey, TItem>(map: Map<TKey, TItem[]>, key: TKey, value: TItem): TItem[] {
	const result = setIfAbsent(map, key, []);
	result.push(value);
	return result;
}
