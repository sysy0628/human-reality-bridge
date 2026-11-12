#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="${1:-$root/dist}"
commit="${2:-$(git -C "$root" rev-parse HEAD)}"

if [[ ! "$commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'commit must be a full 40-character lowercase SHA' >&2
  exit 1
fi

if [[ -n "${SOURCE_DATE_EPOCH:-}" ]]; then
  epoch="$SOURCE_DATE_EPOCH"
else
  epoch="$(git -C "$root" show -s --format=%ct "$commit")"
fi
[[ "$epoch" =~ ^[0-9]+$ ]] || { echo 'SOURCE_DATE_EPOCH must be an integer' >&2; exit 1; }

name="human-reality-bridge-${commit:0:12}"
archive="$out_dir/$name.tar.gz"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$out_dir" "$stage/$name"

files=(
  .dockerignore
  .env.example
  Dockerfile
  README.md
  SECURITY.md
  compose.control.example.yaml
  compose.wake.example.yaml
  compose.yaml
  config.example.json
  package.json
  server
  scripts
)

for path in "${files[@]}"; do
  [[ -e "$root/$path" ]] || { echo "missing release input: $path" >&2; exit 1; }
  cp -a "$root/$path" "$stage/$name/$path"
done

printf '%s\n' "$commit" > "$stage/$name/SOURCE_COMMIT"
(
  cd "$stage/$name"
  find . -type f ! -name SHA256SUMS -print0 \
    | LC_ALL=C sort -z \
    | xargs -0 sha256sum > SHA256SUMS
)

# GNU tar plus gzip -n removes filesystem ownership, ordering and gzip timestamps.
tar --sort=name \
  --mtime="@$epoch" \
  --owner=0 --group=0 --numeric-owner \
  --pax-option=delete=atime,delete=ctime \
  -C "$stage" -cf - "$name" \
  | gzip -n -9 > "$archive"

(
  cd "$out_dir"
  sha256sum "$(basename "$archive")" > "$(basename "$archive").sha256"
)
printf '%s\n' "$archive"
