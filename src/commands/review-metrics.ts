import { parseArgs } from "node:util"
import type { CodeRabbitClient } from "../client.ts"
import { lastNDays } from "../lib/dates.ts"
import { percent, toCsv, writeOutput } from "../lib/output.ts"
import type { ReviewMetric } from "../types.ts"

export interface RepoSummary {
	repository: string
	pull_requests: number
	comments_posted: number
	comments_accepted: number
	acceptance_rate: string
	critical_and_major: number
	avg_review_iterations: number
	median_hours_to_merge: number | null
}

export function summarizeByRepository(metrics: ReviewMetric[]): RepoSummary[] {
	const byRepo = Map.groupBy(metrics, m => m.repository_name)

	return [...byRepo.entries()]
		.map(([repository, prs]) => {
			const posted = sum(prs, pr => pr.coderabbit_comments.total.posted)
			const accepted = sum(prs, pr => pr.coderabbit_comments.total.accepted)
			const severity = (pr: ReviewMetric) =>
				pr.coderabbit_comments.severity.critical.posted +
				pr.coderabbit_comments.severity.major.posted
			const hoursToMerge = prs
				.filter(pr => pr.merged_at)
				.map(pr => (Date.parse(pr.merged_at!) - Date.parse(pr.created_at)) / 3_600_000)

			return {
				repository,
				pull_requests: prs.length,
				comments_posted: posted,
				comments_accepted: accepted,
				acceptance_rate: percent(accepted, posted),
				critical_and_major: sum(prs, severity),
				avg_review_iterations: round(sum(prs, pr => pr.review_iterations ?? 0) / prs.length),
				median_hours_to_merge: hoursToMerge.length ? round(median(hoursToMerge)) : null,
			}
		})
		.sort((a, b) => b.pull_requests - a.pull_requests)
}

export function toMarkdown(rows: RepoSummary[], window: { start: string; end: string }): string {
	const header =
		"| Repository | PRs | CodeRabbit comments | Accepted | Acceptance | Critical + major | Avg iterations | Median hours to merge |\n" +
		"| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
	const body = rows.map(
		r =>
			`| ${r.repository} | ${r.pull_requests} | ${r.comments_posted} | ${r.comments_accepted} | ${r.acceptance_rate} | ${r.critical_and_major} | ${r.avg_review_iterations} | ${r.median_hours_to_merge ?? "—"} |`,
	)
	return [`## CodeRabbit review metrics (${window.start} → ${window.end})`, "", header, ...body].join("\n")
}

export async function run(client: CodeRabbitClient, argv: string[]): Promise<void> {
	const { values } = parseArgs({
		args: argv,
		options: {
			days: { type: "string", default: "30" },
			format: { type: "string", default: "markdown" },
			out: { type: "string" },
		},
	})
	const window = lastNDays(Number(values.days))

	const metrics = await Array.fromAsync(
		client.reviewMetrics({ start_date: window.start, end_date: window.end, status: "merged" }),
	)
	const rows = summarizeByRepository(metrics)

	const output =
		values.format === "csv"
			? toCsv(rows as unknown as Record<string, unknown>[])
			: values.format === "json"
				? JSON.stringify(rows, null, 2)
				: toMarkdown(rows, window)
	await writeOutput(values.out, output)
}

function sum<T>(items: T[], pick: (item: T) => number): number {
	return items.reduce((total, item) => total + pick(item), 0)
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b)
	const mid = Math.floor(sorted.length / 2)
	return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function round(value: number): number {
	return Math.round(value * 10) / 10
}
