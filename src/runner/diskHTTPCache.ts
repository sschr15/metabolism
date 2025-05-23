import { moduleLogger } from "#logger.ts";
import { HTTPCacheMode, type HTTPCache, type HTTPCacheStrategy } from "#types/httpCache.ts";
import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from "node:fs/promises";
import path, { dirname } from "node:path";
import type { Logger } from "pino";
import z, { ZodError } from "zod/v4";
import { deleteFileIfExists, readFileIfExists } from "./util/fs.ts";
import { digest } from "./util/strings.ts";

const logger = moduleLogger();

const CacheEntry = z.object({
	sha1: z.string().transform(input => Buffer.from(input, "hex") as Buffer),
	lastModified: z.string().optional(),
});

interface CacheEntry extends z.output<typeof CacheEntry> { }
type ResolvedCacheEntry = [CacheEntry, string];

export interface DiskHTTPCacheOptions {
	userAgent: string;
	dir: string;
	assumeUpToDate: boolean;
	encoding: BufferEncoding;
}

export class DiskHTTPCache implements HTTPCache {
	private _options: DiskHTTPCacheOptions;
	private _lockedKeys: Set<string>;
	private _logger: Logger;

	constructor(options: DiskHTTPCacheOptions) {
		this._options = options;
		this._lockedKeys = new Set;
		this._logger = logger.child({ dir: options.dir });
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
		return path.join(this._options.dir, key); // TODO: not very safe
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

	private async _put(key: string, { sha1, ...entry }: CacheEntry, value: string): Promise<void> {
		const path = this._resolvePath(key);
		const entryPath = this._resolveEntryPath(path);

		// delete first to invalidate
		if (await mkdir(dirname(path), { recursive: true }) === undefined)
			await deleteFileIfExists(entryPath);

		await writeFile(path, value, this._options.encoding);
		await writeFile(entryPath, JSON.stringify({ sha1: sha1.toString("hex"), ...entry }));
	}

	private async _save(key: string, headers: Headers, body: string): Promise<void> {
		const newEntry: CacheEntry = {
			sha1: await digest("sha-1", body),
			lastModified: headers.get("Last-Modified") ?? undefined
		};

		await this._put(key, newEntry, body);
	}

	async fetch(key: string, url: string | URL, contentType: string, strategy: HTTPCacheStrategy = { mode: HTTPCacheMode.IfModifiedSince }): Promise<string> {
		this._lock(key);

		try {
			const resolvedEntry = await this._get(key);
			const entry = resolvedEntry?.[0] ?? null;
			const value = resolvedEntry?.[1] ?? null;

			if (this._options.assumeUpToDate && value !== null) {
				this._logger.debug(`Assuming cache entry '${key}' is up-to-date`);
				return value;
			}

			// TODO: this is really bad for perf for some reason
			if (strategy.mode === HTTPCacheMode.CompareLocalDigest && value !== null && entry !== null) {
				const digestResult = strategy.algorithm === "sha-1" ? entry.sha1 : await digest(strategy.algorithm, value);

				// "hex" argument is ignored if it's a string lol
				const debugInfo = { expected: strategy.expected.toString("hex") };
				const expected = typeof strategy.expected === "string" ? Buffer.from(strategy.expected, "hex") : strategy.expected;

				if (digestResult.equals(expected)) {
					this._logger.debug(debugInfo, `Cache entry '${key}' is up-to-date (matching digest)`);
					return value;
				} else
					this._logger.debug(debugInfo, `Cache entry '${key}' needs fetch (digest mismatch)'`);
			}

			this._logger.debug(`Sending a request to '${url}' for '${key}'`);

			const headers = new Headers({
				"User-Agent": this._options.userAgent,
				"Content-Type": contentType,
			});

			if (strategy.mode === HTTPCacheMode.IfModifiedSince && entry?.lastModified !== undefined)
				headers.set("If-Modified-Since", entry.lastModified);

			const response = await fetch(url, { headers, });

			if (strategy.mode === HTTPCacheMode.IfModifiedSince && response.status === 304 && value !== null) {
				this._logger.debug(`Cache entry '${key}' is up-to-date (304)`);
				return value;
			}

			if (!response.ok || response.status === 204)
				throw new Error(`Got ${response.status} for '${url}'`);

			this._logger.debug(`Cache entry '${key}' ${entry === null ? "created" : "updated"} from response`);

			const newValue = await response.text();
			this._save(key, response.headers, newValue);

			return newValue;
		} finally {
			this._unlock(key);
		}
	}

	async fetchJSON(key: string, url: string | URL, strategy?: HTTPCacheStrategy): Promise<unknown> {
		const result = await this.fetch(key, url, "application/json", strategy);
		return JSON.parse(result);
	}
}
