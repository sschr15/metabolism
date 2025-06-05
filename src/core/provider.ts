import type { HTTPClient } from "./httpClient.ts";

export function defineProvider<D>(provider: Provider<D>): Provider<D> {
	return provider;
}

export interface Provider<TData = unknown> {
	id: string;

	provide(http: HTTPClient): Promise<TData>;
}
