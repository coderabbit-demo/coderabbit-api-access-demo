// Response shapes for the CodeRabbit public API.
// Reference: https://docs.coderabbit.ai/api-reference

export interface CommentCount {
	posted: number
	accepted: number
}

export type Severity = "critical" | "major" | "minor" | "trivial" | "info"

export interface ReviewMetric {
	pr_url: string
	organization_id: string
	organization_name: string
	repository_id: string
	repository_name: string
	author_id: string
	author_username: string
	created_at: string
	first_human_review_at: string | null
	last_commit_at: string | null
	merged_at: string | null
	status?: "merged" | "closed"
	review_iterations?: number
	estimated_complexity?: number
	estimated_review_minutes?: number
	coderabbit_comments: {
		total: CommentCount
		severity: Record<Severity, CommentCount>
		category: Record<string, CommentCount>
	}
}

export interface OrgUser {
	user_id: string
	seat_assigned: boolean
	role: string
	role_name?: string
	role_type?: "system" | "custom"
}

export interface UsersPage {
	seats_purchased: number
	seats_assigned: number
	seat_assignment_mode: "automatic" | "manual"
	users: OrgUser[]
	next_cursor: string | null
}

export interface SeatUpdateResult {
	status: "success" | "partial_success" | "failure"
	succeeded: string[]
	failed: { user_id: string; code: string }[]
}

export interface Learning {
	id: string
	learning: string
	organization_id: string
	organization_name: string
	repository_id: string
	repository_name: string
	author_id: string
	author_username: string
	file: string | null
	source_url: string | null
	created_at: string
	updated_at: string
	usage_count: number
	last_used_at: string | null
}

export interface SecurityCodeFinding {
	id: string
	organization_id: string
	organization_name: string
	repository_id: string
	repository_name: string
	severity: string
	state: "open" | "fixed" | "dismissed"
	cwe: string | null
	file_path: string
	start_line: number
	end_line: number
}

export interface AuditLogEntry {
	id: string
	action: string
	actionLabel: string
	resourceType: string
	resourceTypeLabel: string
	resourceSummary: string
	actor: { name: string; subtitle: string | null; isBot: boolean }
	metadata: Record<string, unknown>
	ipAddress: string | null
	createdAt: string
}

export interface AuditLogPage {
	data: AuditLogEntry[]
	pagination: {
		page: number
		page_size: number
		total_count: number
		total_pages: number
		has_next_page: boolean
	}
}

export type ReportDimension =
	| "REPOSITORY"
	| "LABEL"
	| "TEAM"
	| "USER"
	| "SOURCEBRANCH"
	| "TARGETBRANCH"
	| "STATE"

export interface ReportRequest {
	/** Inclusive `YYYY-MM-DD` window. */
	from: string
	to: string
	/** Custom instructions for the report writer. */
	prompt?: string
	promptTemplate?:
		| "Daily Standup Report"
		| "Sprint Report"
		| "Release Notes"
		| "Organization Stats"
		| "Custom"
	groupBy?: ReportDimension | "NONE"
	subgroupBy?: ReportDimension | "NONE"
	parameters?: {
		parameter: ReportDimension
		operator: "IN" | "ALL" | "NOT_IN"
		values: string[]
	}[]
}

export interface ReportSection {
	group: string
	report: string
}
