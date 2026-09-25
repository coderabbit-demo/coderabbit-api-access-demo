import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

export async function writeOutput(path: string | undefined, contents: string): Promise<void> {
	if (!path) {
		process.stdout.write(contents.endsWith("\n") ? contents : `${contents}\n`)
		return
	}
	await mkdir(dirname(path), { recursive: true })
	await writeFile(path, contents)
	console.error(`Wrote ${path}`)
}

export function toCsv(rows: Record<string, unknown>[]): string {
	const first = rows[0]
	if (!first) return ""
	const headers = Object.keys(first)
	const escape = (value: unknown) => {
		const text = value === null || value === undefined ? "" : String(value)
		return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
	}
	return [headers, ...rows.map(row => headers.map(h => row[h]))]
		.map(cells => cells.map(escape).join(","))
		.join("\r\n")
}

export function percent(numerator: number, denominator: number): string {
	return denominator === 0 ? "—" : `${((numerator / denominator) * 100).toFixed(1)}%`
}
