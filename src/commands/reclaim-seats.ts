import { parseArgs } from "node:util"
import type { CodeRabbitClient } from "../client.ts"
import { lastNDays } from "../lib/dates.ts"

export interface ReclaimPlan {
	inactive: string[]
	active: number
}

/**
 * Finds users who hold a CodeRabbit seat but have not opened a pull request in
 * the last `days` days, so their seats can be given to someone who needs one.
 */
export async function planReclaim(client: CodeRabbitClient, days: number): Promise<ReclaimPlan> {
	const { start, end } = lastNDays(days)
	const page = await client.usersPage({ seat_filter: "assigned" })

	const inactive: string[] = []
	for (const user of page.users) {
		const prs = await Array.fromAsync(
			client.reviewMetrics({
				start_date: start,
				end_date: end,
				status: "merged",
				user_ids: [user.user_id],
			}),
		)
		if (prs.length === 0) inactive.push(user.user_id)
	}

	return { inactive, active: page.users.length - inactive.length }
}

export async function run(client: CodeRabbitClient, argv: string[]): Promise<void> {
	const { values } = parseArgs({
		args: argv,
		options: {
			days: { type: "string", default: "30" },
			"dry-run": { type: "boolean", default: false },
		},
	})
	const days = Number(values.days)

	const plan = await planReclaim(client, days)
	console.log(`${plan.active} active seat holders, ${plan.inactive.length} inactive for ${days}+ days`)

	if (plan.inactive.length === 0) return
	if (values["dry-run"]) {
		console.log("Would unassign:", plan.inactive.join(", "))
		return
	}

	const result = await client.updateSeats("unassign", plan.inactive)
	console.log(`Unassigned ${result.succeeded.length} seats (${result.status})`)
	for (const failure of result.failed) {
		console.error(`  ${failure.user_id}: ${failure.code}`)
	}
}
