#!/usr/bin/env bash
# system_report.sh — Generate a daily system health snapshot and save to /root/reports/
set -euo pipefail
trap 'echo "[ERROR] Report generation failed at line $LINENO." >&2' ERR

# ── Constants ────────────────────────────────────────────────────────────────
REPORT_DIR="/root/reports"
DATESTAMP="$(date '+%Y-%m-%d')"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
REPORT_FILE="${REPORT_DIR}/report_${DATESTAMP}.txt"
RETENTION_DAYS=30

# ── Helpers ──────────────────────────────────────────────────────────────────
require_root() {
    [[ $EUID -eq 0 ]] || { echo "[ERROR] Must run as root."; exit 1; }
}

section() {
    local title="$1"
    printf '\n%s\n' "══════════════════════════════════════════════════════════"
    printf '  %s\n' "$title"
    printf '%s\n\n' "══════════════════════════════════════════════════════════"
}

# ── Setup ────────────────────────────────────────────────────────────────────
require_root
mkdir -p "$REPORT_DIR"

# If a report already exists for today, overwrite (idempotent reruns)
: > "$REPORT_FILE"

# ── Report Generation ────────────────────────────────────────────────────────
{
printf '%s\n' "╔══════════════════════════════════════════════════════════╗"
printf '%s\n' "║           DAILY SYSTEM REPORT — ${DATESTAMP}           ║"
printf '%s\n' "╚══════════════════════════════════════════════════════════╝"
printf 'Generated: %s\n' "$TIMESTAMP"

# ── 1. Identity ──────────────────────────────────────────────────────────────
section "SYSTEM IDENTITY"
printf 'Hostname      : %s\n' "$(hostname -f 2>/dev/null || hostname)"
printf 'OS            : %s\n' "$(grep PRETTY_NAME /etc/os-release | cut -d= -f2 | tr -d '"')"
printf 'Kernel        : %s\n' "$(uname -r)"
printf 'Architecture  : %s\n' "$(uname -m)"

# ── 2. Uptime & Load ─────────────────────────────────────────────────────────
section "UPTIME & LOAD"
uptime -p
printf '\n'
printf 'Load averages (1m / 5m / 15m): %s\n' \
    "$(awk '{print $1, "/", $2, "/", $3}' /proc/loadavg)"

CPU_CORES=$(nproc)
printf 'CPU cores     : %s\n' "$CPU_CORES"

# ── 3. CPU Usage ─────────────────────────────────────────────────────────────
section "CPU USAGE (1-second snapshot)"
# Use /proc/stat for a portable CPU reading
CPU_LINE1=$(grep '^cpu ' /proc/stat)
sleep 1
CPU_LINE2=$(grep '^cpu ' /proc/stat)

read -r _ u1 n1 s1 i1 io1 irq1 sirq1 _ <<< "$CPU_LINE1"
read -r _ u2 n2 s2 i2 io2 irq2 sirq2 _ <<< "$CPU_LINE2"

TOTAL1=$(( u1+n1+s1+i1+io1+irq1+sirq1 ))
TOTAL2=$(( u2+n2+s2+i2+io2+irq2+sirq2 ))
IDLE_DIFF=$(( i2 - i1 ))
TOTAL_DIFF=$(( TOTAL2 - TOTAL1 ))
if (( TOTAL_DIFF > 0 )); then
    CPU_USED=$(( 100 * (TOTAL_DIFF - IDLE_DIFF) / TOTAL_DIFF ))
    printf 'CPU Usage     : %d%%\n' "$CPU_USED"
else
    printf 'CPU Usage     : N/A (sampling error)\n'
fi

# Top 5 CPU-consuming processes
printf '\nTop 5 CPU consumers:\n'
ps axo pid,user,pcpu,comm --sort=-pcpu 2>/dev/null | head -6

# ── 4. Memory ────────────────────────────────────────────────────────────────
section "MEMORY USAGE"
free -h
printf '\n'
MEM_TOTAL=$(grep MemTotal /proc/meminfo | awk '{print $2}')
MEM_AVAIL=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
MEM_USED=$(( MEM_TOTAL - MEM_AVAIL ))
MEM_PCT=$(( 100 * MEM_USED / MEM_TOTAL ))
printf 'Usage         : %d%% (%d kB used of %d kB total)\n' "$MEM_PCT" "$MEM_USED" "$MEM_TOTAL"

# ── 5. Disk Usage ────────────────────────────────────────────────────────────
section "DISK USAGE"
df -hT -x tmpfs -x devtmpfs -x squashfs 2>/dev/null | \
    grep -vE "^(none|udev|/dev/loop)" || df -hT

# ── 6. Network Interfaces ─────────────────────────────────────────────────────
section "NETWORK INTERFACES"
ip -brief address show 2>/dev/null || ip addr show

# ── 7. Logged-In Users ───────────────────────────────────────────────────────
section "CURRENTLY LOGGED-IN USERS"
who -a 2>/dev/null || w

ACTIVE=$(who | wc -l)
printf '\nActive sessions: %d\n' "$ACTIVE"

# ── 8. Last 5 Failed Login Attempts ─────────────────────────────────────────
section "LAST 5 FAILED LOGIN ATTEMPTS"
if command -v lastb &>/dev/null && [[ -f /var/log/btmp ]]; then
    lastb -n 5 2>/dev/null || echo "(no failed logins recorded)"
elif journalctl -u sshd --no-pager -q &>/dev/null; then
    printf '(from journald — last 5 sshd auth failures)\n\n'
    journalctl -u sshd --no-pager -q --since="24 hours ago" 2>/dev/null \
        | grep -i "failed\|invalid\|error" \
        | tail -5 \
        || echo "(no SSH failures in last 24h)"
else
    echo "(btmp not accessible and journald unavailable)"
fi

# ── 9. Running Services (critical) ───────────────────────────────────────────
section "CRITICAL SERVICE STATUS"
for svc in sshd nginx firewalld chronyd; do
    if systemctl list-unit-files --type=service --no-legend 2>/dev/null \
            | awk '{print $1}' | grep -qx "${svc}.service"; then
        STATE=$(systemctl is-active "$svc" 2>/dev/null || echo "inactive")
        printf '%-15s : %s\n' "$svc" "$STATE"
    else
        printf '%-15s : not installed\n' "$svc"
    fi
done

# ── 10. Recent System Events ─────────────────────────────────────────────────
section "RECENT KERNEL / SYSTEM ERRORS (last 24h)"
journalctl -p err..emerg --no-pager --since="24 hours ago" \
    --output=short-iso 2>/dev/null | tail -15 \
    || echo "(journald unavailable)"

# ── Footer ───────────────────────────────────────────────────────────────────
printf '\n%s\n' "══════════════════════════════════════════════════════════"
printf 'Report saved  : %s\n' "$REPORT_FILE"
printf 'Next report   : %s (if cron configured)\n' "$(date -d 'tomorrow' '+%Y-%m-%d') 06:00"
printf '%s\n'   "══════════════════════════════════════════════════════════"

} | tee "$REPORT_FILE"

# ── Retention Cleanup ────────────────────────────────────────────────────────
find "$REPORT_DIR" -maxdepth 1 -name "report_*.txt" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

exit 0
