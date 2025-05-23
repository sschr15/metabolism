import { chalkStderr as format } from "chalk";
import { basename, relative } from "node:path";
import { parseArgs, type ParseArgsConfig, type ParseArgsOptionDescriptor } from "node:util";

type FriendlyParseArgConfig = ParseArgsConfig
	& {
		options: Record<string, ParseArgsOptionDescriptor & { description?: string; }>;
		extraText?: string;
		positionalUsage?: string;
	};

const UNKNOWN_OPTION = /^Unknown option '(--?.*)'\./;

export function friendlyParseArgs<T extends FriendlyParseArgConfig>(config: T) {
	try {
		const result = parseArgs(config);

		if ("help" in result.values && result.values.help === true) {
			showUsage(config);
			process.exit(0);
		}

		return result;
	} catch (error) {
		if (!(error instanceof TypeError))
			throw error;

		if (!("code" in error && error.code === "ERR_PARSE_ARGS_UNKNOWN_OPTION"))
			throw error;

		const groups = error.message.match(UNKNOWN_OPTION);

		if (groups === null)
			throw error;

		console.error(format.redBright.bold("invalid option: ") + groups[1]);
		console.error(format.bold.underline("Run with --help to see usage!"));
		process.exit(1);
	}
}

export function showUsage(config: FriendlyParseArgConfig) {
	console.error(format.bold.underline("Usage"));

	const positionalUsage = config.positionalUsage !== undefined
		? config.positionalUsage + " "
		: "";

	console.error(basename(process.argv0) + " " + relative(".", process.argv[1] || "unknown") + ` ${positionalUsage}[options]`);

	if (config.extraText !== undefined) {
		console.error();
		console.error(config.extraText);
	}

	console.error();
	console.error(format.bold.underline("Options"));

	const leftColumn: string[] = [];
	const rightColumn: string[] = [];

	for (const [key, value] of Object.entries(config.options)) {
		let leftColumnValue = "";

		if (value.short !== undefined)
			leftColumnValue += "-" + value.short + ", ";

		leftColumnValue += "--" + key;

		if (value.type !== "boolean")
			leftColumnValue += " <value>";

		leftColumn.push(leftColumnValue);

		let rightColumnValue = value.description || "No description.";

		if (value.default !== undefined && value.type !== "boolean")
			rightColumnValue += " (" + value.default.toString() + ")";

		rightColumn.push(rightColumnValue);
	}

	const maxLength = leftColumn.reduce((previous, current) => current.length > previous ? current.length : previous, 0);

	for (const [i, leftColumnValue] of leftColumn.entries()) {
		const leftColumnFormatted = format.bold(leftColumnValue.padEnd(maxLength, " "));
		const rightColumnValue = rightColumn[i] ?? "";

		console.error(leftColumnFormatted + "  " + rightColumnValue);
	}
};
