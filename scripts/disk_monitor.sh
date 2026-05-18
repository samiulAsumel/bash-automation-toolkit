#!/usr/bin/env bash
# disk_monitor.sh — Alert when any mounted partition exceeds usage threshold
set -euo pipefail
trap 'echo "[ERROR] Script failed at line $LINENO." >&2' ERR

# ── Constants ────────────────────────────────────────────────────────────────
ALERT_LOG="/var/log/disk_alert.log"
THRESHOLD=80          # percent — alert when usage >= this value
CRITICAL_THRESHOLD=95 # percent — critical alert level

# Filesystems to skip (pseudo/virtual/network mounts)
EXCLUDE_TYPES=(
    tmpfs devtmpfs sysfs proc cgroup cgroup2 pstore bpf
    hugetlbfs mqueue debugfs tracefs securityfs configfs
    fusectl efivarfs autofs overlay squashfs
)

# ── Helpers ──────────────────────────────────────────────────────────────────
log() {
    local level="$1"; shift
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $*" | tee -a "$ALERT_LOG"
}

require_root() {
    [[ $EUID -eq 0 ]] || { echo "[ERROR] Must run as root."; exit 1; }
}

# ── Main ─────────────────────────────────────────────────────────────────────
require_root

ALERTS=0
CRITICAL=0

# Build -x exclusion flags before the process substitution evaluates them
_DF_ARGS=()
for _t in "${EXCLUDE_TYPES[@]}"; do _DF_ARGS+=(-x "$_t"); done

log "INFO" "=== Disk usage check started (threshold: ${THRESHOLD}%, critical: ${CRITICAL_THRESHOLD}%) ==="

# Parse df output: split all fields with a single read (no awk subshells per line)
while read -r FILESYSTEM SIZE USED AVAIL USE_PCT MOUNT; do
    USE_PCT="${USE_PCT%%%}"   # strip trailing %

    # Skip non-numeric usage (can happen with some pseudo mounts)
    [[ "$USE_PCT" =~ ^[0-9]+$ ]] || continue

    if (( USE_PCT >= CRITICAL_THRESHOLD )); then
        log "CRITICAL" "CRITICAL: $MOUNT ($FILESYSTEM) — ${USE_PCT}% used | Size:$SIZE Used:$USED Avail:$AVAIL"
        (( CRITICAL += 1 ))
        (( ALERTS += 1 ))
    elif (( USE_PCT >= THRESHOLD )); then
        log "WARN"     "ALERT:    $MOUNT ($FILESYSTEM) — ${USE_PCT}% used | Size:$SIZE Used:$USED Avail:$AVAIL"
        (( ALERTS += 1 ))
    else
        log "INFO"     "OK:       $MOUNT ($FILESYSTEM) — ${USE_PCT}% used | Size:$SIZE Used:$USED Avail:$AVAIL"
    fi

done < <(df "${_DF_ARGS[@]}" --output=source,size,used,avail,pcent,target \
    | tail -n +2 \
    | grep -vE "^(/dev/loop|none|udev)" \
    || true)

# ── Summary ──────────────────────────────────────────────────────────────────
if (( CRITICAL > 0 )); then
    log "CRITICAL" "=== Check complete — $CRITICAL CRITICAL partition(s) detected! Immediate action required. ==="
    exit 2
elif (( ALERTS > 0 )); then
    log "WARN" "=== Check complete — $ALERTS partition(s) above ${THRESHOLD}% threshold ==="
    exit 1
else
    log "INFO" "=== Check complete — all partitions within normal range ==="
    exit 0
fi
