import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { summarizeByRepository } from "../src/commands/review-metrics.ts"
import { lastNDays } from "../src/lib/dates.ts"
import type { ReviewMetric, Severity } from "../src/types.ts"

function metric(repo: string, posted: number, accepted: number, hoursToMerge: number): ReviewMetric {
	const created = new Date("2026-09-01T00:00:00Z")
	const zero = { posted: 0, accepted: 0 }
	const severity = Object.fromEntries(
		(["critical", "major", "minor", "trivial", "info"] as Severity[]).map(s => [s, zero]),
	) as Record<Severity, typeof zero>
	return {
		pr_url: `https://github.com/acme/${repo}/pull/1`,
		organization_id: "1",
		organization_name: "acme",
		repository_id: repo,
		repository_name: repo,
		author_id: "42",
		author_username: "octocat",
		created_at: created.toISOString(),
		first_human_review_at: null,
		last_commit_at: null,
		merged_at: new Date(created.getTime() + hoursToMerge * 3_600_000).toISOString(),
		review_iterations: 2,
		coderabbit_comments: {
			total: { posted, accepted },
			severity: { ...severity, major: { posted: 1, accepted: 1 } },
			category: {},
		},
	}
}

describe("summarizeByRepository", () => {
	it("aggregates comments, acceptance and time to merge per repository", () => {
		const rows = summarizeByRepository([
			metric("api", 10, 6, 4),
			metric("api", 10, 4, 8),
			metric("web", 5, 5, 1),
		])

		assert.deepEqual(rows[0], {
			repository: "api",
			pull_requests: 2,
			comments_posted: 20,
			comments_accepted: 10,
			acceptance_rate: "50.0%",
			critical_and_major: 2,
			avg_review_iterations: 2,
			median_hours_to_merge: 6,
		})
		assert.equal(rows[1]?.repository, "web")
	})

	it("reports a dash instead of NaN when nothing was posted", () => {
		const [row] = summarizeByRepository([metric("docs", 0, 0, 1)])
		assert.equal(row?.acceptance_rate, "—")
	})
})

describe("lastNDays", () => {
	it("returns an inclusive window", () => {
		assert.deepEqual(lastNDays(7, new Date("2026-09-25T12:00:00Z")), {
			start: "2026-09-19",
			end: "2026-09-25",
		})
	})
})
