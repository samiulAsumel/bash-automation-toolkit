# Bash Automation Toolkit

Production-grade Bash scripts for Linux systems administration — user provisioning, automated backups, disk monitoring, service health checks, and daily system reporting. Written to RHEL 9 / CentOS Stream 9 standards with strict mode (`set -euo pipefail`), full error trapping, and structured logging throughout.

---

## Requirements

| Requirement | Detail |
|---|---|
| OS | RHEL 9 / CentOS Stream 9 / Rocky Linux 9 / AlmaLinux 9 |
| Shell | Bash 5.x |
| Privileges | Root (`sudo`) required for all scripts |
| Tools | `tar`, `df`, `systemctl`, `journalctl`, `useradd`, `visudo`, `bc`, `lastb` (standard on RHEL) |

---

## Directory Structure

```
bash-automation-toolkit/
└── scripts/
    ├── user_setup.sh       # User provisioning + sudo
    ├── backup.sh           # /home and /etc archival
    ├── disk_monitor.sh     # Disk threshold alerting
    ├── service_health.sh   # Service watchdog + auto-restart
    └── system_report.sh    # Daily system snapshot report
```

---

## Scripts

---

### Script 1 — `user_setup.sh`

Creates a new Linux user account with a primary group, home directory, and sudo privileges. It validates both the username and group name against safe naming rules (lowercase alphanumeric, max 32 chars), refuses to modify reserved system accounts, creates the group if it doesn't exist, forces a password change on first login for security, writes a per-user sudoers file to `/etc/sudoers.d/`, and validates it with `visudo` before activating. Every action is logged to `/var/log/user_setup.log`.

**Usage:**
```bash
sudo chmod +x scripts/user_setup.sh
sudo ./scripts/user_setup.sh <username> <groupname>
```

**Example:**
```bash
sudo ./scripts/user_setup.sh devops portteam
```

**Sample Output:**
```
2026-05-16 14:23:01 [INFO] Group 'portteam' created.
2026-05-16 14:23:01 [INFO] User 'devops' created with home directory.
Set password for 'devops':
New password:
Retype new password:
passwd: all authentication tokens updated successfully.
2026-05-16 14:23:09 [INFO] Password set for 'devops'; first-login change enforced.
2026-05-16 14:23:09 [INFO] Sudo access granted to 'devops' via /etc/sudoers.d/devops.
2026-05-16 14:23:09 [INFO] === Provisioning complete for 'devops' ===

Verification:
uid=1001(devops) gid=1001(portteam) groups=1001(portteam)
Sudoers file: /etc/sudoers.d/devops
devops:x:1001:1001:Provisioned by user_setup.sh:/home/devops:/bin/bash
```

**Verify it works:**
```bash
# Confirm user exists
id devops

# Confirm sudo works
su - devops -c "sudo whoami"

# Confirm it survives reboot
sudo reboot
id devops
```

---

### Script 2 — `backup.sh`

Archives `/home` and `/etc` into separate compressed `.tar.gz` files under `/backup/`, named with a full datetime stamp (e.g. `home_2026-05-16_02-00-01.tar.gz`). Before starting, it verifies at least 500 MB of free space is available on the backup partition. After each archive is created, it runs a tar integrity check; any corrupt archive is deleted and an error is logged. Backups older than 7 days are automatically pruned. All outcomes — success, failure, and cleanup — are appended to `/var/log/backup.log`.

**Usage:**
```bash
sudo chmod +x scripts/backup.sh
sudo ./scripts/backup.sh
```

