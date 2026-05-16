/* main.js — Bash Automation Toolkit */
'use strict';

// ── Year ──────────────────────────────────────────────────────
document.getElementById('year').textContent = new Date().getFullYear();

// ── Hero terminal ─────────────────────────────────────────────
const HERO_LINES = [
  { t: 'cmd',   v: 'ls scripts/' },
  { t: 'plain', v: 'backup.sh  disk_monitor.sh  service_health.sh' },
  { t: 'plain', v: 'system_report.sh  user_setup.sh' },
  { t: 'plain', v: '' },
  { t: 'cmd',   v: 'sudo ./scripts/service_health.sh' },
  { t: 'ok',    v: '[INFO] sshd     — RUNNING' },
  { t: 'warn',  v: '[WARN] nginx    — DOWN. Restarting...' },
  { t: 'ok',    v: '[INFO] nginx    — RESTARTED successfully.' },
  { t: 'ok',    v: '[INFO] firewalld — RUNNING' },
  { t: 'plain', v: '' },
  { t: 'cmd',   v: 'sudo ./scripts/disk_monitor.sh' },
  { t: 'ok',    v: '[INFO] OK:     / (/dev/sda1) — 43% used' },
  { t: 'warn',  v: '[WARN] ALERT:  /var (/dev/sda3) — 83% used' },
  { t: 'ok',    v: '[INFO] OK:     /boot — 31% used' },
];

// ── Terminal renderer ─────────────────────────────────────────
function lineClass(type) {
  const map = { cmd: 'tline-cmd', info: 'tline-info', ok: 'tline-ok',
    warn: 'tline-warn', err: 'tline-err', plain: 'tline-plain',
    border: 'tline-border', label: 'tline-label' };
  return map[type] || 'tline-plain';
}

function createLineEl(line) {
  const el = document.createElement('span');
  el.className = 'tline ' + lineClass(line.t);
  el.textContent = line.v;
  return el;
}

function runTerminal(container, lines, { charDelay = 18, lineDelay = 90, initialDelay = 0 } = {}) {
  container.innerHTML = '';
  let timeouts = [];

  function clear() { timeouts.forEach(clearTimeout); timeouts = []; }

  function schedule(fn, delay) {
    const id = setTimeout(fn, delay);
    timeouts.push(id);
    return id;
  }

  let cursor = document.createElement('span');
  cursor.className = 'cursor';
  container.appendChild(cursor);

  let elapsed = initialDelay;

  lines.forEach((line, li) => {
    schedule(() => {
      const el = createLineEl({ t: line.t, v: '' });
      container.insertBefore(el, cursor);

      if (line.t === 'cmd' && line.v.length > 0) {
        // Typewriter for command lines
        let i = 0;
        function typeChar() {
          if (i < line.v.length) {
            el.textContent = line.v.slice(0, ++i);
            const id = setTimeout(typeChar, charDelay);
            timeouts.push(id);
          } else {
            el.textContent = line.v + '\n';
          }
        }
        typeChar();
      } else {
        el.textContent = line.v + '\n';
      }

      // Auto-scroll
      container.scrollTop = container.scrollHeight;
    }, elapsed);

    const typeDuration = line.t === 'cmd' ? line.v.length * charDelay : 0;
    elapsed += typeDuration + lineDelay;
  });

  // Remove cursor after all lines
  schedule(() => { if (cursor.parentNode) cursor.remove(); }, elapsed + 200);

  return { clear };
}

// ── Hero terminal ─────────────────────────────────────────────
const heroTerm = document.getElementById('heroTerm');
if (heroTerm) {
  runTerminal(heroTerm, HERO_LINES, { charDelay: 25, lineDelay: 110, initialDelay: 600 });
}

// ── Script card terminals ─────────────────────────────────────
const cardTerminals = new Map(); // el → { clear }

