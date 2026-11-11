#!/usr/bin/env bash
set -euo pipefail

image="${1:-human-reality-bridge:ci}"
suffix="${GITHUB_RUN_ID:-local}-${RANDOM}"
container="hrb-disabled-${suffix}"
config_volume="hrb-disabled-config-${suffix}"
data_volume="hrb-disabled-data-${suffix}"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker volume rm "$config_volume" "$data_volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker volume create "$config_volume" >/dev/null
docker volume create "$data_volume" >/dev/null

docker run -d \
  --name "$container" \
  --network none \
  --read-only \
  --tmpfs /tmp:size=16m,mode=1777 \
  --security-opt no-new-privileges:true \
  --cap-drop ALL \
  -e BRIDGE_CONFIG=/app/config/config.json \
  -e BRIDGE_DATA_DIR=/app/data \
  -e BRIDGE_POLL_MINUTES=5 \
  -v "$config_volume:/app/config" \
  -v "$data_volume:/app/data" \
  "$image" >/dev/null

for _ in $(seq 1 30); do
  if ! docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null | grep -qx true; then
    docker logs "$container" >&2 || true
    echo 'Container stopped before initialization completed' >&2
    exit 1
  fi
  if docker exec "$container" test -f /app/config/config.json \
    && docker exec "$container" test -f /app/data/state.json; then
    break
  fi
  sleep 1
done

docker exec "$container" test -f /app/config/config.json
docker exec "$container" test -f /app/data/state.json

uid="$(docker exec "$container" id -u)"
test "$uid" = 1000

mode="$(docker exec "$container" stat -c '%a' /app/data/state.json)"
test "$mode" = 600

docker exec "$container" node --input-type=module -e "
  import { readFile } from 'node:fs/promises';
  const config = JSON.parse(await readFile('/app/config/config.json', 'utf8'));
  const state = JSON.parse(await readFile('/app/data/state.json', 'utf8'));
  if (config.enabled !== false) throw new Error('runtime config is not disabled');
  if (state.bridgeEnabled !== false) throw new Error('state is not paused');
  if (!Number.isFinite(state.processStartedAt)) throw new Error('missing process start time');
  if (!Number.isFinite(state.lastHeartbeatAt)) throw new Error('missing heartbeat');
  if (Date.now() - state.lastHeartbeatAt > 60_000) throw new Error('heartbeat is stale');
  if (state.lastSuccessAt !== null) throw new Error('weather collection unexpectedly ran');
  if (state.pendingEvents.length !== 0) throw new Error('delivery event was unexpectedly queued');
"

docker exec "$container" node server/healthcheck.js

container_env="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container")"
if printf '%s\n' "$container_env" | grep -Eq '^BRIDGE_WAKE_(SENDER_MODULE|BUNDLE_FILE)='; then
  echo 'Sender environment unexpectedly configured' >&2
  exit 1
fi
if printf '%s\n' "$container_env" | grep -q '^BRIDGE_SEND_STARTUP_TEST=true$'; then
  echo 'Startup delivery test unexpectedly enabled' >&2
  exit 1
fi

logs="$(docker logs "$container" 2>&1)"
printf '%s\n' "$logs" | grep -q '"triggerConfigured":false'
printf '%s\n' "$logs" | grep -q '感应桥已暂停采集与投递'

# SIGTERM must let the service finish its save and exit successfully.
docker stop --time 10 "$container" >/dev/null
exit_code="$(docker inspect -f '{{.State.ExitCode}}' "$container")"
test "$exit_code" = 0

printf '%s\n' 'disabled container smoke test passed'
