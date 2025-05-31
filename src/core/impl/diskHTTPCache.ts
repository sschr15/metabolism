import { HTTPCacheMode, type HTTPCache, type HTTPCacheStrategy, type Response } from "#core/httpCache.ts";
import { moduleLogger } from "#core/logger.ts";
import { retry } from "es-toolkit";
import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from "node:fs/promises";
import path, { dirname } from "node:path";
import pLimit from "p-limit";
import { type Logger } from "pino";
import z, { ZodError } from "zod/v4";
import { deleteFileIfExists, digest, readFileIfExists } from "./util.ts";

const logger = moduleLogger();
const limit = pLimit(16); // TODO: don't hardcode

const CacheEntry = z.object({
	sha1: z.string().transform(input => Buffer.from(input, "hex") as Buffer),
	lastModified: z.coerce.date().optional(),
	eTag: z.string().optional(),
});

interface CacheEntry extends z.output<typeof CacheEntry> { }
type ResolvedCacheEntry = [CacheEntry, string];

export interface DiskHTTPCacheOptions {
	userAgent: string;
	dir: string;
	assumeUpToDate?: boolean;
	encoding: BufferEncoding;
}

export class DiskHTTPCache implements HTTPCache {
	private _options: DiskHTTPCacheOptions;
	private _lockedKeys: Set<string>;
	private _logger: Logger;

	constructor(options: DiskHTTPCacheOptions) {
		this._options = {
			...options,
			dir: path.join(options.dir, path.sep)
		};

		this._lockedKeys = new Set;
		this._logger = logger.child({ dir: this._options.dir });
	}

	private _lock(key: string) {
		if (this._lockedKeys.has(key))
			throw new Error(`'${key}' is locked!`);

		this._lockedKeys.add(key);
	}

	private _unlock(key: string) {
		if (!this._lockedKeys.delete(key))
			throw new Error(`'${key}' could not be unlocked!`);
	}

	private _resolvePath(key: string) {
		const result = path.join(this._options.dir, key);

		if (result.includes("\0"))
			throw new Error("Key contains null bytes");

		if (!result.startsWith(this._options.dir))
			throw new Error(`Key '${key}' escapes cache base directory`);

		return result;
	}

	private _resolveEntryPath(value: string) {
		return value + ".entry.json";
	}

	private async _get(key: string): Promise<ResolvedCacheEntry | null> {
		const path = this._resolvePath(key);

		const entryData = await readFileIfExists(this._resolveEntryPath(path), this._options.encoding);

		if (entryData === null)
			return null;

		try {
			var cacheEntry = CacheEntry.parse(JSON.parse(entryData));
		} catch (error) {
			if (!(error instanceof SyntaxError || error instanceof ZodError))
				throw error;

			this._logger.warn(`Corrupt cache entry '${key}'`);
			return null;
		}

		const fileData = await readFileIfExists(path, "utf-8");

		if (fileData === null)
			return null;

		const buffer = await digest("sha-1", fileData);

		if (!buffer.equals(cacheEntry.sha1)) {
			this._logger.warn(`Corrupt cache value for '${key}'`);
			return null;
		}

		return [cacheEntry, fileData];
	}

	private async _put(key: string, entry: CacheEntry, value: string): Promise<void> {
		const path = this._resolvePath(key);
		const entryPath = this._resolveEntryPath(path);

		// delete first to invalidate
		if (await mkdir(dirname(path), { recursive: true }) === undefined)
			await deleteFileIfExists(entryPath);

		await writeFile(path, value, this._options.encoding);
		await writeFile(entryPath, JSON.stringify({ sha1: entry.sha1.toString("hex"), lastModified: entry.lastModified?.toISOString() }));
	}

