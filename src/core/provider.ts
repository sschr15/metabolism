import type { DiskHTTPCache } from "#core/impl/diskHTTPCache.ts";

export function defineProvider<D>(provider: Provider<D>): Provider<D> {
	return provider;
}

export interface Provider<TData = unknown> {
	id: string;

	provide(http: DiskHTTPCache): Promise<TData>;
}
