import { parseArgs } from "node:util"
import type { CodeRabbitClient } from "../client.ts"
import { lastNDays } from "../lib/dates.ts"
import { writeOutput } from "../lib/output.ts"
import type { ReportRequest } from "../types.ts"

const TEMPLATES = new Set<ReportRequest["promptTemplate"]>([
	"Daily Standup Report",
	"Sprint Report",
	"Release Notes",
	"Organization Stats",
	"Custom",
])

/**
 * Generates an on-demand developer activity report, e.g. for a weekly
 * engineering update posted to Slack or a wiki.
 */
export async function run(client: CodeRabbitClient, argv: string[]): Promise<void> {
	const { values } = parseArgs({
		args: argv,
		options: {
			days: { type: "string", default: "7" },
			template: { type: "string", default: "Sprint Report" },
			prompt: { type: "string" },
			"group-by-repo": { type: "boolean", default: false },
			repo: { type: "string", multiple: true },
			out: { type: "string" },
		},
	})
	const template = values.template as ReportRequest["promptTemplate"]
	if (!TEMPLATES.has(template)) {
		throw new Error(`--template must be one of: ${[...TEMPLATES].join(", ")}`)
	}
	const { start, end } = lastNDays(Number(values.days))

	const sections = await client.generateReport({
		from: start,
		to: end,
		promptTemplate: values.prompt ? "Custom" : template,
		prompt: values.prompt,
		groupBy: values["group-by-repo"] ? "REPOSITORY" : undefined,
		parameters: values.repo?.length
			? [{ parameter: "REPOSITORY", operator: "IN", values: values.repo }]
			: undefined,
	})

	const markdown = sections
		.map(section => `## ${section.group}\n\n${section.report.trim()}`)
		.join("\n\n")
	await writeOutput(values.out, `# Developer activity ${start} → ${end}\n\n${markdown}`)
}
