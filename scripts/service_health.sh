#!/usr/bin/env bash
# service_health.sh — Monitor critical services; auto-restart if down and log events
set -euo pipefail
trap 'echo "[ERROR] Script failed at line $LINENO." >&2' ERR

# ── Constants ────────────────────────────────────────────────────────────────
HEALTH_LOG="/var/log/service_health.log"

# Services to monitor — add/remove as needed
SERVICES=(
    "sshd"
    "nginx"
    "firewalld"
)

# ── Helpers ──────────────────────────────────────────────────────────────────
log() {
    local level="$1"; shift
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $*" | tee -a "$HEALTH_LOG"
}

require_root() {
    [[ $EUID -eq 0 ]] || { echo "[ERROR] Must run as root."; exit 1; }
}

is_active() {
    systemctl is-active --quiet "$1"
}

is_enabled() {
    systemctl is-enabled --quiet "$1" 2>/dev/null
}

service_exists() {
    systemctl list-unit-files --type=service --no-legend 2>/dev/null \
        | awk '{print $1}' \
        | grep -qx "${1}.service"
}

# ── Main ─────────────────────────────────────────────────────────────────────
require_root

FAILURES=0
RESTARTED=0

log "INFO" "=== Service health check started (${#SERVICES[@]} services) ==="

for SERVICE in "${SERVICES[@]}"; do

    # Skip if service unit doesn't exist on this host (e.g. nginx not installed)
    if ! service_exists "$SERVICE"; then
        log "WARN" "$SERVICE — unit file not found; skipping."
        continue
    fi

    if is_active "$SERVICE"; then
        log "INFO" "$SERVICE — RUNNING"
    else
        log "WARN" "$SERVICE — DOWN. Attempting restart..."
        (( FAILURES++ ))

        # Capture pre-restart status for the log
        STATUS_OUTPUT=$(systemctl status "$SERVICE" --no-pager --lines=5 2>&1 || true)
        log "INFO" "Pre-restart status for $SERVICE:"
        echo "$STATUS_OUTPUT" >> "$HEALTH_LOG"

        if systemctl start "$SERVICE" 2>>"$HEALTH_LOG"; then
            sleep 3   # brief settle time

            if is_active "$SERVICE"; then
                log "INFO" "$SERVICE — RESTARTED successfully."
                (( RESTARTED++ ))

                # Re-enable if it was somehow disabled (prevents repeat failures after reboot)
                if ! is_enabled "$SERVICE"; then
                    systemctl enable "$SERVICE" 2>>"$HEALTH_LOG" || true
                    log "INFO" "$SERVICE — was disabled; re-enabled for boot persistence."
                fi
            else
                log "ERROR" "$SERVICE — restart FAILED. Manual intervention required."
                systemctl status "$SERVICE" --no-pager --lines=10 >> "$HEALTH_LOG" 2>&1 || true
            fi
        else
            log "ERROR" "$SERVICE — 'systemctl start' returned non-zero. Check journal: journalctl -u $SERVICE -n 50"
        fi
    fi

done

# ── Summary ──────────────────────────────────────────────────────────────────
log "INFO" "=== Health check complete — Failures: $FAILURES | Restarted: $RESTARTED ==="

(( FAILURES > 0 )) && exit 1 || exit 0
