import type { DiskCachedClient } from "#core/impl/http/diskCachedClient.ts";

export function defineProvider<D>(provider: Provider<D>): Provider<D> {
	return provider;
}

export interface Provider<TData = unknown> {
	id: string;

	provide(http: DiskCachedClient): Promise<TData>;
}
