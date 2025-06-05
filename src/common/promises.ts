import { Semaphore } from "es-toolkit";

export function concurrencyLimit(max: number) {
	const semaphore = new Semaphore(max);

	return async function limit<T>(callback: () => T): Promise<Awaited<T>> {
		await semaphore.acquire();

		try {
			return await callback();
		} finally {
			semaphore.release();
		}
	};
}
