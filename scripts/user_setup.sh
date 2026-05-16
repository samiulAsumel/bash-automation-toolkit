#!/usr/bin/env bash
# user_setup.sh — Create a user, assign group, configure sudo access
set -euo pipefail
trap 'echo "[ERROR] Script failed at line $LINENO. Exit code: $?" >&2' ERR

# ── Constants ────────────────────────────────────────────────────────────────
LOG_FILE="/var/log/user_setup.log"
SUDOERS_DIR="/etc/sudoers.d"

# ── Helpers ──────────────────────────────────────────────────────────────────
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') [$1] $2" | tee -a "$LOG_FILE"; }

usage() {
    echo "Usage: $0 <username> <groupname>"
    echo "  username  : new Linux user to create"
    echo "  groupname : primary group (created if it doesn't exist)"
    exit 1
}

require_root() {
    [[ $EUID -eq 0 ]] || { echo "[ERROR] Must run as root."; exit 1; }
}

# ── Validation ───────────────────────────────────────────────────────────────
require_root
[[ $# -eq 2 ]] || usage

USERNAME="$1"
GROUPNAME="$2"

# Enforce safe naming: lowercase, alphanumeric + hyphen, max 32 chars
[[ "$USERNAME" =~ ^[a-z][a-z0-9_-]{0,31}$ ]] || {
    log "ERROR" "Invalid username '$USERNAME'. Use lowercase alphanumeric, _, - (max 32 chars)."
    exit 1
}
[[ "$GROUPNAME" =~ ^[a-z][a-z0-9_-]{0,31}$ ]] || {
    log "ERROR" "Invalid groupname '$GROUPNAME'."
    exit 1
}

# Reject reserved system accounts
for reserved in root bin daemon adm lp sync shutdown halt mail news uucp operator games; do
    [[ "$USERNAME" == "$reserved" ]] && {
        log "ERROR" "Refusing to modify reserved account '$reserved'."
        exit 1
    }
done

# ── Group ────────────────────────────────────────────────────────────────────
if getent group "$GROUPNAME" &>/dev/null; then
    log "INFO" "Group '$GROUPNAME' already exists."
else
    groupadd "$GROUPNAME"
    log "INFO" "Group '$GROUPNAME' created."
fi

# ── User ─────────────────────────────────────────────────────────────────────
if id "$USERNAME" &>/dev/null; then
    log "WARN" "User '$USERNAME' already exists — updating group membership only."
    usermod -aG "$GROUPNAME" "$USERNAME"
else
    useradd \
        --gid "$GROUPNAME" \
        --create-home \
        --shell /bin/bash \
        --comment "Provisioned by user_setup.sh" \
        "$USERNAME"
    log "INFO" "User '$USERNAME' created with home directory."
fi

# ── Password ─────────────────────────────────────────────────────────────────
# Force interactive password set; never embed a default password
echo ""
echo "Set password for '$USERNAME':"
passwd "$USERNAME"
# Force password change on first login (security best practice)
chage -d 0 "$USERNAME"
log "INFO" "Password set for '$USERNAME'; first-login change enforced."

# ── Sudo Access ──────────────────────────────────────────────────────────────
SUDOERS_FILE="${SUDOERS_DIR}/${USERNAME}"
cat > "$SUDOERS_FILE" <<EOF
# Sudo privileges for $USERNAME — provisioned $(date '+%Y-%m-%d')
$USERNAME ALL=(ALL) ALL
EOF
chmod 0440 "$SUDOERS_FILE"

# Validate with visudo before leaving
visudo -cf "$SUDOERS_FILE" || {
    log "ERROR" "Sudoers syntax check failed — removing '$SUDOERS_FILE'."
    rm -f "$SUDOERS_FILE"
    exit 1
}
log "INFO" "Sudo access granted to '$USERNAME' via $SUDOERS_FILE."

# ── Summary ──────────────────────────────────────────────────────────────────
log "INFO" "=== Provisioning complete for '$USERNAME' ==="
echo ""
echo "Verification:"
id "$USERNAME"
echo "Sudoers file: $SUDOERS_FILE"
grep "$USERNAME" /etc/passwd
