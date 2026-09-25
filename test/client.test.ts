import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { API_KEY_HEADER, CodeRabbitApiError } from "../src/client.ts"
import { fakeClient, json } from "./helpers.ts"

describe("CodeRabbitClient", () => {
	it("sends the API key header and comma-joins list filters", async () => {
		const { client, calls } = fakeClient([json({ data: [], next_cursor: null })])

		await Array.fromAsync(
			client.reviewMetrics({
				start_date: "2026-09-01",
				end_date: "2026-09-07",
				repository_ids: ["101", "202"],
			}),
		)

		const [call] = calls
		assert.equal(call?.headers[API_KEY_HEADER], "cr-test-key")
		assert.equal(call?.url.pathname, "/v1/metrics/reviews")
		assert.equal(call?.url.searchParams.get("repository_ids"), "101,202")
		assert.equal(call?.url.searchParams.has("cursor"), false)
	})

	it("follows next_cursor until it is null", async () => {
		const { client, calls } = fakeClient([
			json({ data: [{ id: "a" }], next_cursor: "c1" }),
			json({ data: [{ id: "b" }], next_cursor: "c2" }),
			json({ data: [{ id: "c" }], next_cursor: null }),
		])

		const items = await Array.fromAsync(client.learnings())

		assert.deepEqual(items.map(i => i.id), ["a", "b", "c"])
		assert.deepEqual(
			calls.map(c => c.url.searchParams.get("cursor")),
			[null, "c1", "c2"],
		)
	})

	it("retries 429 responses and then succeeds", async () => {
		const { client, calls } = fakeClient([
			json({ error: { code: "RATE_LIMITED" } }, 429, { "retry-after": "1" }),
			json({ data: [], next_cursor: null }),
		])

		await Array.fromAsync(client.learnings())

		assert.equal(calls.length, 2)
	})

	it("surfaces API errors with status and message", async () => {
		const { client } = fakeClient([
			json({ error: { code: "FORBIDDEN", message: "Enterprise plan required" } }, 403),
		])

		await assert.rejects(client.usersPage(), (error: unknown) => {
			assert.ok(error instanceof CodeRabbitApiError)
			assert.equal(error.status, 403)
			assert.match(error.message, /Enterprise plan required/)
			return true
		})
	})

	it("unwraps the tRPC envelope from report.generate", async () => {
		const { client, calls } = fakeClient([
			json({ result: { data: [{ group: "Developer Activity", report: "- Shipped X" }] } }),
		])

		const sections = await client.generateReport({ from: "2026-09-01", to: "2026-09-07" })

		assert.equal(calls[0]?.url.pathname, "/api/v1/report.generate")
		assert.deepEqual(calls[0]?.body, { from: "2026-09-01", to: "2026-09-07" })
		assert.equal(sections[0]?.report, "- Shipped X")
	})
})
