import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { pino, type Bindings, type ChildLoggerOptions } from "pino";

const mainLogger = pino({
	level: process.env.PINO_LOG_LEVEL || "info"
});

function getScriptName(): string {
	let capturedStack: NodeJS.CallSite[];

	const prepareStackTrace = Error.prepareStackTrace;

	Error.prepareStackTrace = (_, stack) => (capturedStack = stack);
	new Error().stack;
	Error.prepareStackTrace = prepareStackTrace;

	const fileName = capturedStack![2]!.getFileName()!;

	if (fileName.startsWith("file:"))
		return fileURLToPath(fileName);
	else
		return fileName;
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