document.querySelectorAll('.script-card .term-body[data-lines]').forEach(el => {
  let lines;
  try { lines = JSON.parse(el.dataset.lines); } catch { return; }

  function start(delay = 0) {
    const prev = cardTerminals.get(el);
    if (prev) prev.clear();
    const handle = runTerminal(el, lines, { charDelay: 20, lineDelay: 80, initialDelay: delay });
    cardTerminals.set(el, handle);
  }

  // Intersection observer — trigger once on first scroll-into-view
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        start(100);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  obs.observe(el.closest('.script-card'));

  // Replay button
  const replayBtn = el.closest('.term-wrap').querySelector('.term-replay');
  if (replayBtn) replayBtn.addEventListener('click', () => start(0));
});

// ── Scroll reveal ─────────────────────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      const delay = (parseInt(entry.target.dataset.index || '0', 10) % 4) * 60;
      setTimeout(() => entry.target.classList.add('revealed'), delay);
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.script-card, .std-card').forEach(el => revealObs.observe(el));

// ── Copy command buttons ──────────────────────────────────────
const toast = document.getElementById('toast');
let toastTimer;

function showToast(msg = 'Copied!') {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function copyText(text) {
  const plain = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(plain).then(() => showToast()).catch(() => fallbackCopy(plain));
  } else {
    fallbackCopy(plain);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:-999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast(); } catch { /* silent */ }
  document.body.removeChild(ta);
}

document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.previousElementSibling;
    const text = cmd?.dataset?.copy || cmd?.textContent || '';
    copyText(text);
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1800);
  });
});

// Copy-all cron
document.getElementById('copyAllCron')?.addEventListener('click', () => {
  const text = document.getElementById('cronContent')?.textContent || '';
  copyText(text);
});

// ── Colorize cron comments ─────────────────────────────────────
const cronPre = document.getElementById('cronContent');
if (cronPre) {
  const html = cronPre.textContent
    .split('\n')
    .map(line => line.startsWith('#')
      ? `<span style="color:var(--m3)">${escHtml(line)}</span>`
      : escHtml(line))
    .join('\n');
  cronPre.innerHTML = html;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Install step copy buttons ─────────────────────────────────
document.querySelectorAll('.step-copy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const pre = document.getElementById(btn.dataset.target);
    if (!pre) return;
    const text = pre.textContent.replace(/^#.*\n/gm, '').trim();
    copyText(text);
  });
});

// ── Scroll-spy: highlight active nav link ─────────────────────
const sections = [
  { id: 'install',    link: document.querySelector('.nav-link[href="#install"]') },
  { id: 'scripts',    link: document.querySelector('.nav-link[href="#scripts"]') },
  { id: 'docs',       link: document.querySelector('.nav-link[href="#docs"]') },
  { id: 'cron',       link: document.querySelector('.nav-link[href="#cron"]') },
  { id: 'playground', link: document.querySelector('.nav-link[href="#playground"]') },
];

const spyObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const sec = sections.find(s => s.id === entry.target.id);
    if (!sec || !sec.link) return;
    if (entry.isIntersecting) sec.link.classList.add('active');
    else sec.link.classList.remove('active');
  });
}, { threshold: 0.25 });

sections.forEach(s => {
  const el = document.getElementById(s.id);
  if (el) spyObs.observe(el);
});

