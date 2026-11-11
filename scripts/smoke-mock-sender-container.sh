#!/usr/bin/env bash
set -euo pipefail

image="${1:-human-reality-bridge:ci}"
suffix="${GITHUB_RUN_ID:-local}-${RANDOM}"
container="hrb-mock-sender-${suffix}"
config_volume="hrb-mock-config-${suffix}"
data_volume="hrb-mock-data-${suffix}"
fixture_dir="$(mktemp -d)"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker volume rm "$config_volume" "$data_volume" >/dev/null 2>&1 || true
  rm -rf "$fixture_dir"
}
trap cleanup EXIT

cat >"$fixture_dir/wake-send.mjs" <<'MOCK'
import { appendFile } from 'node:fs/promises';

export async function submitWakeEvent(bundle, content) {
  if (bundle?.schema !== 'aru.wake-bridge.sender-bundle.v2') {
    throw new Error('mock received invalid bundle');
  }
  if (bundle?.fixture !== 'offline-container-smoke') {
    throw new Error('mock received unexpected bundle');
  }
  await appendFile(
    '/app/data/mock-deliveries.jsonl',
    `${JSON.stringify({ content })}\n`,
    { mode: 0o600 }
  );
}
MOCK

cat >"$fixture_dir/fake-bundle.json" <<'JSON'
{
  "schema": "aru.wake-bridge.sender-bundle.v2",
  "fixture": "offline-container-smoke"
}
JSON
chmod 755 "$fixture_dir"
chmod 644 "$fixture_dir/wake-send.mjs" "$fixture_dir/fake-bundle.json"

docker volume create "$config_volume" >/dev/null
docker volume create "$data_volume" >/dev/null

start_container() {
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
    -e BRIDGE_WAKE_SENDER_MODULE=/opt/mock/wake-send.mjs \
    -e BRIDGE_WAKE_BUNDLE_FILE=/opt/mock/fake-bundle.json \
    -e BRIDGE_SEND_STARTUP_TEST=true \
    -v "$config_volume:/app/config" \
    -v "$data_volume:/app/data" \
    -v "$fixture_dir:/opt/mock:ro" \
    "$image" >/dev/null
}

wait_for_delivery() {
  for _ in $(seq 1 30); do
    if ! docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null | grep -qx true; then
      docker logs "$container" >&2 || true
      echo 'Mock sender container stopped before delivery completed' >&2
      exit 1
    fi
    if docker exec "$container" node --input-type=module -e "
      import { readFile } from 'node:fs/promises';
      const state = JSON.parse(await readFile('/app/data/state.json', 'utf8'));
      const deliveries = (await readFile('/app/data/mock-deliveries.jsonl', 'utf8')).trim().split('\\n');
      if (deliveries.length !== 1) process.exit(1);
      if (state.pendingEvents.length !== 0) process.exit(1);
      if (!/^[a-f0-9]{16}$/.test(state.lastStartupTestCredentialId || '')) process.exit(1);
    " >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  docker logs "$container" >&2 || true
  echo 'Timed out waiting for mock startup delivery' >&2
  exit 1
}

start_container
wait_for_delivery

docker exec "$container" node --input-type=module -e "
  import { readFile } from 'node:fs/promises';
  const state = JSON.parse(await readFile('/app/data/state.json', 'utf8'));
  const lines = (await readFile('/app/data/mock-deliveries.jsonl', 'utf8')).trim().split('\\n');
  const delivery = JSON.parse(lines[0]);
  if (delivery.content !== '人类现实感应桥测试事件：连接已建立。') {
    throw new Error('mock received unexpected delivery text');
  }
  if (state.bridgeEnabled !== false) throw new Error('bridge did not remain paused');
  if (state.lastSuccessAt !== null) throw new Error('weather collection unexpectedly ran');
  if (state.sentEventIds.length !== 1) throw new Error('test event was not marked sent exactly once');
  if (!state.sentEventIds[0].startsWith('startup-test:')) throw new Error('unexpected sent event id');
"
docker exec "$container" node server/healthcheck.js

first_credential_id="$(docker exec "$container" node --input-type=module -e "
  import { readFile } from 'node:fs/promises';
  const state = JSON.parse(await readFile('/app/data/state.json', 'utf8'));
  process.stdout.write(state.lastStartupTestCredentialId);
")"

first_logs="$(docker logs "$container" 2>&1)"
printf '%s\n' "$first_logs" | grep -q '"triggerConfigured":true'
printf '%s\n' "$first_logs" | grep -q '启动测试投递已执行'

docker stop --time 10 "$container" >/dev/null
test "$(docker inspect -f '{{.State.ExitCode}}' "$container")" = 0
docker rm "$container" >/dev/null

# Reusing the same fake bundle must not emit the startup test again.
start_container
sleep 3

docker exec "$container" node --input-type=module -e "
  import { readFile } from 'node:fs/promises';
  const state = JSON.parse(await readFile('/app/data/state.json', 'utf8'));
  const lines = (await readFile('/app/data/mock-deliveries.jsonl', 'utf8')).trim().split('\\n');
  if (lines.length !== 1) throw new Error('startup test was delivered more than once');
  if (state.pendingEvents.length !== 0) throw new Error('unexpected pending event after restart');
  if (state.sentEventIds.length !== 1) throw new Error('sent event history changed after restart');
"

second_credential_id="$(docker exec "$container" node --input-type=module -e "
  import { readFile } from 'node:fs/promises';
  const state = JSON.parse(await readFile('/app/data/state.json', 'utf8'));
  process.stdout.write(state.lastStartupTestCredentialId);
")"
test "$second_credential_id" = "$first_credential_id"
docker exec "$container" node server/healthcheck.js

docker stop --time 10 "$container" >/dev/null
test "$(docker inspect -f '{{.State.ExitCode}}' "$container")" = 0

printf '%s\n' 'mock sender container smoke test passed'
