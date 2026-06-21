#!/usr/bin/env bash
set -euo pipefail
PAT='\.only\(|\.skip\(|\bxit\(|\bxdescribe\(|\bfdescribe\(|\bfit\(|it\.todo|test\.todo|expect\(true\)\.toBe\(true\)|expect\(1\)\.toBe\(1\)'
HITS=$(grep -rEn "$PAT" src app test 2>/dev/null --include='*.test.ts' --include='*.test.tsx' || true)
if [ -n "$HITS" ]; then
  echo "DISHONEST TEST PATTERNS FOUND:"; echo "$HITS"; exit 1
fi
# Empty test bodies
EMPTY=$(grep -rEn "it\(['\"].*['\"], *\(\) *=> *\{\} *\)" src app test 2>/dev/null --include='*.test.ts' --include='*.test.tsx' || true)
if [ -n "$EMPTY" ]; then echo "EMPTY TEST BODIES:"; echo "$EMPTY"; exit 1; fi
echo "Honesty scan passed."
