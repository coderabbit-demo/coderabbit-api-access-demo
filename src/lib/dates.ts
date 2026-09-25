/** Formats a Date as the `YYYY-MM-DD` (UTC) string the API expects. */
export function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10)
}

/** Returns an inclusive `[start, end]` window ending today, `days` long. */
export function lastNDays(days: number, now = new Date()): { start: string; end: string } {
	if (!Number.isInteger(days) || days < 1) throw new Error("days must be a positive integer")
	const start = new Date(now)
	start.setUTCDate(start.getUTCDate() - (days - 1))
	return { start: isoDate(start), end: isoDate(now) }
}
