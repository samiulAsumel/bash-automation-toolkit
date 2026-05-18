# Bash Automation Toolkit

![ShellCheck](https://img.shields.io/badge/ShellCheck-passing-22c55e?logo=gnubash&logoColor=white)
![Bash](https://img.shields.io/badge/Bash-5.x-4EAA25?logo=gnubash&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-RHEL%209-EE0000?logo=redhat&logoColor=white)
![Strict Mode](https://img.shields.io/badge/set%20-euo%20pipefail-informational)
![License](https://img.shields.io/badge/License-MIT-blue)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-22c55e)](https://samiulAsumel.github.io/bash-automation-toolkit)

Production-grade Bash scripts for RHEL 9 systems administration — user provisioning, automated backups, disk monitoring, service health watchdog, and daily system reporting. Each script ships with `set -euo pipefail`, `trap ERR` with line-number reporting, structured `[INFO|WARN|ERROR|CRITICAL]` logging, and Nagios/Zabbix-compatible exit codes.

**[→ Interactive Demo & Documentation](https://samiulAsumel.github.io/bash-automation-toolkit)**

---

## Table of Contents

- [Requirements](#requirements)
- [Quick Install](#quick-install)
- [Scripts](#scripts)
  - [user_setup.sh](#1-user_setupsh--user-provisioning)
  - [backup.sh](#2-backupsh--backup--archive)
  - [disk_monitor.sh](#3-disk_monitorsh--disk-alerting)
  - [service_health.sh](#4-service_healthsh--service-watchdog)
  - [system_report.sh](#5-system_reportsh--daily-system-report)
- [Cron Schedule](#cron-schedule)
- [Log Reference](#log-reference)
- [Security](#security)
- [License](#license)

---

## Requirements

| Requirement | Detail |
|---|---|
| OS | RHEL 9 / CentOS Stream 9 / Rocky Linux 9 / AlmaLinux 9 |
| Shell | Bash 5.x |
| Privileges | Root (`sudo`) required for all scripts |
| Tools | `tar`, `df`, `systemctl`, `journalctl`, `useradd`, `visudo`, `bc`, `lastb` — all standard on RHEL 9 |

---

## Quick Install

```bash
# Clone to a system-wide location accessible by root
git clone https://github.com/samiulAsumel/bash-automation-toolkit.git \
  /opt/bash-automation-toolkit

# Set execute bits and lock ownership to root
cd /opt/bash-automation-toolkit
chmod +x scripts/*.sh
chown -R root:root scripts/

# Verify all scripts pass ShellCheck (0.9.0+)
shellcheck scripts/*.sh
# Expected: No issues found.

# Run a quick sanity check
sudo ./scripts/service_health.sh
# Expected: [INFO] === Health check complete — Failures: 0 ===
```

---

## Scripts

### 1. `user_setup.sh` — User Provisioning

Creates a Linux user with a primary group, sets an interactive password, enforces a first-login password change via `chage -d 0`, and installs a per-user sudoers drop-in validated by `visudo -cf` before activation. Idempotent: if the user already exists, only group membership is updated; no destructive changes are made.

**Usage:**
```bash
sudo ./scripts/user_setup.sh <username> <groupname>
```

**Example:**
```bash
sudo ./scripts/user_setup.sh devops portteam
```

**Sample output:**
```
2026-05-16 14:23:01 [INFO] Group 'portteam' created.
2026-05-16 14:23:01 [INFO] User 'devops' created with home directory.
Set password for 'devops':
passwd: all authentication tokens updated successfully.
2026-05-16 14:23:09 [INFO] Password set for 'devops'; first-login change enforced.
2026-05-16 14:23:09 [INFO] Sudo access granted to 'devops' via /etc/sudoers.d/devops.
2026-05-16 14:23:09 [INFO] === Provisioning complete for 'devops' ===

Verification:
uid=1001(devops) gid=1001(portteam) groups=1001(portteam)
```

**Key behaviours:**
- Validates username/groupname against `^[a-z][a-z0-9_-]{0,31}$`
- Blocks 13 reserved system accounts (`root`, `bin`, `daemon`, `adm`, `lp`, `sync`, `shutdown`, `halt`, `mail`, `news`, `uucp`, `operator`, `games`)
- Writes `0440`-mode sudoers drop-in to `/etc/sudoers.d/<username>`; removes and exits 1 if `visudo -cf` fails
- Passwords are never generated, stored, or logged — interactive `passwd` prompt only

**Exit codes:** `0` success · `1` any failure

---

### 2. `backup.sh` — Backup & Archive

Archives `/home` and `/etc` into date-time-stamped `.tar.gz` files under `/backup/`. After each archive, runs an integrity check with `tar -tzf`; any corrupt archive is deleted and counted as an error (remaining archives still proceed). Prunes archives older than 7 days on every run.

**Usage:**
```bash
sudo ./scripts/backup.sh
```

**Sample output:**
```
2026-05-16 02:00:01 [INFO] Available: 48.3 GB — sufficient (need 500 MB minimum).
2026-05-16 02:00:01 [INFO] Backing up '/home' → '/backup/home_2026-05-16_02-00-01.tar.gz' ...
2026-05-16 02:00:04 [INFO] SUCCESS — '/home' backed up. Archive: home_2026-05-16_02-00-01.tar.gz | Size: 142.37 MB
2026-05-16 02:00:04 [INFO] Backing up '/etc' → '/backup/etc_2026-05-16_02-00-04.tar.gz' ...
2026-05-16 02:00:05 [INFO] SUCCESS — '/etc' backed up. Archive: etc_2026-05-16_02-00-04.tar.gz | Size: 8.21 MB
2026-05-16 02:00:05 [INFO] Removing backups older than 7 days from '/backup/' ...
2026-05-16 02:00:05 [INFO] === Backup completed successfully ===
```

**Configurable variables** (top of script):

| Variable | Default | Description |
|---|---|---|
| `BACKUP_DIR` | `/backup` | Archive destination; created automatically |
| `RETENTION_DAYS` | `7` | Auto-prune archives older than N days |
| `SOURCES` | `(/home /etc)` | Bash array of directories to archive |

**Exit codes:** `0` all archives created and verified · `1` any archive failed or insufficient disk space

---

### 3. `disk_monitor.sh` — Disk Alerting

Scans all real mounted partitions, excluding 19 pseudo-filesystem types (`tmpfs`, `devtmpfs`, `sysfs`, `proc`, …) and loop/udev/none devices. Logs `OK`, `WARN`, or `CRITICAL` per partition with full size stats. Returns Nagios/Zabbix-compatible exit codes for direct monitoring integration.

**Usage:**
```bash
sudo ./scripts/disk_monitor.sh
```

**Sample output:**
```
2026-05-16 09:30:00 [INFO    ] === Disk usage check started (threshold: 80%, critical: 95%) ===
2026-05-16 09:30:00 [INFO    ] OK:       / (/dev/sda1) — 43% used | Size:50G Used:21G Avail:26G
2026-05-16 09:30:00 [WARN    ] ALERT:    /var (/dev/sda3) — 83% used | Size:20G Used:16G Avail:3.4G
2026-05-16 09:30:00 [INFO    ] OK:       /boot (/dev/sda2) — 31% used | Size:1.0G Used:312M Avail:712M
2026-05-16 09:30:00 [WARN    ] === Check complete — 1 partition(s) above 80% threshold ===
```

**Configurable variables:**

| Variable | Default | Description |
|---|---|---|
| `THRESHOLD` | `80` | WARN level (%) |
| `CRITICAL_THRESHOLD` | `95` | CRITICAL level (%) |
| `ALERT_LOG` | `/var/log/disk_alert.log` | Log destination |

**Exit codes:** `0` all clear · `1` ≥ 1 partition at WARN · `2` ≥ 1 partition at CRITICAL

---

### 4. `service_health.sh` — Service Watchdog

Monitors `sshd`, `nginx`, and `firewalld` via `systemctl is-active`. On failure: captures pre-restart `systemctl status` output for post-mortem, restarts the service, waits 3 seconds for settle, verifies recovery, and re-enables the unit if it was disabled (preventing repeat failures after reboot). Extend by adding names to the `SERVICES` array at the top of the script.

**Usage:**
```bash
sudo ./scripts/service_health.sh
```

**Sample output:**
```
2026-05-16 10:05:01 [INFO] === Service health check started (3 services) ===
2026-05-16 10:05:01 [INFO] sshd — RUNNING
2026-05-16 10:05:01 [WARN] nginx — DOWN. Attempting restart...
2026-05-16 10:05:04 [INFO] nginx — RESTARTED successfully.
2026-05-16 10:05:04 [INFO] firewalld — RUNNING
2026-05-16 10:05:04 [INFO] === Health check complete — Failures: 1 | Restarted: 1 ===
```

**Exit codes:** `0` all services healthy · `1` one or more services were found down

---

### 5. `system_report.sh` — Daily System Report

Generates a 10-section system health snapshot. Tees output simultaneously to stdout and `/root/reports/report_YYYY-MM-DD.txt`. Idempotent — re-running today overwrites today's report. Prunes reports older than 30 days on each run.

**Sections covered:**
1. System Identity (hostname, OS, kernel, arch)
2. Uptime & Load (uptime, 1/5/15-min load averages, CPU count)
3. CPU Usage (live 1-second sample from `/proc/stat`, top 5 consumers)
4. Memory (free -h, precise kB usage from `/proc/meminfo`)
5. Disk Usage (all real partitions)
6. Network Interfaces (`ip -brief address`)
7. Currently Logged-in Users
8. Last 5 Failed Login Attempts (`lastb` or journald fallback)
9. Critical Service Status (sshd, nginx, firewalld, chronyd)
10. Recent Kernel/System Errors (last 24 h via journald)

**Usage:**
```bash
sudo ./scripts/system_report.sh
```

**Exit codes:** `0` always · `1` only if ERR trap fires on an unexpected failure

---

## Cron Schedule

Edit with `sudo crontab -e` and add:

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

## Log Reference

| Script | Log Location | Format |
|---|---|---|
| `user_setup.sh` | `/var/log/user_setup.log` | `YYYY-MM-DD HH:MM:SS [LEVEL] message` |
| `backup.sh` | `/var/log/backup.log` | `YYYY-MM-DD HH:MM:SS [LEVEL] message` |
| `disk_monitor.sh` | `/var/log/disk_alert.log` | `YYYY-MM-DD HH:MM:SS [LEVEL] message` |
| `service_health.sh` | `/var/log/service_health.log` | `YYYY-MM-DD HH:MM:SS [LEVEL] message` |
| `system_report.sh` | `/root/reports/report_YYYY-MM-DD.txt` | Plain-text report |

---

## Security

- All scripts require root — never add SUID bits; use `sudo`
- `user_setup.sh` validates sudoers syntax with `visudo -cf` before activating; removes the file and exits if validation fails
- Passwords are never generated, stored, echoed, or logged — interactive `passwd` prompt only
- Backup archives exclude `.cache` and Trash directories to avoid sensitive session data
- Logs are append-only with ISO timestamps for forensic auditability
- All scripts validated with ShellCheck 0.9.0 — zero warnings

---

## Author

**Samiul** — Linux Systems Administrator · DevOps Engineer  
RHCSA (EX200) Candidate · AWS · Azure · RHEL 9  
[github.com/samiulAsumel](https://github.com/samiulAsumel)

---

## License

MIT — open source, free to use and modify.
