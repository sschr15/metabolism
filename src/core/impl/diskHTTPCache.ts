import { HTTPCacheMode, type HTTPCache, type HTTPCacheStrategy, type Response } from "#core/httpCache.ts";
import { moduleLogger } from "#core/logger.ts";
import { setIfAbsent } from "#util/general.ts";
import { delay, Mutex, Semaphore } from "es-toolkit";
import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from "node:fs/promises";
import path, { dirname } from "node:path";
import { type Logger } from "pino";
import z, { ZodError } from "zod/v4";
import { deleteFileIfExists, digest, readFileIfExists } from "./util.ts";

const logger = moduleLogger();
const requestLimiter = new Semaphore(16); // TODO: don't hardcode

async function limit<T>(callback: () => Promise<T>) {
	await requestLimiter.acquire();

	try {
		return await callback();
	} finally {
		requestLimiter.release();
	}
}

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
	private _usedEntries: Map<string, Mutex>;
	private _logger: Logger;

	constructor(options: DiskHTTPCacheOptions) {
		this._options = {
			...options,
			dir: path.join(options.dir, path.sep)
		};

		this._usedEntries = new Map;
		this._logger = logger.child({ dir: this._options.dir });
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

	private async _get(path: string): Promise<ResolvedCacheEntry | null> {
		const entryData = await readFileIfExists(this._resolveEntryPath(path), this._options.encoding);

		if (entryData === null)
			return null;

		try {
			var cacheEntry = CacheEntry.parse(JSON.parse(entryData));
		} catch (error) {
			if (!(error instanceof SyntaxError || error instanceof ZodError))
				throw error;

			this._logger.warn(`Corrupt cache entry '${path}'`);
			return null;
		}

		const fileData = await readFileIfExists(path, "utf-8");

		if (fileData === null)
			return null;

		const buffer = await digest("sha-1", fileData);

		if (!buffer.equals(cacheEntry.sha1)) {
			this._logger.warn(`Corrupt cache value for '${path}'`);
			return null;
		}

		return [cacheEntry, fileData];
	}

	private async _put(path: string, entry: CacheEntry, value: string): Promise<void> {
		const entryPath = this._resolveEntryPath(path);

		// delete first to invalidate
		if (await mkdir(dirname(path), { recursive: true }) === undefined)
			await deleteFileIfExists(entryPath);

		await writeFile(path, value, this._options.encoding);
		await writeFile(entryPath, JSON.stringify({ sha1: entry.sha1.toString("hex"), lastModified: entry.lastModified?.toISOString() }));
	}

	private async _acquire<T>(entryPath: string, callback: () => Promise<T>) {
		// intetional memory leak - we are tracking all of the entries which have been hit/created
		const mutex = setIfAbsent(this._usedEntries, entryPath, new Mutex);
		await mutex.acquire();

		try {
			return await callback();
		} finally {
			mutex.release();
		}
	}

	private async _save(entryPath: string, response: globalThis.Response): Promise<ResolvedCacheEntry> {
		const lastModifiedHeader = response.headers.get("Last-Modified");
		const entryLastModified = lastModifiedHeader ? new Date(lastModifiedHeader) : undefined;

		if (entryLastModified && isNaN(entryLastModified.getTime()))
			throw new Error(`Invalid Last-Modified header: '${lastModifiedHeader}'`);

		const entryETag = response.headers.get("ETag") ?? undefined;

		const entryValue = await response.text();

		const entry: CacheEntry = {
			sha1: await digest("sha-1", entryValue),
			lastModified: entryLastModified,
			eTag: entryETag,
		};

		this._put(entryPath, entry, entryValue);

		return [entry, entryValue];
	}

	private _makeResponse(resolvedEntry: ResolvedCacheEntry): Response<string> {
		const [entry, value] = resolvedEntry;

		return {
			lastModified: entry.lastModified ?? null,
			body: value,
		};
	}

	async fetch(
		key: string,
		url: string | URL,
		contentType?: string,
		strategy: HTTPCacheStrategy = { mode: HTTPCacheMode.ConditionalRequest }
	): Promise<Response<string>> {
		const path = this._resolvePath(key);

		return this._acquire(path, async () => {
			const resolvedEntry = await this._get(path);

			if ((this._options.assumeUpToDate || strategy.mode === HTTPCacheMode.Eternal) && resolvedEntry) {
				this._logger.debug(`Assuming cache entry '${key}' is up-to-date`);
				return this._makeResponse(resolvedEntry);
			}

			// TODO: this is really bad for perf for some reason
			if (strategy.mode === HTTPCacheMode.CompareLocalDigest && resolvedEntry) {
				const [entry, value] = resolvedEntry;

				const digestResult = strategy.algorithm === "sha-1"
					? entry.sha1
					: await digest(strategy.algorithm, value);

				// "hex" argument is ignored if it's a string lol
				const debugInfo = { expected: strategy.expected.toString("hex") };
				const expected = typeof strategy.expected === "string"
					? Buffer.from(strategy.expected, "hex")
					: strategy.expected;

				if (digestResult.equals(expected)) {
					this._logger.debug(debugInfo, `Cache entry '${key}' is up-to-date (matching digest)`);
					return this._makeResponse(resolvedEntry);
				} else
					this._logger.debug(debugInfo, `Cache entry '${key}' needs fetch (digest mismatch)'`);
			}

			const headers = new Headers({ "User-Agent": this._options.userAgent });

			if (contentType)
				headers.set("Content-Type", contentType);

			if (strategy.mode === HTTPCacheMode.ConditionalRequest && resolvedEntry) {
				const [entry] = resolvedEntry;

				if (entry.eTag)
					headers.set("If-None-Match", entry.eTag);
				else if (entry.lastModified)
					headers.set("If-Modified-Since", entry.lastModified.toUTCString());
			}

			let waitPeriod = 500;
			let response: globalThis.Response;

			for (let retries = 0; ; ++retries) {
				try {
					this._logger.debug(`Sending a request to '${url}' for '${key}'`);

					response = await limit(() => fetch(url, { headers }));

					if (response.status >= 500 && response.status < 600)
						throw new Error(`Got ${response.status} ('${response.statusText}')`);

					break;
				} catch (error) {
					if (retries > 5)
						throw new Error("Maximum retries exceeded", { cause: error });

					logger.warn(error, `Retrying '${url}' in ${waitPeriod / 1000}s due to error`);

					await delay(waitPeriod);
					waitPeriod *= 2;
				}
			}

			if (strategy.mode === HTTPCacheMode.ConditionalRequest && response.status === 304 && resolvedEntry) {
				this._logger.debug(`Cache entry '${key}' is up-to-date (304)`);
				return this._makeResponse(resolvedEntry);
			}

			if (!response.ok || response.status === 204)
				throw new Error(`Got ${response.status} ('${response.statusText}') for '${url}'; did not retry as it is not a 5xx error`);

			const newEntry = await this._save(path, response);

			this._logger.debug(`Cache entry '${key}' ${resolvedEntry === null ? "created" : "updated"} from response`);

			return this._makeResponse(newEntry);
		});
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
