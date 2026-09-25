# CodeRabbit API Access demo

Sample code for the **CodeRabbit public API**, available on the **Enterprise** plan.
It shows how teams pull CodeRabbit data into their own tooling and automate
administration:

| Use case | Endpoint | Command |
| --- | --- | --- |
| Review impact per repository (comments posted/accepted, severity, time to merge) | `GET /v1/metrics/reviews` | `crapi review-metrics` |
| AI-written sprint / standup / release-notes report | `POST /api/v1/report.generate` | `crapi report` |
| Seat utilisation | `GET /v1/users` | `crapi seats` |
| Back up or curate review learnings | `GET /v1/learnings` | `crapi learnings` |
| Feed security findings into GitHub code scanning | `GET /v1/security/scans/code?format=sarif` | `crapi security --sarif` |
| Compliance / SIEM export | `GET /v1/audit-logs` | `crapi audit-logs` |

Also available and used by the client: `POST /v1/users/seats`, `POST /v1/users/roles`,
`GET /v1/roles`, `GET /v1/organizations`, `GET /v1/metrics/mcp`,
`PATCH`/`DELETE /v1/learnings/{id}`. Full reference:
<https://docs.coderabbit.ai/api-reference>.

## 1. Create an API key

1. In CodeRabbit, open **Settings → Account → API keys**.
2. Click **Create API key**, choose type **User**, and pick an expiry.
3. Copy the key. It is shown once.

Admin permissions are needed for audit logs and seat changes. Keys are scoped to
the organization they were created in.

## 2. Run it

Requires Node.js 22.18 or newer. The runtime has no dependencies because Node runs
TypeScript directly.

```bash
export CODERABBIT_API_KEY=cr-...
node src/cli.ts review-metrics --days 30
node src/cli.ts report --days 7 --template "Sprint Report"
node src/cli.ts seats
node src/cli.ts learnings --never-used --out out/unused-learnings.csv
node src/cli.ts security --sarif --out out/coderabbit.sarif
node src/cli.ts audit-logs --days 7 --out out/audit.csv
```

Example `review-metrics` output:

```text
## CodeRabbit review metrics (2026-08-27 → 2026-09-25)

| Repository | PRs | CodeRabbit comments | Accepted | Acceptance | Critical + major | Avg iterations | Median hours to merge |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| payments-api | 48 | 312 | 201 | 64.4% | 37 | 2.1 | 9.5 |
| web-app | 35 | 190 | 117 | 61.6% | 12 | 1.8 | 6.0 |
```

Prefer raw HTTP? See [`examples/curl.sh`](examples/curl.sh).

## 3. Automate it with GitHub Actions

[`.github/workflows/weekly-coderabbit-report.yml`](.github/workflows/weekly-coderabbit-report.yml)
puts review metrics and a sprint report in the job summary, and uploads open security
findings to GitHub code scanning. Add the key as the repository secret
`CODERABBIT_API_KEY`, run it from the **Actions** tab, then uncomment the `schedule`
trigger to run it every Monday.

## Using the client in your own code

```ts
import { CodeRabbitClient } from "./src/client.ts"

const client = new CodeRabbitClient({ apiKey: process.env.CODERABBIT_API_KEY! })

for await (const pr of client.reviewMetrics({ start_date: "2026-09-01", end_date: "2026-09-25" })) {
	console.log(pr.pr_url, pr.coderabbit_comments.total)
}
```

[`src/client.ts`](src/client.ts) handles:

- **Auth**: sends the `x-coderabbitai-api-key` header.
- **Pagination**: list endpoints return `next_cursor`, and the client's async
  generators follow it to the last page.
- **Rate limits**: about 10 requests per minute per endpoint group. On a `429` the
  client waits for `Retry-After`, or backs off exponentially.
- **Errors**: throws `CodeRabbitApiError` with the HTTP status and the API's error
  body. A `403` usually means the organization is not on Enterprise or the key does
  not have the permission.

## Development

```bash
npm ci
npm run typecheck
npm test
```

Tests use a scripted `fetch`, so they never call the real API.
