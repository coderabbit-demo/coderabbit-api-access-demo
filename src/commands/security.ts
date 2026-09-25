import { parseArgs } from "node:util"
import type { CodeRabbitClient } from "../client.ts"
import { writeOutput } from "../lib/output.ts"

/**
 * Exports open CodeRabbit security findings. `--sarif` writes a SARIF 2.1.0
 * file that `github/codeql-action/upload-sarif` can push into GitHub code
 * scanning alongside your other scanners.
 */
export async function run(client: CodeRabbitClient, argv: string[]): Promise<void> {
	const { values } = parseArgs({
		args: argv,
		options: {
			repo: { type: "string" },
			sarif: { type: "boolean", default: false },
			out: { type: "string" },
		},
	})

	if (values.sarif) {
		const sarif = await client.securityFindingsSarif({ repo_id: values.repo })
		await writeOutput(values.out, JSON.stringify(sarif, null, 2))
		return
	}

	const bySeverity = new Map<string, number>()
	for await (const finding of client.securityFindings({ repo_id: values.repo, state: "open" })) {
		bySeverity.set(finding.severity, (bySeverity.get(finding.severity) ?? 0) + 1)
	}
	const lines = [...bySeverity.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([severity, count]) => `${severity.padEnd(10)} ${count}`)
	await writeOutput(values.out, ["Open findings by severity", ...lines].join("\n"))
}
