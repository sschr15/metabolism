import { Buffer } from 'node:buffer';

export function compareStrings(a: string, b: string) {
	if (a < b)
		return -1;
	else if (a > b)
		return 1;
	else
		return 0;
}

export async function digest(algorithm: string, data: string) {
	return Buffer.from(await crypto.subtle.digest(algorithm, Buffer.from(data)));
}
