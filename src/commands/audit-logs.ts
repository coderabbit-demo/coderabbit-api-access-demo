import { parseArgs } from "node:util"
import type { CodeRabbitClient } from "../client.ts"
import { lastNDays } from "../lib/dates.ts"
import { toCsv, writeOutput } from "../lib/output.ts"
import type { AuditLogEntry } from "../types.ts"

/**
 * Exports audit log events (configuration changes, seat and role changes,
 * API key activity) for a SIEM or compliance archive. Requires an admin key.
 */
export async function run(client: CodeRabbitClient, argv: string[]): Promise<void> {
	const { values } = parseArgs({
		args: argv,
		options: {
			days: { type: "string", default: "7" },
			action: { type: "string", multiple: true },
			out: { type: "string" },
		},
	})
	const { start, end } = lastNDays(Number(values.days))

	const entries: AuditLogEntry[] = []
	for (let page = 1; ; page++) {
		const result = await client.auditLogs({
			date_from: start,
			date_to: end,
			actions: values.action,
			page,
			page_size: 100,
		})
		entries.push(...result.data)
		if (!result.pagination.has_next_page) break
	}

	const rows = entries.map(e => ({
		created_at: e.createdAt,
		action: e.action,
		resource_type: e.resourceType,
		resource: e.resourceSummary,
		actor: e.actor.name,
		actor_is_bot: e.actor.isBot,
		ip_address: e.ipAddress ?? "",
	}))
	console.error(`Fetched ${rows.length} audit events`)
	await writeOutput(values.out, toCsv(rows))
}
