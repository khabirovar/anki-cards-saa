#!/usr/bin/env bash
# Downloads every source listed in data/sources.txt into data/source/.
# Format: one "<file name> <url>" per line; blank lines and # comments are skipped.
# Idempotent: finished files are skipped, interrupted ones resume from .part.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
list="$root/data/sources.txt"
out="$root/data/source"
mkdir -p "$out"

failed=0
while read -r name url; do
  [[ -z "${name:-}" || "$name" == \#* ]] && continue
  target="$out/$name"
  if [[ -s "$target" ]]; then
    continue
  fi
  echo "fetch $name"
  if curl -fsSL -C - --retry 5 --retry-delay 5 --retry-all-errors \
      -A "anki-cards-saa source fetcher" -o "$target.part" "$url"; then
    mv "$target.part" "$target"
  else
    echo "FAILED $name ($url)" >&2
    failed=$((failed + 1))
  fi
done < "$list"

if (( failed > 0 )); then
  echo "$failed source(s) failed; rerun to resume" >&2
  exit 1
fi
