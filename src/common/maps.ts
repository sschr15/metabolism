// based on Java

export function computeIfAbsent<TKey, TValue extends {}>(map: Map<TKey, TValue>, key: TKey, generator: (key: TKey) => TValue): TValue {
	let result = map.get(key);

	if (result === undefined) {
		result = generator(key);
		map.set(key, result);
	}

	return result;
}

export function pushTo<TKey, TItem>(map: Map<TKey, TItem[]>, key: TKey, value: TItem): TItem[] {
	const result = computeIfAbsent(map, key, () => []);
	result.push(value);
	return result;
}