// ── Script Reference (Deep Dive) data ────────────────────────
const DEEP_DOCS = {
  user_setup: {
    badge: '01', name: 'user_setup.sh', tag: 'User Provisioning',
    synopsis: 'sudo ./scripts/user_setup.sh <username> <groupname>',
    summary: 'Idempotent user provisioning script. Creates a Linux user, assigns a primary group, sets an interactive password, enforces first-login change, and installs a validated per-user sudoers drop-in — all in a single atomic operation with structured logging.',
    args: [
      { name: '<username>', req: true, pattern: '^[a-z][a-z0-9_-]{0,31}$', desc: 'New Linux user to create. Must begin with a lowercase letter. Accepts a–z, 0–9, underscore, hyphen. Maximum 32 characters.' },
      { name: '<groupname>', req: true, pattern: '^[a-z][a-z0-9_-]{0,31}$', desc: 'Primary group for the user. Created with groupadd if it does not already exist. Same character rules as username.' },
    ],
    configVars: [
      { name: 'LOG_FILE', default: '/var/log/user_setup.log', desc: 'Destination for all structured log output.' },
      { name: 'SUDOERS_DIR', default: '/etc/sudoers.d', desc: 'Directory for per-user sudoers drops. Must pre-exist on the system.' },
    ],
    behaviors: [
      'Root enforcement via <code>[[ $EUID -eq 0 ]]</code> — exits immediately if not running as root.',
      'Validates exactly 2 arguments are present; prints usage and exits if not.',
      'Validates username against <code>^[a-z][a-z0-9_-]{0,31}$</code> — rejects uppercase, numeric-first, or names exceeding 32 chars.',
      'Validates groupname against the same regex as username.',
      'Blocks 13 reserved system accounts: <code>root bin daemon adm lp sync shutdown halt mail news uucp operator games</code>.',
      'Group creation: <code>getent group</code> check first — creates with <code>groupadd</code> only if absent; logs "already exists" otherwise.',
      'User creation (new): <code>useradd --gid &lt;group&gt; --create-home --shell /bin/bash --comment "Provisioned by user_setup.sh"</code>.',
      'User update (existing): only appends to group with <code>usermod -aG</code> — no destructive changes to existing account.',
      'Password: prompts interactively via <code>passwd "$USERNAME"</code> — never generates, stores, or logs a default password.',
      'First-login enforcement: <code>chage -d 0 "$USERNAME"</code> — user must change password at next login.',
      'Sudoers file: writes <code>/etc/sudoers.d/&lt;username&gt;</code> granting <code>ALL=(ALL) ALL</code> with permission <code>0440</code>.',
      'Sudoers validation: <code>visudo -cf "$SUDOERS_FILE"</code> — if syntax check fails, removes the file and exits 1.',
      'Verification output: prints <code>id</code> result and <code>/etc/passwd</code> entry for the new user.',
      'ERR trap: catches any unexpected failure, logs line number and exit code, then terminates.',
    ],
    exitCodes: [
      { code: 0, label: 'Success', cls: 'ec0', desc: 'User and group created or updated; password set; first-login change enforced; sudoers installed and validated.' },
      { code: 1, label: 'Error', cls: 'ec1', desc: 'Any failure: wrong argument count, invalid names, reserved account, groupadd/useradd/passwd/visudo error, or ERR trap.' },
    ],
    logFile: '/var/log/user_setup.log',
    logSample: [
      { cls: 'ls-info', v: '2026-05-16 14:23:01 [INFO] Group \'portteam\' created.' },
      { cls: 'ls-info', v: '2026-05-16 14:23:01 [INFO] User \'devops\' created with home directory.' },
      { cls: 'ls-info', v: '2026-05-16 14:23:09 [INFO] Password set for \'devops\'; first-login change enforced.' },
      { cls: 'ls-info', v: '2026-05-16 14:23:09 [INFO] Sudo access granted to \'devops\' via /etc/sudoers.d/devops.' },
      { cls: 'ls-ok',   v: '2026-05-16 14:23:09 [INFO] === Provisioning complete for \'devops\' ===' },
    ],
    cronSuggestion: null,
  },

  backup: {
    badge: '02', name: 'backup.sh', tag: 'Backup & Archive',
    synopsis: 'sudo ./scripts/backup.sh',
    summary: 'Zero-parameter backup script that archives /home and /etc into date-time-stamped gzip tarballs, verifies each archive\'s integrity, reports human-readable sizes, and prunes archives older than 7 days — all tracked by an error counter that informs the exit code.',
    args: [],
    configVars: [
      { name: 'BACKUP_DIR', default: '/backup', desc: 'Destination directory for archives. Created automatically with mkdir -p if absent.' },
      { name: 'LOG_FILE', default: '/var/log/backup.log', desc: 'Log file path. Stderr from tar is also appended here.' },
      { name: 'RETENTION_DAYS', default: '7', desc: 'Archives older than this many days are deleted by find -mtime +N -delete.' },
      { name: 'SOURCES', default: '(/home /etc)', desc: 'Bash array of source directories to archive. Add paths as needed.' },
    ],
    behaviors: [
      'Root enforcement: exits immediately if EUID ≠ 0.',
      'Source validation: each path in SOURCES array must exist as a directory; exits if any are missing.',
      'Destination creation: <code>mkdir -p "$BACKUP_DIR"</code> runs on every invocation.',
      'Disk space pre-check: reads available KB via <code>df -k</code>; requires ≥ 512,000 KB (500 MB) free before starting.',
      'Archive naming: <code>&lt;dirname&gt;_YYYY-MM-DD_HH-MM-SS.tar.gz</code> — multiple runs per day produce unique filenames.',
      'tar options: <code>--create --gzip --file --exclude=$BACKUP_DIR --exclude=/home/*/.cache --exclude=/home/*/.local/share/Trash --warning=no-file-changed</code>.',
      'Integrity check: <code>tar --test-label || tar -tzf</code> on each archive after creation — removes the file and counts error on failure.',
      'Human-readable sizes: custom <code>bytes_to_human()</code> function outputs KB, MB, or GB with 2 decimal places.',
      'Error counter: ERRORS variable tracks partial failures — a single bad archive does not abort remaining backups.',
      'Retention cleanup: <code>find "$BACKUP_DIR" -maxdepth 1 -name "*.tar.gz" -mtime +"$RETENTION_DAYS" -print -delete</code>.',
      'ERR trap: logs failed line number and exits 1 on any unhandled error.',
      'Idempotent naming: each run uses current timestamp so re-runs create new files (no overwrite).',
    ],
    exitCodes: [
      { code: 0, label: 'Success', cls: 'ec0', desc: 'All archives created and integrity-verified. Retention cleanup completed.' },
      { code: 1, label: 'Error', cls: 'ec1', desc: 'One or more archives failed, integrity check failed, insufficient disk space, or ERR trap triggered.' },
    ],
    logFile: '/var/log/backup.log',
    logSample: [
      { cls: 'ls-info', v: '2026-05-16 02:00:01 [INFO] Available: 48.3 GB — sufficient (need 500 MB minimum).' },
      { cls: 'ls-info', v: '2026-05-16 02:00:01 [INFO] Backing up \'/home\' → \'/backup/home_2026-05-16_02-00-01.tar.gz\' ...' },
      { cls: 'ls-ok',   v: '2026-05-16 02:00:04 [INFO] SUCCESS — \'/home\' backed up. Archive: home_2026-05-16_02-00-01.tar.gz | Size: 142.37 MB' },
      { cls: 'ls-info', v: '2026-05-16 02:00:04 [INFO] Backing up \'/etc\' → \'/backup/etc_2026-05-16_02-00-04.tar.gz\' ...' },
      { cls: 'ls-ok',   v: '2026-05-16 02:00:05 [INFO] SUCCESS — \'/etc\' backed up. Archive: etc_2026-05-16_02-00-04.tar.gz | Size: 8.21 MB' },
      { cls: 'ls-info', v: '2026-05-16 02:00:05 [INFO] Removing backups older than 7 days from \'/backup\' ...' },
      { cls: 'ls-ok',   v: '2026-05-16 02:00:05 [INFO] === Backup completed successfully ===' },
    ],
    cronSuggestion: '0 2 * * * /opt/bash-automation-toolkit/scripts/backup.sh',
  },

  disk_monitor: {
    badge: '03', name: 'disk_monitor.sh', tag: 'Disk Alerting',
    synopsis: 'sudo ./scripts/disk_monitor.sh',
    summary: 'Scans all real mounted filesystems and reports usage per partition at three severity levels: INFO (normal), WARN (≥80%), and CRITICAL (≥95%). Produces Nagios/Zabbix-compatible exit codes 0/1/2 for direct integration with external monitoring systems.',
    args: [],
    configVars: [
      { name: 'ALERT_LOG', default: '/var/log/disk_alert.log', desc: 'Log file for all disk check output.' },
      { name: 'THRESHOLD', default: '80', desc: 'Percentage at which a partition triggers a WARN log entry and exit code 1.' },
      { name: 'CRITICAL_THRESHOLD', default: '95', desc: 'Percentage at which a partition triggers a CRITICAL log entry and exit code 2.' },
      { name: 'EXCLUDE_TYPES', default: '(tmpfs devtmpfs sysfs proc ...)', desc: 'Array of 19 pseudo filesystem types passed as df -x flags. Prevents false alerts from virtual mounts.' },
    ],
    behaviors: [
      'Root enforcement: exits if EUID ≠ 0.',
      'Exclusion list: 19 pseudo/virtual filesystem types excluded — <code>tmpfs devtmpfs sysfs proc cgroup cgroup2 pstore bpf hugetlbfs mqueue debugfs tracefs securityfs configfs fusectl efivarfs autofs overlay squashfs</code>.',
      'Additional exclusions via grep: <code>/dev/loop*</code>, <code>none</code>, and <code>udev</code> devices are filtered out.',
      'df output format: <code>--output=source,size,used,avail,pcent,target</code> for structured field parsing.',
      'Per-partition awk parsing: extracts filesystem, used%, mount point, size, used, and available from each df line.',
      'Non-numeric guard: skips any line where use% is not a pure integer (prevents errors on unusual mount entries).',
      'CRITICAL if use% ≥ CRITICAL_THRESHOLD (95): logs <code>[CRITICAL]</code> and increments both ALERTS and CRITICAL counters.',
      'WARN if use% ≥ THRESHOLD (80): logs <code>[WARN]</code> and increments ALERTS counter.',
      'INFO if use% is below threshold: logs <code>[INFO] OK:</code> with full partition stats.',
      'Each log line includes: level, prefix (OK/ALERT/CRITICAL), mount point, device, percent used, size, used, available.',
      'ERR trap catches unexpected script failures and prints the line number.',
    ],
    exitCodes: [
      { code: 0, label: 'All clear', cls: 'ec0', desc: 'All partitions are within normal usage range. Safe for Nagios OK state.' },
      { code: 1, label: 'Warning', cls: 'ec1', desc: 'One or more partitions ≥ 80% but below 95%. Nagios WARNING state.' },
      { code: 2, label: 'Critical', cls: 'ec2', desc: 'One or more partitions ≥ 95%. Nagios CRITICAL state — immediate action required.' },
    ],
    logFile: '/var/log/disk_alert.log',
    logSample: [
      { cls: 'ls-info', v: '2026-05-16 10:30:01 [INFO    ] === Disk usage check started (threshold: 80%, critical: 95%) ===' },
      { cls: 'ls-ok',   v: '2026-05-16 10:30:01 [INFO    ] OK:       / (/dev/sda1) — 43% used | Size:50G Used:21G Avail:26G' },
      { cls: 'ls-warn', v: '2026-05-16 10:30:01 [WARN    ] ALERT:    /var (/dev/sda3) — 83% used | Size:20G Used:16G Avail:3G' },
      { cls: 'ls-ok',   v: '2026-05-16 10:30:01 [INFO    ] OK:       /boot (/dev/sda2) — 31% used | Size:1.0G Used:312M Avail:712M' },
      { cls: 'ls-warn', v: '2026-05-16 10:30:01 [WARN    ] === Check complete — 1 partition(s) above 80% threshold ===' },
    ],
    cronSuggestion: '*/30 * * * * /opt/bash-automation-toolkit/scripts/disk_monitor.sh',
  },

  service_health: {
    badge: '04', name: 'service_health.sh', tag: 'Service Watchdog',
    synopsis: 'sudo ./scripts/service_health.sh',
    summary: 'Monitors a configurable list of systemd services. On failure: captures pre-restart diagnostic output, restarts the service, waits for settle time, verifies recovery, re-enables the unit if it was disabled, and reports full counters in the summary line.',
    args: [],
    configVars: [
      { name: 'HEALTH_LOG', default: '/var/log/service_health.log', desc: 'Log file for health check results and pre-restart diagnostic dumps.' },
      { name: 'SERVICES', default: '(sshd nginx firewalld)', desc: 'Bash array of service names to monitor. Add or remove entries to match your stack.' },
    ],
    behaviors: [
      'Root enforcement: exits if EUID ≠ 0.',
      '<code>service_exists()</code>: queries <code>systemctl list-unit-files --type=service</code> — skips services not installed on this host with a WARN log.',
      '<code>is_active()</code>: uses <code>systemctl is-active --quiet</code> — returns true/false for clean conditional logic.',
      '<code>is_enabled()</code>: uses <code>systemctl is-enabled --quiet</code> with stderr suppressed — handles masked/static units gracefully.',
      'Healthy path: logs <code>[INFO] &lt;service&gt; — RUNNING</code> and moves on.',
      'Failed path step 1: increments FAILURES counter; logs WARN.',
      'Failed path step 2: captures <code>systemctl status --no-pager --lines=5</code> output and appends to log file for post-mortem.',
      'Failed path step 3: runs <code>systemctl start "$SERVICE"</code>; appends any stderr to log.',
      'Failed path step 4: <code>sleep 3</code> settle time to allow the process to fully start before re-checking.',
      'Failed path step 5: re-runs <code>is_active()</code> check — logs RESTARTED and increments RESTARTED counter on success.',
      'Boot persistence: if service was disabled, automatically runs <code>systemctl enable</code> and logs the action.',
      'Persistent failure: logs <code>[ERROR]</code> with 10-line status dump and a journalctl hint: <code>journalctl -u &lt;service&gt; -n 50</code>.',
      'Summary line: always logs Failures and Restarted counts regardless of outcome.',
    ],
    exitCodes: [
      { code: 0, label: 'All healthy', cls: 'ec0', desc: 'All monitored services were running (or not installed). No restarts needed.' },
      { code: 1, label: 'Failure(s)', cls: 'ec1', desc: 'One or more services were found down at check time. Restart may or may not have succeeded.' },
    ],
    logFile: '/var/log/service_health.log',
    logSample: [
      { cls: 'ls-info', v: '2026-05-16 10:05:01 [INFO] === Service health check started (3 services) ===' },
      { cls: 'ls-ok',   v: '2026-05-16 10:05:01 [INFO] sshd — RUNNING' },
      { cls: 'ls-warn', v: '2026-05-16 10:05:01 [WARN] nginx — DOWN. Attempting restart...' },
      { cls: 'ls-info', v: '2026-05-16 10:05:01 [INFO] Pre-restart status for nginx:' },
      { cls: 'ls-ok',   v: '2026-05-16 10:05:05 [INFO] nginx — RESTARTED successfully.' },
      { cls: 'ls-ok',   v: '2026-05-16 10:05:05 [INFO] firewalld — RUNNING' },
      { cls: 'ls-warn', v: '2026-05-16 10:05:05 [INFO] === Health check complete — Failures: 1 | Restarted: 1 ===' },
    ],
    cronSuggestion: '*/5 * * * * /opt/bash-automation-toolkit/scripts/service_health.sh',
  },

  system_report: {
    badge: '05', name: 'system_report.sh', tag: 'Daily System Report',
    synopsis: 'sudo ./scripts/system_report.sh',
    summary: 'Generates a comprehensive 10-section system snapshot. Reads live data from /proc, systemd, and system commands. Tees output simultaneously to stdout and a date-stamped file under /root/reports/. Old reports auto-pruned after 30 days. Idempotent — re-running today overwrites today\'s report.',
    args: [],
    configVars: [
      { name: 'REPORT_DIR', default: '/root/reports', desc: 'Directory for saved report files. Created automatically.' },
      { name: 'RETENTION_DAYS', default: '30', desc: 'Reports older than this many days are deleted on each run.' },
    ],
    behaviors: [
      'Root enforcement: exits if EUID ≠ 0.',
      'Report directory: <code>mkdir -p "$REPORT_DIR"</code> ensures path exists.',
      'Idempotent start: <code>: &gt; "$REPORT_FILE"</code> truncates any existing report for today before regenerating.',
      '<strong>Section 1 — Identity</strong>: <code>hostname -f</code>, <code>/etc/os-release PRETTY_NAME</code>, <code>uname -r</code> (kernel), <code>uname -m</code> (arch).',
      '<strong>Section 2 — Uptime &amp; Load</strong>: <code>uptime -p</code>, load averages from <code>/proc/loadavg</code> (1m/5m/15m fields), CPU core count via <code>nproc</code>.',
      '<strong>Section 3 — CPU Usage</strong>: reads <code>/proc/stat</code> twice with a 1-second <code>sleep 1</code> between samples. Computes <code>(TOTAL_DIFF - IDLE_DIFF) / TOTAL_DIFF × 100</code> for a live percentage. Also shows top 5 CPU consumers via <code>ps axo pid,user,pcpu,comm --sort=-pcpu</code>.',
      '<strong>Section 4 — Memory</strong>: <code>free -h</code> for formatted table. Reads <code>/proc/meminfo</code> MemTotal and MemAvailable for precise KB values and usage percentage.',
      '<strong>Section 5 — Disk Usage</strong>: <code>df -hT -x tmpfs -x devtmpfs -x squashfs</code> with grep to remove loop/udev/none devices.',
      '<strong>Section 6 — Network Interfaces</strong>: <code>ip -brief address show</code> with fallback to <code>ip addr show</code>.',
      '<strong>Section 7 — Logged-in Users</strong>: <code>who -a</code> with fallback to <code>w</code>. Counts active sessions with <code>who | wc -l</code>.',
      '<strong>Section 8 — Failed Logins</strong>: <code>lastb -n 5</code> if <code>/var/log/btmp</code> is readable; falls back to journald SSH auth failures from the last 24h.',
      '<strong>Section 9 — Critical Services</strong>: checks sshd, nginx, firewalld, and chronyd via <code>systemctl is-active</code>. Prints <code>not installed</code> for absent units.',
      '<strong>Section 10 — System Errors</strong>: <code>journalctl -p err..emerg --no-pager --since="24 hours ago" --output=short-iso | tail -15</code>.',
      'Output method: entire report generated inside <code>{ ... } | tee "$REPORT_FILE"</code> — simultaneous stdout and file write.',
      'Retention: <code>find "$REPORT_DIR" -maxdepth 1 -name "report_*.txt" -mtime +"$RETENTION_DAYS" -delete</code> on every run.',
      'ERR trap: prints failing line number on any unexpected error.',
    ],
    exitCodes: [
      { code: 0, label: 'Success', cls: 'ec0', desc: 'Report generated and saved. Always exits 0 unless the ERR trap fires on an unexpected failure.' },
    ],
    logFile: '/root/reports/report_YYYY-MM-DD.txt',
    logSample: [
      { cls: '',        v: '╔══════════════════════════════════════════════════════════╗' },
      { cls: '',        v: '║           DAILY SYSTEM REPORT — 2026-05-16              ║' },
      { cls: '',        v: '╚══════════════════════════════════════════════════════════╝' },
      { cls: 'ls-info', v: 'Generated: 2026-05-16 06:00:02' },
      { cls: '',        v: '' },
      { cls: 'ls-ok',   v: '══  SYSTEM IDENTITY  ══' },
      { cls: 'ls-info', v: 'Hostname      : rhel9-server.lab.local' },
      { cls: 'ls-info', v: 'OS            : Red Hat Enterprise Linux 9.4 (Plow)' },
      { cls: 'ls-info', v: 'Kernel        : 5.14.0-427.el9.x86_64' },
      { cls: 'ls-ok',   v: 'Report saved  : /root/reports/report_2026-05-16.txt' },
    ],
    cronSuggestion: '0 6 * * * /opt/bash-automation-toolkit/scripts/system_report.sh',
  },
};

