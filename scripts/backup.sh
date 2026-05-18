#!/usr/bin/env bash
# backup.sh — Archive /home and /etc to /backup/ with date-stamped tar.gz files
set -euo pipefail
trap 'log "ERROR" "Script failed at line $LINENO. Exit code: $?"; exit 1' ERR

# ── Constants ────────────────────────────────────────────────────────────────
BACKUP_DIR="/backup"
LOG_FILE="/var/log/backup.log"
DATESTAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
RETENTION_DAYS=7          # auto-delete backups older than N days
SOURCES=("/home" "/etc")

# ── Helpers ──────────────────────────────────────────────────────────────────
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [$1] $2" | tee -a "$LOG_FILE"; }

require_root() {
    [[ $EUID -eq 0 ]] || { echo "[ERROR] Must run as root."; exit 1; }
}

bytes_to_human() {
    local bytes="$1"
    if   (( bytes >= 1073741824 )); then printf "%.2f GB" "$(echo "scale=2; $bytes/1073741824" | bc)"
    elif (( bytes >= 1048576 ));    then printf "%.2f MB" "$(echo "scale=2; $bytes/1048576" | bc)"
    else printf "%d KB" "$(( bytes / 1024 ))"
    fi
}

# ── Validation ───────────────────────────────────────────────────────────────
require_root

# Verify source paths exist
for src in "${SOURCES[@]}"; do
    [[ -d "$src" ]] || { log "ERROR" "Source directory '$src' does not exist."; exit 1; }
done

# Ensure backup destination exists
mkdir -p "$BACKUP_DIR"

# Check available disk space (require at least 500 MB free)
AVAIL_KB=$(df -k "$BACKUP_DIR" | awk 'NR==2 {print $4}')
(( AVAIL_KB >= 512000 )) || {
    log "ERROR" "Insufficient disk space in '$BACKUP_DIR' (${AVAIL_KB}KB available, need 512000KB)."
    exit 1
}

# ── Backup ───────────────────────────────────────────────────────────────────
ERRORS=0

for src in "${SOURCES[@]}"; do
    # Derive a safe filename from the path (e.g. /home -> home, /etc -> etc)
    DIR_NAME="${src//\//_}"
    DIR_NAME="${DIR_NAME#_}"          # strip leading underscore
    ARCHIVE="${BACKUP_DIR}/${DIR_NAME}_${DATESTAMP}.tar.gz"

    log "INFO" "Backing up '$src' → '$ARCHIVE' ..."

    if tar \
        --create \
        --gzip \
        --file="$ARCHIVE" \
        --exclude="${BACKUP_DIR}" \
        --exclude="/home/*/.cache" \
        --exclude="/home/*/.local/share/Trash" \
        --warning=no-file-changed \
        "$src" 2>>"$LOG_FILE"; then

        SIZE=$(stat -c%s "$ARCHIVE")
        HUMAN_SIZE=$(bytes_to_human "$SIZE")
        # Verify archive integrity
        if tar --test-label --file="$ARCHIVE" &>/dev/null || tar -tzf "$ARCHIVE" &>/dev/null; then
            log "INFO"  "SUCCESS — '$src' backed up. Archive: $(basename "$ARCHIVE") | Size: $HUMAN_SIZE"
        else
            log "ERROR" "Archive '$ARCHIVE' failed integrity check."
            rm -f "$ARCHIVE"
            (( ERRORS += 1 ))
        fi
    else
        log "ERROR" "tar failed for '$src'."
        rm -f "$ARCHIVE"
        (( ERRORS += 1 ))
    fi
done

# ── Retention Cleanup ────────────────────────────────────────────────────────
log "INFO" "Removing backups older than ${RETENTION_DAYS} days from '$BACKUP_DIR' ..."
find "$BACKUP_DIR" -maxdepth 1 -name "*.tar.gz" -mtime +"$RETENTION_DAYS" -print -delete \
    >> "$LOG_FILE" 2>&1 || true

# ── Exit Status ──────────────────────────────────────────────────────────────
if (( ERRORS == 0 )); then
    log "INFO" "=== Backup completed successfully ==="
    exit 0
else
    log "ERROR" "=== Backup finished with $ERRORS error(s) — review $LOG_FILE ==="
    exit 1
fi
