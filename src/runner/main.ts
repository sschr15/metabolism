import { default as packageJSON } from "#project/package.json" with { type: "json" };
import { chalkStderr as format } from "chalk";
import { ALL_GOALS, runAll } from "./index.ts";
import { friendlyParseArgs } from "./util/args.ts";

const args = friendlyParseArgs({
	args: process.argv.slice(2),
	options: {
		userAgent: {
			type: "string",
			short: "u",
			description: "Override the User-Agent header",
			default: "PrismLauncherMeta/" + packageJSON.version,
		},
		cacheDir: {
			type: "string",
			short: "c",
			description: "Set the cache directory",
			default: "./run/cache",
		},
		outputDir: {
			type: "string",
			short: "o",
			description: "Set the output directory.",
			default: "./run/output",
		},
		assumeUpToDate: {
			type: "boolean",
			short: "s",
			description: "Assume cache is up-to-date",
			default: false,
		},
		help: {
			type: "boolean",
			short: "h",
			description: "Show this help message!",
			default: process.argv.length === 2,
		}
	},
	allowPositionals: true,
	positionalUsage: "<goal(s)>",
	extraText: format.bold.underline("Goals") + `\n${format.bold(["all", ...ALL_GOALS.map(goal => goal.id)].join(", "))}`
});

const goalSet = new Set(args.positionals);

if (goalSet.delete("all")) {
	var targetGoals = ALL_GOALS;
	goalSet.clear();
} else
	var targetGoals = ALL_GOALS.filter(goal => goalSet.delete(goal.id));

if (goalSet.size !== 0) {
	console.error(format.red.bold("invalid goals: ") + [...goalSet].join(","));
	process.exit(1);
}

await runAll(targetGoals, args.values);
