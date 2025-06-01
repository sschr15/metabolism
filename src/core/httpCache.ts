export interface HTTPCache {
	/**
	 * Fetch metadata over HTTP and store for later use or reuse stored data if it is up-to-date.
	 * @param key Cache key
	 * @param url URL to HEAD
	 * @param contentType Content-Type header
	 * @param strategy Caching strategy - defaults to ConditionalRequest
	 * @returns body text
	 */
	fetchMetadata(key: string, url: string | URL, strategy?: HTTPCacheStrategy): Promise<Response<undefined>>;

	/**
	 * Fetch text over HTTP and store for later use or reuse stored data if it is up-to-date.
	 * @param key Cache key
	 * @param url URL to GET
	 * @param contentType Content-Type header
	 * @param strategy Caching strategy - defaults to ConditionalRequest
	 * @returns body text
	 */
	fetchText(key: string, url: string | URL, strategy?: HTTPCacheStrategy): Promise<Response<string>>;

	/**
	 * Fetch JSON over HTTP and store for later use or reuse stored data if it is up-to-date.
	 * Sets Content-Type to application/json and parses with JSON.parse.
	 * @param key Cache key
	 * @param url URL to GET
	 * @param strategy Caching strategy - defaults to ConditionalRequest
	 */
	fetchJSON(key: string, url: string | URL, strategy?: HTTPCacheStrategy): Promise<Response<unknown>>;
}

export interface Response<T> {
	lastModified?: Date;
	eTag?: string;
	body: T;
}

export const enum HTTPCacheMode {
	/**
	 * Send If-None-Match with the last known ETag if available - otherwise falls back to If-Modified-Since. If 304 Unmodified is returned, use the cached data.
	 * Use this if you haven't already received the expected checksum from another request.
	 * CompareLocalDigest should be preferred if possible to avoid unecessary requests.
	 */
	ConditionalRequest,
	/**
	 * Check the digest of the locally cached value, and only perform a HTTP request if it does not match.
	 */
	CompareLocalDigest,
	/**
	 * Cache forever - never invalidate.
	 */
	Eternal,
}

export type HTTPCacheStrategy = { mode: HTTPCacheMode.ConditionalRequest | HTTPCacheMode.Eternal; }
	| { mode: HTTPCacheMode.CompareLocalDigest; algorithm: DigestAlgorithm; expected: string | Buffer; };

export type DigestAlgorithm = "sha-1" | "sha-256" | "sha-384" | "sha-512";
