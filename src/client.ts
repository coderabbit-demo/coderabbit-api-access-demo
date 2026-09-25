import type {
	AuditLogPage,
	Learning,
	ReportRequest,
	ReportSection,
	ReviewMetric,
	SeatUpdateResult,
	SecurityCodeFinding,
	UsersPage,
} from "./types.ts"

export const DEFAULT_BASE_URL = "https://api.coderabbit.ai"
export const API_KEY_HEADER = "x-coderabbitai-api-key"

type Query = Record<string, string | number | boolean | string[] | undefined>

export interface ClientOptions {
	apiKey: string
	baseUrl?: string
	/** Sent as `org_id` on every request. Needed only for workspace-scoped keys. */
	orgId?: string
	maxRetries?: number
	fetch?: typeof fetch
	sleep?: (ms: number) => Promise<void>
}

export class CodeRabbitApiError extends Error {
	readonly status: number
	readonly body: unknown

	constructor(status: number, body: unknown, path: string) {
		super(`CodeRabbit API ${status} for ${path}: ${describe(body)}`)
		this.name = "CodeRabbitApiError"
		this.status = status
		this.body = body
	}
}

const RETRYABLE_STATUS = new Set([429, 502, 503, 504])

/**
 * Minimal, dependency-free client for the CodeRabbit public API.
 *
 * - Authenticates with the `x-coderabbitai-api-key` header.
 * - Retries 429 and transient 5xx responses, honouring `Retry-After`.
 *   The API allows roughly 10 requests per minute per endpoint group.
 * - Follows `next_cursor` pagination through async generators.
 */
export class CodeRabbitClient {
	readonly #apiKey: string
	readonly #baseUrl: string
	readonly #orgId: string | undefined
	readonly #maxRetries: number
	readonly #fetch: typeof fetch
	readonly #sleep: (ms: number) => Promise<void>

	constructor(options: ClientOptions) {
		if (!options.apiKey) throw new Error("apiKey is required")
		this.#apiKey = options.apiKey
		this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "")
		this.#orgId = options.orgId
		this.#maxRetries = options.maxRetries ?? 4
		this.#fetch = options.fetch ?? globalThis.fetch
		this.#sleep =
			options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
	}

	async request<T>(
		method: "GET" | "POST" | "PATCH" | "DELETE",
		path: string,
		{ query, body }: { query?: Query; body?: unknown } = {},
	): Promise<T> {
		const url = this.#url(path, query)

		for (let attempt = 0; ; attempt++) {
			const response = await this.#fetch(url, {
				method,
				headers: {
					[API_KEY_HEADER]: this.#apiKey,
					accept: "application/json",
					...(body === undefined ? {} : { "content-type": "application/json" }),
				},
				body: body === undefined ? undefined : JSON.stringify(body),
				signal: AbortSignal.timeout(120_000),
			})

			if (response.ok) {
				if (response.status === 204) return undefined as T
				return (await response.json()) as T
			}

			if (RETRYABLE_STATUS.has(response.status) && attempt < this.#maxRetries) {
				await this.#sleep(retryDelayMs(response, attempt))
				continue
			}

			throw new CodeRabbitApiError(
				response.status,
				await readBody(response),
				path,
			)
		}
	}

	/** Yields every item across `next_cursor` pages. */
	async *paginate<T>(
		path: string,
		itemsKey: string,
		query: Query = {},
	): AsyncGenerator<T> {
		let cursor: string | undefined
		do {
			const page = await this.request<Record<string, unknown>>("GET", path, {
				query: { ...query, cursor },
			})
			yield* (page[itemsKey] as T[]) ?? []
			cursor = (page["next_cursor"] as string | null) ?? undefined
		} while (cursor)
	}

	// --- Metrics ------------------------------------------------------------

	reviewMetrics(query: {
		start_date: string
		end_date: string
		status?: "merged" | "closed" | "all"
		repository_ids?: string[]
		user_ids?: string[]
	}): AsyncGenerator<ReviewMetric> {
		return this.paginate("/v1/metrics/reviews", "data", query)
	}

	// --- Users and seats ----------------------------------------------------

	usersPage(query: Query = {}): Promise<UsersPage> {
		return this.request("GET", "/v1/users", { query })
	}

	users(query: {
		seat_filter?: "all" | "assigned" | "unassigned"
		role_filter?: "all" | "member" | "admin"
	} = {}): AsyncGenerator<UsersPage["users"][number]> {
		return this.paginate("/v1/users", "users", query)
	}

	/** Assigns or unassigns seats. The API accepts at most 500 user ids per call. */
	updateSeats(
		action: "assign" | "unassign",
		userIds: string[],
	): Promise<SeatUpdateResult> {
		return this.request("POST", "/v1/users/seats", {
			body: { action, user_ids: userIds },
		})
	}

	// --- Learnings ----------------------------------------------------------

	learnings(query: {
		repository_ids?: string[]
		search?: string
		stat_filter?: "total" | "active" | "never_used" | "created_this_week"
	} = {}): AsyncGenerator<Learning> {
		return this.paginate("/v1/learnings", "data", query)
	}

	// --- Security -----------------------------------------------------------

	securityFindings(query: {
		repo_id?: string
		state?: "open" | "fixed" | "dismissed" | "all"
	} = {}): AsyncGenerator<SecurityCodeFinding> {
		return this.paginate("/v1/security/scans/code", "data", query)
	}

	/** Raw SARIF 2.1.0 document, ready for GitHub code scanning upload. */
	securityFindingsSarif(query: { repo_id?: string } = {}): Promise<unknown> {
		return this.request("GET", "/v1/security/scans/code", {
			query: { ...query, format: "sarif" },
		})
	}

	// --- Audit logs (page-number pagination) --------------------------------

	auditLogs(query: {
		date_from?: string
		date_to?: string
		actions?: string[]
		page?: number
		page_size?: number
	}): Promise<AuditLogPage> {
		return this.request("GET", "/v1/audit-logs", { query })
	}

	// --- Reports ------------------------------------------------------------

	/** Generates an on-demand developer activity report. Can take ~30s. */
	async generateReport(body: ReportRequest): Promise<ReportSection[]> {
		const response = await this.request<{
			result: { data: ReportSection[] }
		}>("POST", "/api/v1/report.generate", { body })
		return response.result.data
	}

	#url(path: string, query: Query = {}): string {
		const url = new URL(this.#baseUrl + path)
		const params: Query = { org_id: this.#orgId, ...query }
		for (const [key, value] of Object.entries(params)) {
			if (value === undefined || value === "") continue
			// List filters are comma separated, e.g. repository_ids=1,2,3
			url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value))
		}
		return url.toString()
	}
}

export function retryDelayMs(response: Response, attempt: number): number {
	const retryAfter = Number(response.headers.get("retry-after"))
	if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000
	// Exponential backoff with jitter: ~1s, 2s, 4s, 8s ...
	return 1000 * 2 ** attempt + Math.floor(Math.random() * 250)
}

async function readBody(response: Response): Promise<unknown> {
	const text = await response.text()
	try {
		return JSON.parse(text)
	} catch {
		return text
	}
}

function describe(body: unknown): string {
	if (body && typeof body === "object") {
		const { error, message } = body as { error?: unknown; message?: unknown }
		if (typeof message === "string") return message
		if (error && typeof error === "object" && "message" in error) {
			return String((error as { message: unknown }).message)
		}
	}
	return typeof body === "string" ? body.slice(0, 200) : JSON.stringify(body)
}
