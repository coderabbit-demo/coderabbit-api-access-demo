#!/usr/bin/env node
import { CodeRabbitApiError, type CodeRabbitClient } from "./client.ts"
import { clientFromEnv } from "./config.ts"
import * as auditLogs from "./commands/audit-logs.ts"
import * as learnings from "./commands/learnings.ts"
import * as report from "./commands/report.ts"
import * as reviewMetrics from "./commands/review-metrics.ts"
import * as seats from "./commands/seats.ts"
import * as security from "./commands/security.ts"

type Command = (client: CodeRabbitClient, argv: string[]) => Promise<void>

const COMMANDS: Record<string, { run: Command; help: string }> = {
	"review-metrics": {
		run: reviewMetrics.run,
		help: "Per-repository review stats  [--days 30] [--format markdown|csv|json] [--out file]",
	},
	report: {
		run: report.run,
		help: 'On-demand activity report     [--days 7] [--template "Sprint Report"] [--prompt ...] [--repo name]...',
	},
	seats: { run: seats.run, help: "Seat utilisation summary" },
	learnings: {
		run: learnings.run,
		help: "Export learnings as CSV        [--never-used] [--search text] [--out file]",
	},
	security: {
		run: security.run,
		help: "Open security findings         [--repo id] [--sarif --out findings.sarif]",
	},
	"audit-logs": {
		run: auditLogs.run,
		help: "Export audit events as CSV     [--days 7] [--action name]... [--out file]",
	},
}

function usage(): string {
	const lines = Object.entries(COMMANDS).map(([name, c]) => `  ${name.padEnd(16)} ${c.help}`)
	return `Usage: crapi <command> [options]\n\nCommands:\n${lines.join("\n")}\n`
}

async function main(argv: string[]): Promise<number> {
	const [name, ...rest] = argv
	const command = name ? COMMANDS[name] : undefined
	if (!command) {
		process.stderr.write(usage())
		return name && name !== "--help" ? 1 : 0
	}

	try {
		await command.run(clientFromEnv(), rest)
		return 0
	} catch (error) {
		if (error instanceof CodeRabbitApiError && error.status === 403) {
			console.error("403 Forbidden: API access requires the Enterprise plan and a key with the right permissions.")
		}
		console.error(error instanceof Error ? error.message : error)
		return 1
	}
}

process.exitCode = await main(process.argv.slice(2))
