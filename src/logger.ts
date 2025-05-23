import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { pino, type Bindings, type ChildLoggerOptions } from "pino";

const getCallSites = await import("node:util").then(module => module.getCallSites);

const mainLogger = pino({
	level: process.env.PINO_LOG_LEVEL || "info"
});

function getScriptName(): string {
	if (getCallSites) {
		const { scriptName } = getCallSites()[2]!;

		if (globalThis["Deno"])
			return scriptName;
		else
			return fileURLToPath(scriptName);
	}

	let capturedStack: NodeJS.CallSite[];

	const prePatch = Error.prepareStackTrace;

	Error.prepareStackTrace = (_, stack) => (capturedStack = stack);
	(new Error).stack;
	Error.prepareStackTrace = prePatch;

	return capturedStack![2]!.getFileName()!;
}

export function moduleLogger<ChildCustomLevels extends string = never>(bindings?: Bindings, options?: ChildLoggerOptions<ChildCustomLevels>) {
	const scriptName = getScriptName();
	let module = relative("src", scriptName);

	if (module.endsWith(".ts"))
		module = module.substring(0, module.lastIndexOf("."));

	if (module.endsWith("/index"))
		module = module.substring(0, module.lastIndexOf("/"));

	return mainLogger.child({ ...bindings, module });
}
