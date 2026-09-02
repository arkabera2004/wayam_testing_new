#!/usr/bin/env bash
# One regression pass: every route must return 200, and the real Playwright
# suite must still pass. Run repeatedly to catch flakiness, not just breakage.
set -uo pipefail
BASE=${BASE:-http://localhost:3000}
PAGES="/analytics /code-review /defect-prediction /discovery /doc-tests /healing /integrations /map /plan /prd /prd/new /prioritization /quarantine /release-gate /repo-baseline /root-cause /runs /settings /test-selection /tests"
fail=0; checked=0

chk() {
  local code; code=$(curl -s --max-time 45 -o /dev/null -w '%{http_code}' "$1")
  checked=$((checked+1))
  [ "$code" = 200 ] || { echo "  ROUTE FAIL $1 -> $code"; fail=$((fail+1)); }
}

ids=$(curl -s "$BASE/api/projects" | python3 -c "
import sys,json;d=json.load(sys.stdin);r=d if isinstance(d,list) else d.get('projects') or []
print(' '.join(x.get('slug') or x['id'] for x in r))")

for p in / /projects /projects/new /notifications /settings; do chk "$BASE$p"; done
for s in $ids; do
  chk "$BASE/projects/$s"
  for pg in $PAGES; do chk "$BASE/projects/$s$pg"; done
done

# Malformed ids must 404, never 500 (this was a real regression).
for bad in 137 not-a-uuid ../etc; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/projects/shopstack/runs/$bad")
  checked=$((checked+1))
  [ "$code" = 500 ] && { echo "  GUARD FAIL runs/$bad -> 500"; fail=$((fail+1)); }
done

# The suite itself, executed for real in a browser.
# --max-time so a hung run is reported as a failure instead of blocking the pass.
out=$(curl -s --max-time 180 -X POST "$BASE/api/projects/shopstack/runs" -H 'content-type: application/json' -d '{}')
echo "  suite: $out"
echo "$out" | grep -q '"failed":0' || { echo "  SUITE FAIL"; fail=$((fail+1)); }

echo "PASS_RESULT checked=$checked failures=$fail"
[ "$fail" -eq 0 ]
