#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

git rev-parse --is-inside-work-tree >/dev/null

forbidden_names='(^|/)(\.env|config\.json|.*sender-bundle.*\.json|control-token|settings-token|.*\.key)$'
bad_names="$(git log --all --name-only --pretty=format: | LC_ALL=C sort -u | grep -E "$forbidden_names" || true)"
if [[ -n "$bad_names" ]]; then
  printf '%s\n' 'Forbidden secret-like filename found in reachable history:' >&2
  printf '%s\n' "$bad_names" >&2
  exit 1
fi

secret_patterns='BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|Authorization:[[:space:]]*Bearer[[:space:]]+[A-Za-z0-9_+./=-]{24,}'
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
for revision in $(git rev-list --all); do
  if git grep -nEI "$secret_patterns" "$revision" -- . ':!SECURITY.md' ':!scripts/audit-source.sh' > "$tmp" 2>/dev/null; then
    printf 'Potential secret found in revision %s:\n' "$revision" >&2
    cat "$tmp" >&2
    exit 1
  fi
done

# Public card source must keep deployment values as placeholders only.
git grep -q '__SETTINGS_BASE_URL__' -- index.html
git grep -q '__SETTINGS_TOKEN__' -- index.html
if git grep -nE 'meta name="x-settings-(base-url|token)" content="(https://|[A-Za-z0-9_+./=-]{24,})' -- index.html; then
  echo 'Public card source contains a deployment value instead of placeholders' >&2
  exit 1
fi

# Private generated paths must remain ignored.
git check-ignore -q private-deployment/.env
git check-ignore -q private-build/card.html
git check-ignore -q secrets/settings-token

printf '%s\n' 'source secret audit passed'
