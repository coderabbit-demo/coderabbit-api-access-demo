import { parseArgs } from "node:util"
import type { CodeRabbitClient } from "../client.ts"
import { toCsv, writeOutput } from "../lib/output.ts"

/**
 * Exports the review learnings CodeRabbit has captured from your team's
 * feedback, so they can be audited, backed up or curated outside the UI.
 */
export async function run(client: CodeRabbitClient, argv: string[]): Promise<void> {
	const { values } = parseArgs({
		args: argv,
		options: {
			"never-used": { type: "boolean", default: false },
			search: { type: "string" },
			out: { type: "string" },
		},
	})

	const learnings = await Array.fromAsync(
		client.learnings({
			search: values.search,
			stat_filter: values["never-used"] ? "never_used" : undefined,
		}),
	)

	const rows = learnings.map(l => ({
		id: l.id,
		repository: l.repository_name,
		file: l.file ?? "",
		learning: l.learning,
		author: l.author_username,
		usage_count: l.usage_count,
		last_used_at: l.last_used_at ?? "",
		source_url: l.source_url ?? "",
	}))

	console.error(`Fetched ${rows.length} learnings`)
	await writeOutput(values.out, toCsv(rows))
}
