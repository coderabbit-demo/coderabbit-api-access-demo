import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { run } from "../src/commands/audit-logs.ts"
import { fakeClient, json } from "./helpers.ts"

describe("audit-logs", () => {
	it("sends ISO datetimes and follows page numbers", async () => {
		const page = (n: number, hasNext: boolean) =>
			json({
				data: [
					{
						id: String(n),
						action: "api_key.created",
						resourceType: "api_key",
						resourceSummary: "ci key",
						actor: { name: "octocat", subtitle: null, isBot: false },
						metadata: {},
						ipAddress: null,
						createdAt: "2026-09-24T10:00:00.000Z",
					},
				],
				pagination: { page: n, page_size: 100, total_count: 2, total_pages: 2, has_next_page: hasNext },
			})
		const { client, calls } = fakeClient([page(1, true), page(2, false)])
		const out = join(await mkdtemp(join(tmpdir(), "crapi-")), "audit.csv")

		await run(client, ["--days", "7", "--out", out])

		const params = calls[0]!.url.searchParams
		assert.match(params.get("date_from")!, /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/)
		assert.ok(!Number.isNaN(Date.parse(params.get("date_to")!)))
		assert.deepEqual(calls.map(c => c.url.searchParams.get("page")), ["1", "2"])
		assert.equal((await readFile(out, "utf8")).split("\r\n").length, 3)
	})
})
