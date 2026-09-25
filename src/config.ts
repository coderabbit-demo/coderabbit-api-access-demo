import { CodeRabbitClient, DEFAULT_BASE_URL } from "./client.ts"

export function clientFromEnv(env: NodeJS.ProcessEnv = process.env): CodeRabbitClient {
	const apiKey = env["CODERABBIT_API_KEY"]
	if (!apiKey) {
		throw new Error(
			"CODERABBIT_API_KEY is not set. Create a key under Settings -> Account -> API keys.",
		)
	}
	return new CodeRabbitClient({
		apiKey,
		baseUrl: env["CODERABBIT_API_BASE_URL"] || DEFAULT_BASE_URL,
		orgId: env["CODERABBIT_ORG_ID"] || undefined,
	})
}
