import { HTTPCacheMode, type HTTPCache, type HTTPCacheStrategy, type Response } from "#core/httpCache.ts";
import { moduleLogger } from "#core/logger.ts";
import { setIfAbsent } from "#util/general.ts";
import { delay, Mutex, pick, Semaphore } from "es-toolkit";
import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from "node:fs/promises";
import path, { dirname } from "node:path";
import { type Logger } from "pino";
import z, { ZodError } from "zod/v4";
import { deleteFileIfExists, digest, readFileIfExists } from "./util.ts";

const logger = moduleLogger();

const CacheEntryInfo = z.object({
	sha1: z.string().transform(input => Buffer.from(input, "hex") as Buffer).optional(),
	lastModified: z.coerce.date().optional(),
	eTag: z.string().optional(),
});

type CacheEntryInfo = z.infer<typeof CacheEntryInfo>;

interface CacheEntry {
	info: CacheEntryInfo;
	body?: string;
};

export interface DiskHTTPCacheOptions {
	userAgent: string;
	dir: string;
	assumeUpToDate?: boolean;
	encoding: BufferEncoding;
}

// TODO: despair
export class DiskHTTPCache implements HTTPCache {
	private options: DiskHTTPCacheOptions;
	private locks: Map<string, Mutex>;
	private logger: Logger;
	private static requestLimiter = new Semaphore(16);

	constructor(options: DiskHTTPCacheOptions) {
		this.options = {
			...options,
			dir: path.join(options.dir, path.sep)
		};

		this.locks = new Map;
		this.logger = logger.child({ dir: this.options.dir });
	}

	private async cachedFetch(
		key: string,
		url: string | URL,
		withBody: boolean,
		strategy: HTTPCacheStrategy = { mode: HTTPCacheMode.ConditionalRequest }
	): Promise<CacheEntry> {
		const path = this.resolvePath(key);

		return this.acquire(path, async () => {
			const resolvedEntry = await this.retrieve(path, withBody);

			if ((this.options.assumeUpToDate || strategy.mode === HTTPCacheMode.Eternal) && resolvedEntry) {
				this.logger.debug(`Assuming cache entry '${key}' is up-to-date`);
				return resolvedEntry;
			}

			// TODO: this is really bad for perf for some reason
			if (strategy.mode === HTTPCacheMode.CompareLocalDigest && resolvedEntry?.body && resolvedEntry.info.sha1) {
				const digestResult = strategy.algorithm === "sha-1"
					? resolvedEntry.info.sha1
					: await digest(strategy.algorithm, resolvedEntry.body);

				// "hex" argument is ignored if it's a string lol
				const debugInfo = { expected: strategy.expected.toString("hex") };
				const expected = typeof strategy.expected === "string"
					? Buffer.from(strategy.expected, "hex")
					: strategy.expected;

				if (digestResult.equals(expected)) {
					this.logger.debug(debugInfo, `Cache entry '${key}' is up-to-date (matching digest)`);
					return resolvedEntry;
				} else
					this.logger.debug(debugInfo, `Cache entry '${key}' needs fetch (digest mismatch)'`);
			}

			const headers = new Headers({ "User-Agent": this.options.userAgent });

			if (strategy.mode === HTTPCacheMode.ConditionalRequest && resolvedEntry) {
				if (resolvedEntry.info.eTag)
					headers.set("If-None-Match", resolvedEntry.info.eTag);
				else if (resolvedEntry.info.lastModified)
					headers.set("If-Modified-Since", resolvedEntry.info.lastModified.toUTCString());
			}

			const response = await this.fetch(key, url, { method: withBody ? "GET" : "HEAD", headers });

			if (strategy.mode === HTTPCacheMode.ConditionalRequest && response.status === 304 && resolvedEntry) {
				this.logger.debug(`Cache entry '${key}' is up-to-date (304)`);
				return resolvedEntry;
			}

			if (!response.ok || response.status === 204)
				throw new Error(`Got ${response.status} ('${response.statusText}') for '${url}'; did not retry as it is not a 5xx error`);

			const newEntry = await this.makeNewEntry(response, withBody);

			await this.store(path, newEntry);

			this.logger.debug(`Cache entry '${key}' ${resolvedEntry === null ? "created" : "updated"} from response`);

			return newEntry;
		});
	}

