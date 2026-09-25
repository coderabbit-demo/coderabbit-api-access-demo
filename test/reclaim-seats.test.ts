import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { planReclaim } from "../src/commands/reclaim-seats.ts"
import { fakeClient, json } from "./helpers.ts"

describe("planReclaim", () => {
	it("flags seat holders without merged PRs in the window", async () => {
		const { client, calls } = fakeClient([
			json({
				seats_purchased: 10,
				seats_assigned: 2,
				seat_assignment_mode: "manual",
				users: [
					{ user_id: "1001", seat_assigned: true, role: "member" },
					{ user_id: "1002", seat_assigned: true, role: "member" },
				],
				next_cursor: null,
			}),
			json({ data: [{ pr_url: "https://github.com/acme/api/pull/7" }], next_cursor: null }),
			json({ data: [], next_cursor: null }),
		])

		const plan = await planReclaim(client, 30)

		assert.deepEqual(plan, { inactive: ["1002"], active: 1 })
		assert.equal(calls[0]?.url.searchParams.get("seat_filter"), "assigned")
		assert.equal(calls[2]?.url.searchParams.get("user_ids"), "1002")
	})
})