**Sample Output:**
```
2026-05-16 02:00:01 [INFO] Backing up '/home' → '/backup/home_2026-05-16_02-00-01.tar.gz' ...
2026-05-16 02:00:04 [INFO] SUCCESS — '/home' backed up. Archive: home_2026-05-16_02-00-01.tar.gz | Size: 142.37 MB
2026-05-16 02:00:04 [INFO] Backing up '/etc' → '/backup/etc_2026-05-16_02-00-01.tar.gz' ...
2026-05-16 02:00:05 [INFO] SUCCESS — '/etc' backed up. Archive: etc_2026-05-16_02-00-01.tar.gz | Size: 8.21 MB
2026-05-16 02:00:05 [INFO] Removing backups older than 7 days from '/backup/' ...
2026-05-16 02:00:05 [INFO] === Backup completed successfully ===
```

**Add to cron (runs daily at 2:00 AM):**
```bash
sudo crontab -e
# Add:
0 2 * * * /path/to/bash-automation-toolkit/scripts/backup.sh
```

---

### Script 3 — `disk_monitor.sh`

Iterates over all real mounted partitions (automatically excluding pseudo-filesystems like `tmpfs`, `devtmpfs`, `squashfs`, and loop devices) and compares usage against two thresholds: **WARN at 80%** and **CRITICAL at 95%**. For each partition it logs a status line (`OK`, `WARN`, or `CRITICAL`) with filesystem name, mount point, size, used, and available space to `/var/log/disk_alert.log`. The script exits with code `0` (all clear), `1` (one or more partitions over the warn threshold), or `2` (one or more partitions in critical state) — making it suitable for monitoring integrations.

**Usage:**
```bash
sudo chmod +x scripts/disk_monitor.sh
sudo ./scripts/disk_monitor.sh
```

**Sample Output:**
```
2026-05-16 09:30:00 [INFO] === Disk usage check started (threshold: 80%, critical: 95%) ===
2026-05-16 09:30:00 [INFO] OK:       / (/dev/sda1) — 43% used | Size:50G Used:21G Avail:26G
2026-05-16 09:30:00 [WARN] ALERT:    /var (/dev/sda3) — 83% used | Size:20G Used:16G Avail:3.4G
2026-05-16 09:30:00 [INFO] OK:       /boot (/dev/sda2) — 31% used | Size:1.0G Used:312M Avail:712M
2026-05-16 09:30:00 [WARN] === Check complete — 1 partition(s) above 80% threshold ===
```

**Add to cron (every 30 minutes):**
```bash
sudo crontab -e
# Add:
*/30 * * * * /path/to/bash-automation-toolkit/scripts/disk_monitor.sh
```

---

### Script 4 — `service_health.sh`

Monitors `sshd`, `nginx`, and `firewalld` using `systemctl is-active`. If any service is found down, it captures the pre-failure status output for diagnostics, attempts a `systemctl start`, waits 3 seconds, then confirms recovery. If the service is also disabled (which would cause the outage to recur on reboot), it re-enables it automatically. Each event — healthy, restarted, or failed-to-restart — is logged with a full timestamp to `/var/log/service_health.log`. The services list is easily extended by adding names to the `SERVICES` array at the top of the script.

**Usage:**
```bash
sudo chmod +x scripts/service_health.sh
sudo ./scripts/service_health.sh
```

**Sample Output:**
```
2026-05-16 10:05:01 [INFO] === Service health check started (3 services) ===
2026-05-16 10:05:01 [INFO] sshd — RUNNING
2026-05-16 10:05:01 [WARN] nginx — DOWN. Attempting restart...
2026-05-16 10:05:04 [INFO] nginx — RESTARTED successfully.
2026-05-16 10:05:04 [INFO] firewalld — RUNNING
2026-05-16 10:05:04 [INFO] === Health check complete — Failures: 1 | Restarted: 1 ===
```

**Add to cron (every 5 minutes):**
```bash
sudo crontab -e
# Add:
*/5 * * * * /path/to/bash-automation-toolkit/scripts/service_health.sh
```

---

### Script 5 — `system_report.sh`

