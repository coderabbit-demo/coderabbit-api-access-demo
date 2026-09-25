import { CodeRabbitClient } from "../src/client.ts"

export interface RecordedCall {
	url: URL
	method: string
	headers: Record<string, string>
	body: unknown
}

/** A CodeRabbitClient wired to a scripted fetch, so tests never hit the network. */
export function fakeClient(responses: Array<() => Response>) {
	const calls: RecordedCall[] = []
	const queue = [...responses]
	const fetch = (async (input: string | URL, init: RequestInit = {}) => {
		calls.push({
			url: new URL(String(input)),
			method: init.method ?? "GET",
			headers: init.headers as Record<string, string>,
			body: init.body ? JSON.parse(String(init.body)) : undefined,
		})
		const next = queue.shift()
		if (!next) throw new Error(`Unexpected request: ${String(input)}`)
		return next()
	}) as typeof globalThis.fetch

	const client = new CodeRabbitClient({
		apiKey: "cr-test-key",
		baseUrl: "https://api.example.test",
		fetch,
		sleep: async () => {},
	})
	return { client, calls }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
	return () =>
		new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json", ...headers },
		})
}