	async fetch(key: string, url: string | URL, contentType: string, strategy: HTTPCacheStrategy = { mode: HTTPCacheMode.ConditionalRequest }): Promise<Response<string>> {
		this._lock(key);

		try {
			const resolvedEntry = await this._get(key);
			const entry = resolvedEntry?.[0] ?? null;
			const value = resolvedEntry?.[1] ?? null;

			if ((this._options.assumeUpToDate || strategy.mode === HTTPCacheMode.Eternal) && value !== null) {
				this._logger.debug(`Assuming cache entry '${key}' is up-to-date`);

				return {
					lastModified: entry?.lastModified ?? null,
					body: value,
				};
			}

			// TODO: this is really bad for perf for some reason
			if (strategy.mode === HTTPCacheMode.CompareLocalDigest && value !== null && entry !== null) {
				const digestResult = strategy.algorithm === "sha-1" ? entry.sha1 : await digest(strategy.algorithm, value);

				// "hex" argument is ignored if it's a string lol
				const debugInfo = { expected: strategy.expected.toString("hex") };
				const expected = typeof strategy.expected === "string" ? Buffer.from(strategy.expected, "hex") : strategy.expected;

				if (digestResult.equals(expected)) {
					this._logger.debug(debugInfo, `Cache entry '${key}' is up-to-date (matching digest)`);

					return {
						lastModified: entry.lastModified ?? null,
						body: value,
					};
				} else
					this._logger.debug(debugInfo, `Cache entry '${key}' needs fetch (digest mismatch)'`);
			}

			this._logger.debug(`Sending a request to '${url}' for '${key}'`);

			const headers = new Headers({
				"User-Agent": this._options.userAgent,
				"Content-Type": contentType,
			});

			if (strategy.mode === HTTPCacheMode.ConditionalRequest) {
				if (entry?.lastModified)
					headers.set("If-Modified-Since", entry.lastModified.toUTCString());

				if (entry?.eTag)
					headers.set("If-None-Match", entry.eTag);
			}

			const response = await retry(
				() => limit(() => fetch(url, { headers, })),
				{ delay: attempts => 500 * (2 ** attempts), retries: 5 }
			);

			if (strategy.mode === HTTPCacheMode.ConditionalRequest && response.status === 304 && value !== null) {
				this._logger.debug(`Cache entry '${key}' is up-to-date (304)`);

				return {
					lastModified: entry?.lastModified ?? null,
					body: value,
				};
			}

			if (!response.ok || response.status === 204)
				throw new Error(`Got ${response.status} for '${url}'`);

			const newValue = await response.text();

			const lastModifiedHeader = response.headers.get("Last-Modified");
			const newLastModified = lastModifiedHeader ? new Date(lastModifiedHeader) : undefined;

			if (newLastModified && isNaN(newLastModified.getTime()))
				throw new Error(`Invalid Last-Modified header: '${lastModifiedHeader}'`);

			const newETag = response.headers.get("ETag") ?? undefined;

			const newEntry: CacheEntry = {
				sha1: await digest("sha-1", newValue),
				lastModified: newLastModified,
				eTag: newETag,
			};

			await this._put(key, newEntry, newValue);

			this._logger.debug(`Cache entry '${key}' ${entry === null ? "created" : "updated"} from response`);

			return {
				lastModified: newLastModified ?? null,
				body: newValue,
			};
		} finally {
			this._unlock(key);
		}
	}

	async fetchJSON(key: string, url: string | URL, strategy?: HTTPCacheStrategy): Promise<Response<unknown>> {
		const result = await this.fetch(key, url, "application/json", strategy);
		return {
			...result,
			body: JSON.parse(result.body)
		};
	}

	async fetchContent(key: string, url: string | URL, contentType: string, strategy?: HTTPCacheStrategy): Promise<string> {
		const response = await this.fetch(key, url, contentType, strategy);

		return response.body;
	}

	async fetchJSONContent(key: string, url: string | URL, strategy?: HTTPCacheStrategy): Promise<unknown> {
		const response = await this.fetchJSON(key, url, strategy);

		return response.body;
	}
}