	private async fetch(key: string, url: URL | string, options?: RequestInit) {
		let waitPeriod = 1000;

		for (let retries = 0; ; ++retries) {
			try {
				this.logger.debug(`Sending a request to '${url}' for '${key}'`);

				const response = await this.limit(() => fetch(url, options));

				if (response.status >= 500 && response.status < 600)
					throw new Error(`Got ${response.status} ('${response.statusText}')`);

				return response;
			} catch (error) {
				if (retries > 5)
					throw new Error("Maximum retries exceeded", { cause: error });

				logger.warn(error, `Retrying '${url}' in ${waitPeriod / 1000}s due to error`);

				await delay(waitPeriod);
				waitPeriod *= 2;
			}
		}
	}

	private async makeNewEntry(response: globalThis.Response, withBody: boolean): Promise<CacheEntry> {
		const body = withBody ? await response.text() : undefined;
		const sha1 = body ? await digest("sha-1", body) : undefined;

		const lastModifiedRaw = response.headers.get("Last-Modified");
		const lastModified = lastModifiedRaw ? new Date(lastModifiedRaw) : undefined;

		if (lastModified && isNaN(lastModified.getTime()))
			throw new Error(`Invalid Last-Modified timestamp: '${lastModifiedRaw}'`);

		const eTag = response.headers.get("ETag") ?? undefined;

		return {
			info: {
				sha1,
				eTag,
				lastModified,
			},
			body,
		};
	}

	private makeBaseResponse(entry: CacheEntry) {
		return pick(entry.info, ["lastModified", "eTag"]);
	}

	async fetchText(key: string, url: string | URL, strategy?: HTTPCacheStrategy): Promise<Response<string>> {
		const entry = await this.cachedFetch(key, url, true, strategy);

		if (entry.body === undefined)
			throw new Error("BUG: Missing body!");

		return {
			...this.makeBaseResponse(entry),
			body: entry.body,
		};
	}

	async fetchJSON(key: string, url: string | URL, strategy?: HTTPCacheStrategy): Promise<Response<unknown>> {
		const response = await this.fetchText(key, url, strategy);

		return {
			...response,
			body: JSON.parse(response.body)
		};
	}

	async fetchMetadata(key: string, url: string | URL, strategy?: HTTPCacheStrategy): Promise<Response<undefined>> {
		const entry = await this.cachedFetch(key, url, false, strategy);

		return {
			...this.makeBaseResponse(entry),
			body: undefined,
		};
	}

	private async retrieve(path: string, requireBody: boolean): Promise<CacheEntry | null> {
		const entryData = await readFileIfExists(this.resolveInfoPath(path), this.options.encoding);

		if (entryData === null)
			return null;

		try {
			var info = CacheEntryInfo.parse(JSON.parse(entryData));
		} catch (error) {
			if (!(error instanceof SyntaxError || error instanceof ZodError))
				throw error;

			this.logger.warn(`Corrupt cache entry '${path}'`);
			return null;
		}

		if (info.sha1 === undefined) {
			if (requireBody)
				return null;
			else
				return { info };
		}

		const body = await readFileIfExists(path, "utf-8");

		if (body === null)
			return null;

		const bodyDigest = await digest("sha-1", body);

		if (!bodyDigest.equals(info.sha1)) {
			this.logger.warn(`Corrupt cache body '${path}'`);
			return null;
		}

		return { info, body: body };
	}

	private async store(path: string, entry: CacheEntry): Promise<void> {
		const infoPath = this.resolveInfoPath(path);

		// delete first to invalidate
		if (await mkdir(dirname(path), { recursive: true }) === undefined)
			await deleteFileIfExists(infoPath);

		if (entry.body)
			await writeFile(path, entry.body, this.options.encoding);
		else
			await deleteFileIfExists(path);

		await writeFile(infoPath, JSON.stringify({
			sha1: entry.info.sha1?.toString("hex"),
			eTag: entry.info.eTag,
			lastModified: entry.info.lastModified?.toISOString(),
		}));
	}

	private resolvePath(key: string): string {
		const result = path.join(this.options.dir, key);

		if (result.includes("\0"))
			throw new Error("Key contains null bytes");

		if (!result.startsWith(this.options.dir))
			throw new Error(`Key '${key}' escapes cache base directory`);

		return result;
	}

	private resolveInfoPath(value: string): string {
		return value + ".info.json";
	}

	private async acquire<T>(entryPath: string, callback: () => Promise<T>): Promise<T> {
		const mutex = setIfAbsent(this.locks, entryPath, new Mutex);
		await mutex.acquire();

		try {
			return await callback();
		} finally {
			mutex.release();

			if (!mutex.isLocked)
				this.locks.delete(entryPath);
		}
	}

	private async limit<T>(callback: () => Promise<T>): Promise<T> {
		await DiskHTTPCache.requestLimiter.acquire();

		try {
			return await callback();
		} finally {
			DiskHTTPCache.requestLimiter.release();
		}
	}
}
