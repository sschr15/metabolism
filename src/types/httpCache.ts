export interface HTTPCache {
	/**
	 * Fetch data over HTTP and store for later use or reuse stored data if it is up-to-date.
	 * @param key Cache key
	 * @param url URL to GET
	 * @param contentType Content-Type header
	 * @param strategy Caching strategy - defaults to IfModifiedSince
	 * @returns body text
	 */
	fetch(key: string, url: string | URL, contentType: string, strategy?: HTTPCacheStrategy): Promise<string>;

	/**
	 * Fetch JSON over HTTP and store for later use or reuse stored data if it is up-to-date.
	 * Sets Content-Type to application/json and parses with JSON.parse.
	 * @param key Cache key
	 * @param url URL to GET
	 * @param strategy Caching strategy - defaults to IfModifiedSince
	 */
	fetchJSON(key: string, url: string | URL, strategy?: HTTPCacheStrategy): Promise<unknown>;
}

export const enum HTTPCacheMode {
	/**
	 * Send If-Modified-Since with the last known value of Last-Modified. If 304 Unmodified is returned, use the cached data.
	 * Use this if you haven't already received the expected checksum from another request.
	 * CompareLocalDigest should be preferred if possible to avoid unecessary requests.
	 */
	IfModifiedSince,
	/**
	 * Check the digest of the locally cached value, and only perform a HTTP request if it does not match.
	 */
	CompareLocalDigest,
	/**
	 * Request the full body every time.
	 */
	IgnoreCache,
}

export type HTTPCacheStrategy = { mode: HTTPCacheMode.IfModifiedSince | HTTPCacheMode.IgnoreCache; }
	| { mode: HTTPCacheMode.CompareLocalDigest; algorithm: DigestAlgorithm; expected: string | Buffer; };

export type DigestAlgorithm = "sha-1" | "sha-256" | "sha-384" | "sha-512";
