
export interface HTTPClient {
	/**
	 * Fetch text over HTTP and store for later use or reuse stored data if it is up-to-date.
	 * @param key Cache key
	 * @param url URL to GET
	 * @param strategy Caching strategy - defaults to ConditionalRequest
	 * @returns metadata and body
	 */
	getCached(key: string, url: string | URL, strategy?: HTTPCacheStrategy): Promise<Response>;

	/**
	 * Fetch metadata over HTTP and store for later use or reuse stored data if it is up-to-date. Simply uses Eternal cache strategy.
	 * @param key Cache key
	 * @param url URL to HEAD
	 * @param contentType Content-Type header
	 * @param strategy Caching strategy - defaults to ConditionalRequest
	 * @returns metadata
	 */
	headCached(key: string, url: string | URL): Promise<Metadata>;

	/**
	 * Extract text out of a remote ZIP file. Simply uses Eternal cache strategy.
	 * @param key Cache key
	 * @param url URL to extract from using
	 * @param entry filename
	 */
	unzipCached(key: string, url: string | URL, entry: string): Promise<string>;
}

export interface Metadata {
	lastModified?: Date;
	eTag?: string;
}

export interface Response extends Metadata {
	body: string;
	json(): unknown;
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


export interface ConditionalRequestStrategy {
	mode: HTTPCacheMode.ConditionalRequest;
}

export interface CompareLocalDigestStrategy {
	mode: HTTPCacheMode.CompareLocalDigest;
	algorithm: DigestAlgorithm;
	expected: string | Buffer;
}

export interface EternalStrategy {
	mode: HTTPCacheMode.Eternal;
}

export type HTTPCacheStrategy = ConditionalRequestStrategy | CompareLocalDigestStrategy | EternalStrategy;

export type DigestAlgorithm = "sha-1" | "sha-256" | "sha-384" | "sha-512";
