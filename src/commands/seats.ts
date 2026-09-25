import type { CodeRabbitClient } from "../client.ts"

/** Prints seat utilisation for the organization the API key belongs to. */
export async function run(client: CodeRabbitClient, _argv: string[]): Promise<void> {
	const page = await client.usersPage({ limit: 1 })
	const available = Math.max(page.seats_purchased - page.seats_assigned, 0)

	console.log(`Seat assignment mode : ${page.seat_assignment_mode}`)
	console.log(`Seats purchased      : ${page.seats_purchased}`)
	console.log(`Seats assigned       : ${page.seats_assigned}`)
	console.log(`Seats available      : ${available}`)

	const admins: string[] = []
	for await (const user of client.users({ role_filter: "admin" })) admins.push(user.user_id)
	console.log(`Admins               : ${admins.length}`)
}
