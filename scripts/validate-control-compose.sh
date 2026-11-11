#!/usr/bin/env bash
set -euo pipefail

export BRIDGE_ARU_SENDER_HOST_PATH=/tmp/mock-aru-sender.mjs
export BRIDGE_CONTROL_ALLOWED_ORIGINS=https://card.example
export BRIDGE_CONTROL_HOST_PORT=19443
export BRIDGE_CONTROL_TLS_KEY_HOST_PATH=/tmp/mock-control.key
export BRIDGE_CONTROL_TLS_CERT_HOST_PATH=/tmp/mock-control.crt
export BRIDGE_CONTROL_TOKEN_HOST_PATH=/tmp/mock-control-token

config="$(docker compose -f compose.yaml -f compose.control.example.yaml config)"
printf '%s\n' "$config" | grep -q '127.0.0.1:19443'
printf '%s\n' "$config" | grep -q 'BRIDGE_CONTROL_HOST: 0.0.0.0'
printf '%s\n' "$config" | grep -q 'BRIDGE_CONTROL_ALLOWED_ORIGINS: https://card.example'
printf '%s\n' "$config" | grep -q 'BRIDGE_WAKE_BUNDLE_FILE: /app/secrets/aru-sender-bundle.json'
printf '%s\n' "$config" | grep -q 'read_only: true'
printf '%s\n' "$config" | grep -q 'mem_limit: "100663296"'
printf '%s\n' "$config" | grep -q 'mem_limit: "134217728"'
if printf '%s\n' "$config" | grep -Eq '0\.0\.0\.0:19443|published: "?9443"?'; then
  echo 'Control port is not restricted to loopback' >&2
  exit 1
fi
printf '%s\n' 'control compose validation passed'
