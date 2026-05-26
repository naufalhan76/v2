#!/usr/bin/env bash
# MSN ERP V2 — Staging deploy helper
# Usage:
#   ./scripts/staging.sh start    — build and start V2 staging
#   ./scripts/staging.sh stop     — stop V2 staging
#   ./scripts/staging.sh restart  — rebuild and restart
#   ./scripts/staging.sh logs     — tail logs
#   ./scripts/staging.sh status   — show container + tunnel status
#   ./scripts/staging.sh tunnel   — add v2.nufnh.my.id Cloudflare route + restart tunnel

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

ENV_FILE=".env.staging"
COMPOSE_FILE="docker-compose.yml"
TUNNEL_NAME="hermes-stack"
TUNNEL_HOSTNAME="v2.nufnh.my.id"
TUNNEL_PORT="3001"
CF_CONFIG="$HOME/.cloudflared/config.yml"

color()  { printf "\033[%sm%s\033[0m\n" "$1" "$2"; }
info()   { color "1;34" "==> $1"; }
ok()     { color "1;32" "✓  $1"; }
warn()   { color "1;33" "!  $1"; }
err()    { color "1;31" "✗  $1" >&2; }

check_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    err "$ENV_FILE not found"
    echo "Copy .env.staging.example to $ENV_FILE and fill in real values from V1's Vercel env vars:"
    echo "  cp .env.staging.example $ENV_FILE"
    echo "  vim $ENV_FILE"
    exit 1
  fi
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
  : "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL not set in $ENV_FILE}"
  : "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY not set in $ENV_FILE}"
  : "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set in $ENV_FILE}"
}

cmd_start() {
  check_env
  info "Building V2 image (NEXT_PUBLIC_* baked at build time)..."
  docker compose --env-file "$ENV_FILE" build
  info "Starting V2 container on port $TUNNEL_PORT..."
  docker compose --env-file "$ENV_FILE" up -d
  ok "V2 staging up at http://127.0.0.1:$TUNNEL_PORT"
  warn "If you haven't yet, run: $0 tunnel  (to expose at https://$TUNNEL_HOSTNAME)"
}

cmd_stop() {
  info "Stopping V2 container..."
  docker compose --env-file "$ENV_FILE" down 2>/dev/null || docker compose down
  ok "Stopped"
}

cmd_restart() {
  cmd_stop
  cmd_start
}

cmd_logs() {
  docker compose logs -f --tail=200
}

cmd_status() {
  echo "=== Docker container ==="
  docker compose ps 2>/dev/null || true
  echo ""
  echo "=== Local health check ==="
  if curl -fsS "http://127.0.0.1:$TUNNEL_PORT" >/dev/null 2>&1; then
    ok "http://127.0.0.1:$TUNNEL_PORT is responding"
  else
    warn "http://127.0.0.1:$TUNNEL_PORT not responding"
  fi
  echo ""
  echo "=== Cloudflare tunnel route ==="
  if grep -q "$TUNNEL_HOSTNAME" "$CF_CONFIG" 2>/dev/null; then
    ok "$TUNNEL_HOSTNAME route present in $CF_CONFIG"
    if curl -fsS "https://$TUNNEL_HOSTNAME" -o /dev/null 2>&1; then
      ok "https://$TUNNEL_HOSTNAME is reachable"
    else
      warn "https://$TUNNEL_HOSTNAME route present but not reachable (tunnel may need restart)"
    fi
  else
    warn "$TUNNEL_HOSTNAME route NOT in $CF_CONFIG — run: $0 tunnel"
  fi
}

cmd_tunnel() {
  if [[ ! -f "$CF_CONFIG" ]]; then
    err "$CF_CONFIG not found — cloudflared not configured"
    exit 1
  fi

  info "Adding DNS route for $TUNNEL_HOSTNAME → tunnel $TUNNEL_NAME..."
  if cloudflared tunnel route dns "$TUNNEL_NAME" "$TUNNEL_HOSTNAME" 2>&1 | grep -q "already exists\|added CNAME\|Added CNAME"; then
    ok "DNS route configured"
  else
    warn "DNS route may already exist (check Cloudflare dashboard if unsure)"
  fi

  if grep -q "$TUNNEL_HOSTNAME" "$CF_CONFIG"; then
    ok "Ingress rule already in $CF_CONFIG"
  else
    info "Adding ingress rule to $CF_CONFIG..."
    # Insert before the catch-all rule (which is the line starting with "  - service: http_status:")
    python3 - <<PYEOF
import re
path = "$CF_CONFIG"
hostname = "$TUNNEL_HOSTNAME"
port = "$TUNNEL_PORT"
with open(path) as f:
    lines = f.readlines()
new_rule = [
    f"  - hostname: {hostname}\n",
    f"    service: http://127.0.0.1:{port}\n",
]
catch_all_idx = None
for i, line in enumerate(lines):
    if re.match(r"\s*-\s*service:\s*http_status:", line):
        catch_all_idx = i
        break
if catch_all_idx is None:
    raise SystemExit("could not find catch-all rule in cloudflared config")
out = lines[:catch_all_idx] + new_rule + lines[catch_all_idx:]
with open(path, "w") as f:
    f.writelines(out)
print("inserted")
PYEOF
    ok "Ingress rule added"
  fi

  info "Restarting cloudflared..."
  if pgrep -f "cloudflared tunnel run" >/dev/null; then
    pkill -f "cloudflared tunnel run" || true
    sleep 2
  fi
  nohup cloudflared tunnel run "$TUNNEL_NAME" >"$HOME/cf-${TUNNEL_NAME}.log" 2>&1 < /dev/null &
  disown
  sleep 4
  if pgrep -f "cloudflared tunnel run" >/dev/null; then
    ok "cloudflared restarted (logs: $HOME/cf-${TUNNEL_NAME}.log)"
    ok "V2 staging will be live at https://$TUNNEL_HOSTNAME (DNS may take ~30s to propagate)"
  else
    err "cloudflared did not start — check $HOME/cf-${TUNNEL_NAME}.log"
    exit 1
  fi
}

case "${1:-help}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  logs)    cmd_logs ;;
  status)  cmd_status ;;
  tunnel)  cmd_tunnel ;;
  help|*)
    echo "MSN ERP V2 — Staging deploy helper"
    echo ""
    echo "Usage:"
    echo "  $0 start    — build and start V2 staging container"
    echo "  $0 stop     — stop V2 staging"
    echo "  $0 restart  — rebuild and restart"
    echo "  $0 logs     — tail container logs"
    echo "  $0 status   — show container + tunnel status"
    echo "  $0 tunnel   — add v2.nufnh.my.id Cloudflare route + restart tunnel"
    echo ""
    echo "First-time setup:"
    echo "  1. cp .env.staging.example .env.staging"
    echo "  2. vim .env.staging  (fill in real values)"
    echo "  3. $0 start"
    echo "  4. $0 tunnel"
    ;;
esac
