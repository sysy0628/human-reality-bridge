#!/usr/bin/env bash
set -euo pipefail

archive="${1:?usage: verify-release.sh ARCHIVE [EXPECTED_COMMIT]}"
expected_commit="${2:-}"
sidecar="$archive.sha256"
[[ -f "$archive" && -f "$sidecar" ]] || { echo 'archive or checksum sidecar missing' >&2; exit 1; }

(
  cd "$(dirname "$archive")"
  sha256sum -c "$(basename "$sidecar")"
)

# Reject absolute paths, traversal and bundles with more than one top-level root.
mapfile -t entries < <(tar -tzf "$archive")
((${#entries[@]} > 0)) || { echo 'empty archive' >&2; exit 1; }
root="${entries[0]%%/*}"
[[ -n "$root" && "$root" != '.' ]] || { echo 'invalid archive root' >&2; exit 1; }
for entry in "${entries[@]}"; do
  [[ "$entry" != /* && "$entry" != *'/../'* && "$entry" != '../'* && "$entry" != *'/..' ]] \
    || { echo "unsafe archive path: $entry" >&2; exit 1; }
  [[ "$entry" == "$root" || "$entry" == "$root/"* ]] \
    || { echo "multiple archive roots: $entry" >&2; exit 1; }
done

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
tar -xzf "$archive" -C "$tmp" --no-same-owner --no-same-permissions
(
  cd "$tmp/$root"
  sha256sum -c SHA256SUMS
)
commit="$(cat "$tmp/$root/SOURCE_COMMIT")"
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || { echo 'invalid SOURCE_COMMIT' >&2; exit 1; }
if [[ -n "$expected_commit" && "$commit" != "$expected_commit" ]]; then
  echo "SOURCE_COMMIT mismatch: expected $expected_commit, got $commit" >&2
  exit 1
fi
printf 'verified release for %s\n' "$commit"