// ── Deep Dive Renderer ────────────────────────────────────────
function renderDeepDoc(key) {
  const doc = DEEP_DOCS[key];
  if (!doc) return;
  const panel = document.getElementById('deepPanel');
  if (!panel) return;

  const argsHtml = doc.args.length ? `
    <div class="deep-group">
      <div class="deep-group-title">Arguments</div>
      <table class="deep-table">
        <thead>
          <tr>
            <th>Argument</th>
            <th>Required</th>
            <th>Pattern / Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${doc.args.map(a => `
            <tr>
              <td>${escHtml(a.name)}</td>
              <td><span class="td-req yes">required</span></td>
              <td class="td-pattern">${escHtml(a.pattern)}</td>
              <td>${a.desc}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>` : '';

  const configHtml = doc.configVars.length ? `
    <div class="deep-group">
      <div class="deep-group-title">Configurable Variables</div>
      <table class="deep-table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${doc.configVars.map(v => `
            <tr>
              <td>${escHtml(v.name)}</td>
              <td class="td-default">${escHtml(v.default)}</td>
              <td>${v.desc}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>` : '';

  const behaviorsHtml = `
    <div class="deep-group">
      <div class="deep-group-title">Behavior — Step by Step</div>
      <ol class="deep-behaviors">
        ${doc.behaviors.map((b, i) => `
          <li class="deep-behavior">
            <span class="deep-bnum">${String(i + 1).padStart(2, '0')}</span>
            <span>${b}</span>
          </li>
        `).join('')}
      </ol>
    </div>`;

  const exitHtml = `
    <div class="deep-group">
      <div class="deep-group-title">Exit Codes</div>
      <div class="exit-rows">
        ${doc.exitCodes.map(e => `
          <div class="exit-row">
            <span class="exit-code ${e.cls}">${e.code}</span>
            <span class="exit-label ${e.cls}">${escHtml(e.label)}</span>
            <span class="exit-desc">${escHtml(e.desc)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;

  const logSampleHtml = doc.logSample.map(l =>
    l.cls ? `<span class="${l.cls}">${escHtml(l.v)}</span>` : escHtml(l.v)
  ).join('\n');

  const cronHtml = doc.cronSuggestion ? `
    <div class="deep-group">
      <div class="deep-group-title">Recommended Cron Entry</div>
      <div class="step-code-wrap">
        <pre class="step-code" id="dc-cron-${key}">${escHtml(doc.cronSuggestion)}</pre>
        <button class="step-copy-btn" data-target="dc-cron-${key}" aria-label="Copy cron">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
    </div>` : '';

  const noArgsNote = !doc.args.length ? `
    <div class="deep-group">
      <div class="deep-group-title">Arguments</div>
      <p style="font-size:12.5px;color:var(--m2);padding:8px 0">No arguments — runs fully automated. All behavior is controlled by the configurable variables below.</p>
    </div>` : '';

  panel.innerHTML = `
    <div class="deep-panel-head">
      <div class="deep-head-top">
        <span class="deep-badge">${doc.badge}</span>
        <div>
          <div class="deep-name">${escHtml(doc.name)}</div>
          <div class="deep-tag">${escHtml(doc.tag)}</div>
        </div>
      </div>
      <p class="deep-summary">${doc.summary}</p>
      <div class="deep-synopsis-wrap">
        <span class="deep-synopsis-label">Synopsis</span>
        <code class="deep-synopsis" id="ds-${key}">${escHtml(doc.synopsis)}</code>
        <button class="deep-synopsis-copy step-copy-btn" data-target="ds-${key}" aria-label="Copy synopsis">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
    </div>
    <div class="deep-content">
      ${noArgsNote}
      ${argsHtml}
      ${configHtml}
      ${behaviorsHtml}
      ${exitHtml}
      <div class="deep-group">
        <div class="deep-group-title">Log File &amp; Sample Output</div>
        <div class="log-path">${escHtml(doc.logFile)}</div>
        <div class="log-sample">${logSampleHtml}</div>
      </div>
      ${cronHtml}
    </div>`;

  // Wire new copy buttons inside the panel
  panel.querySelectorAll('.step-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      const text = target ? target.textContent.trim() : '';
      copyText(text);
    });
  });
}

// ── Deep Dive tab switching ───────────────────────────────────
const deepNavBtns = document.querySelectorAll('.deep-nav-btn');
let activeDoc = 'user_setup';

deepNavBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    deepNavBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeDoc = btn.dataset.doc;
    renderDeepDoc(activeDoc);
  });
});

renderDeepDoc(activeDoc);