Generates a comprehensive daily system health snapshot covering: hostname, OS, and kernel identity; uptime and 1/5/15-minute load averages; a 1-second CPU usage sample with top 5 CPU consumers; memory usage via `/proc/meminfo`; disk usage across all real partitions; active network interfaces with IP addresses; currently logged-in users; the last 5 failed login attempts from `/var/log/btmp` (or journald as fallback); status of critical services (`sshd`, `nginx`, `firewalld`, `chronyd`); and recent kernel/system errors from journald. The report is saved to `/root/reports/report_YYYY-MM-DD.txt` and also printed to stdout. Reports older than 30 days are auto-pruned.

**Usage:**
```bash
sudo chmod +x scripts/system_report.sh
sudo ./scripts/system_report.sh
```

**Sample Output:**
```
╔══════════════════════════════════════════════════════════╗
║           DAILY SYSTEM REPORT — 2026-05-16           ║
╚══════════════════════════════════════════════════════════╝
Generated: 2026-05-16 06:00:01

══════════════════════════════════════════════════════════
  SYSTEM IDENTITY
══════════════════════════════════════════════════════════

Hostname      : rhel9-server.lab.local
OS            : Red Hat Enterprise Linux 9.4 (Plow)
Kernel        : 5.14.0-427.el9.x86_64
Architecture  : x86_64

══════════════════════════════════════════════════════════
  UPTIME & LOAD
══════════════════════════════════════════════════════════

up 3 days, 14 hours, 22 minutes
Load averages (1m / 5m / 15m): 0.12 / 0.08 / 0.05
CPU cores     : 4

══════════════════════════════════════════════════════════
  MEMORY USAGE
══════════════════════════════════════════════════════════

              total        used        free      shared  buff/cache   available
Mem:           7.6G        1.2G        4.9G         12M        1.4G        6.1G
Swap:          2.0G          0B        2.0G

══════════════════════════════════════════════════════════
  LAST 5 FAILED LOGIN ATTEMPTS
══════════════════════════════════════════════════════════

root     ssh:notty    203.0.113.45     Fri May 16 03:12:44 2026
admin    ssh:notty    198.51.100.22    Fri May 16 03:11:09 2026
...

Report saved  : /root/reports/report_2026-05-16.txt
```

**Add to cron (daily at 6:00 AM):**
```bash
sudo crontab -e
# Add:
0 6 * * * /path/to/bash-automation-toolkit/scripts/system_report.sh
```

---

## Making Scripts Executable

```bash
chmod +x scripts/*.sh
```

---

## Full Crontab Reference

Edit with `sudo crontab -e` and add all entries at once:

```cron
# Daily backup at 2:00 AM
0 2 * * * /opt/bash-automation-toolkit/scripts/backup.sh

# Disk check every 30 minutes
*/30 * * * * /opt/bash-automation-toolkit/scripts/disk_monitor.sh

# Service health check every 5 minutes
*/5 * * * * /opt/bash-automation-toolkit/scripts/service_health.sh

# Daily system report at 6:00 AM
0 6 * * * /opt/bash-automation-toolkit/scripts/system_report.sh
```

Verify cron is active:
```bash
sudo systemctl enable --now crond
sudo crontab -l
```

---

## Log File Reference

| Script | Log Location |
|---|---|
| `user_setup.sh` | `/var/log/user_setup.log` |
| `backup.sh` | `/var/log/backup.log` |
| `disk_monitor.sh` | `/var/log/disk_alert.log` |
| `service_health.sh` | `/var/log/service_health.log` |
| `system_report.sh` | `/root/reports/report_YYYY-MM-DD.txt` |

---

## Security Notes

- All scripts require root — never add SUID bits; use `sudo` instead
- `user_setup.sh` validates sudoers syntax with `visudo -cf` before activating
- Passwords are never stored or echoed in any script or log
- Backup archives exclude cache and trash directories to avoid storing sensitive session data
- Logs contain timestamps for forensic auditability

---

## Author

**Samiul** — Linux Systems Administrator | DevOps Engineer
RHCSA (EX200) Candidate | AWS & Azure | RHEL 9
