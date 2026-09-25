#!/usr/bin/env bash
# Raw HTTP examples for the CodeRabbit public API.
# Usage: CODERABBIT_API_KEY=... ./examples/curl.sh
set -euo pipefail

: "${CODERABBIT_API_KEY:?Set CODERABBIT_API_KEY first}"
BASE="${CODERABBIT_API_BASE_URL:-https://api.coderabbit.ai}"
AUTH=(-H "x-coderabbitai-api-key: ${CODERABBIT_API_KEY}" -H "accept: application/json")

# Portable date math (GNU date or BSD/macOS date).
since() { date -u -d "-$1 days" +%F 2>/dev/null || date -u -v-"$1"d +%F; }
FROM=$(since 7)
TO=$(date -u +%F)

echo "== Review metrics for merged PRs, ${FROM} to ${TO}"
curl -sS "${AUTH[@]}" \
  "${BASE}/v1/metrics/reviews?start_date=${FROM}&end_date=${TO}&status=merged&limit=5"
echo

echo "== Seats"
curl -sS "${AUTH[@]}" "${BASE}/v1/users?seat_filter=assigned&limit=5"
echo

echo "== Learnings that have never been applied"
curl -sS "${AUTH[@]}" "${BASE}/v1/learnings?stat_filter=never_used&limit=5"
echo

echo "== Open security findings (first page)"
curl -sS "${AUTH[@]}" "${BASE}/v1/security/scans/code?state=open&limit=5"
echo

echo "== Audit log"
curl -sS "${AUTH[@]}" "${BASE}/v1/audit-logs?date_from=${FROM}&date_to=${TO}&page_size=5"
echo

echo "== On-demand sprint report (may take ~30s)"
curl -sS -X POST "${AUTH[@]}" -H "content-type: application/json" \
  "${BASE}/api/v1/report.generate" \
  -d "{\"from\":\"${FROM}\",\"to\":\"${TO}\",\"promptTemplate\":\"Sprint Report\"}"
echo
