/* playground.js — Interactive script simulator, 100% frontend */
'use strict';

// ── Utilities ─────────────────────────────────────────────────
function nowTs() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min, max, dec = 2) {
  return (Math.random() * (max - min) + min).toFixed(dec);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function timeStr() {
  return new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
}

// ── Script Definitions ────────────────────────────────────────
const SCRIPTS = {
  user_setup: {
    label: 'user_setup.sh',
    tag: 'User Provisioning',
    params: [
      {
        id: 'username',
        label: 'Username',
        type: 'text',
        placeholder: 'e.g. devops',
        default: 'devops',
        pattern: /^[a-z][a-z0-9_-]{0,31}$/,
        hint: 'lowercase, alphanumeric/_ – (max 32)',
      },
      {
        id: 'groupname',
        label: 'Group Name',
        type: 'text',
        placeholder: 'e.g. portteam',
        default: 'portteam',
        pattern: /^[a-z][a-z0-9_-]{0,31}$/,
        hint: 'same rules as username',
      },
    ],
    simulate({ username = 'devops', groupname = 'portteam' } = {}) {
      const ts = nowTs();
      const uid = randInt(1001, 1099);
      const gid = randInt(1001, 1099);
      const RESERVED = ['root','bin','daemon','adm','lp','sync','shutdown','halt','mail'];
      if (RESERVED.includes(username)) {
        return [
          { t: 'cmd',  v: `sudo ./scripts/user_setup.sh ${username} ${groupname}` },
          { t: 'err',  v: `${ts} [ERROR] Refusing to modify reserved account '${username}'.` },
          { t: 'err',  v: 'Script exited with code 1.' },
        ];
      }
      if (!/^[a-z][a-z0-9_-]{0,31}$/.test(username)) {
        return [
          { t: 'cmd',  v: `sudo ./scripts/user_setup.sh ${username} ${groupname}` },
          { t: 'err',  v: `${ts} [ERROR] Invalid username '${username}'. Use lowercase alphanumeric, _, - (max 32 chars).` },
          { t: 'err',  v: 'Script exited with code 1.' },
        ];
      }
      return [
        { t: 'cmd',   v: `sudo ./scripts/user_setup.sh ${username} ${groupname}` },
        { t: 'info',  v: `${ts} [INFO]  Group '${groupname}' created.` },
        { t: 'info',  v: `${ts} [INFO]  User '${username}' created with home directory /home/${username}.` },
        { t: 'plain', v: `\nSet password for '${username}':` },
        { t: 'plain', v: 'New password:        ●●●●●●●●●●' },
        { t: 'plain', v: 'Retype new password: ●●●●●●●●●●' },
        { t: 'plain', v: 'passwd: all authentication tokens updated successfully.' },
        { t: 'info',  v: `${ts} [INFO]  Password set; first-login change enforced (chage -d 0).` },
        { t: 'info',  v: `${ts} [INFO]  Sudo access granted via /etc/sudoers.d/${username}.` },
        { t: 'info',  v: `${ts} [INFO]  Sudoers syntax check passed (visudo -cf).` },
        { t: 'ok',    v: `${ts} [INFO]  === Provisioning complete for '${username}' ===` },
        { t: 'plain', v: '' },
        { t: 'label', v: 'Verification' },
        { t: 'plain', v: `uid=${uid}(${username}) gid=${gid}(${groupname}) groups=${gid}(${groupname})` },
        { t: 'plain', v: `${username}:x:${uid}:${gid}:Provisioned by user_setup.sh:/home/${username}:/bin/bash` },
        { t: 'ok',    v: `/etc/sudoers.d/${username} — syntax OK` },
        { t: 'plain', v: '' },
        { t: 'exit0', v: 'Exit code: 0 (success)' },
      ];
    },
  },

  backup: {
    label: 'backup.sh',
    tag: 'Backup & Archive',
    params: [],
    simulate() {
      const ts = nowTs();
      const date = todayStr();
      const time = timeStr();
      const stamp = `${date}_${time}`;
      const homeSize = randFloat(80, 320);
      const etcSize  = randFloat(6, 15);
      const total    = (parseFloat(homeSize) + parseFloat(etcSize)).toFixed(2);
      const avail    = randFloat(20, 80);
      const oldDate  = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);
      const oldTime  = '02-00-01';
      return [
        { t: 'cmd',   v: 'sudo ./scripts/backup.sh' },
        { t: 'info',  v: `${ts} [INFO]  Checking available disk space in /backup ...` },
        { t: 'info',  v: `${ts} [INFO]  Available: ${avail} GB — sufficient (need 500 MB minimum).` },
        { t: 'plain', v: '' },
        { t: 'info',  v: `${ts} [INFO]  Backing up '/home' → '/backup/home_${stamp}.tar.gz' ...` },
        { t: 'ok',    v: `${ts} [INFO]  SUCCESS — '/home' backed up.` },
        { t: 'ok',    v: `         Archive : home_${stamp}.tar.gz` },
        { t: 'ok',    v: `         Size    : ${homeSize} MB  |  Integrity: PASS` },
        { t: 'plain', v: '' },
        { t: 'info',  v: `${ts} [INFO]  Backing up '/etc' → '/backup/etc_${stamp}.tar.gz' ...` },
        { t: 'ok',    v: `${ts} [INFO]  SUCCESS — '/etc' backed up.` },
        { t: 'ok',    v: `         Archive : etc_${stamp}.tar.gz` },
        { t: 'ok',    v: `         Size    : ${etcSize} MB  |  Integrity: PASS` },
        { t: 'plain', v: '' },
        { t: 'info',  v: `${ts} [INFO]  Removing backups older than 7 days from /backup/ ...` },
        { t: 'plain', v: `         Removed: home_${oldDate}_${oldTime}.tar.gz` },
        { t: 'plain', v: `         Removed: etc_${oldDate}_${oldTime}.tar.gz` },
        { t: 'ok',    v: `${ts} [INFO]  === Backup completed successfully ===` },
        { t: 'plain', v: '' },
        { t: 'label', v: 'Summary' },
        { t: 'plain', v: `  home_${stamp}.tar.gz   ${homeSize} MB` },
        { t: 'plain', v: `  etc_${stamp}.tar.gz    ${etcSize} MB` },
        { t: 'plain', v: `  Total: ${total} MB  |  Retention: 7 days  |  Status: SUCCESS` },
        { t: 'plain', v: '' },
        { t: 'exit0', v: 'Exit code: 0 (success)' },
      ];
    },
  },

  disk_monitor: {
    label: 'disk_monitor.sh',
    tag: 'Disk Alerting',
    params: [
      {
        id: 'var_pct',
        label: '/var usage %',
        type: 'range',
        min: 10, max: 99, step: 1,
        default: 83,
        hint: 'Drag to simulate different disk fill levels',
      },
    ],
    simulate({ var_pct = 83 } = {}) {
      const pct = parseInt(var_pct, 10);
      const ts  = nowTs();

      const partitions = [
        { fs: '/dev/sda1', mount: '/',     size: '50G', used: '21G', avail: '26G', pct: 43 },
        { fs: '/dev/sda2', mount: '/boot', size: '1.0G', used: '312M', avail: '712M', pct: 31 },
        { fs: '/dev/sda3', mount: '/var',  size: '20G', used: `${Math.round(pct/5)}G`, avail: `${Math.round((100-pct)/5)}G`, pct },
        { fs: '/dev/sda4', mount: '/tmp',  size: '4.0G', used: '490M', avail: '3.3G', pct: 12 },
      ];

      const lines = [
        { t: 'cmd',  v: 'sudo ./scripts/disk_monitor.sh' },
        { t: 'info', v: `${ts} [INFO]  === Disk usage check started (threshold: 80%, critical: 95%) ===` },
        { t: 'plain', v: '' },
      ];

      let alerts = 0, critical = 0;
      for (const p of partitions) {
        let level, prefix;
        if (p.pct >= 95)      { level = 'CRITICAL'; prefix = 'CRITICAL:'; critical++; alerts++; }
        else if (p.pct >= 80) { level = 'WARN';     prefix = 'ALERT:   '; alerts++; }
        else                   { level = 'INFO';     prefix = 'OK:      '; }
        const t = level === 'INFO' ? 'ok' : level === 'WARN' ? 'warn' : 'err';
        lines.push({ t, v: `${ts} [${level.padEnd(8)}] ${prefix} ${p.mount.padEnd(8)} (${p.fs}) — ${p.pct}% used | Size:${p.size} Used:${p.used} Avail:${p.avail}` });
      }

      lines.push({ t: 'plain', v: '' });

      if (critical > 0) {
        lines.push({ t: 'err',   v: `${ts} [CRITICAL] === ${critical} CRITICAL partition(s) detected! Immediate action required. ===` });
        lines.push({ t: 'err',   v: 'Exit code: 2 (critical threshold exceeded)' });
      } else if (alerts > 0) {
        lines.push({ t: 'warn',  v: `${ts} [WARN    ] === Check complete — ${alerts} partition(s) above 80% threshold ===` });
        lines.push({ t: 'warn',  v: 'Exit code: 1 (warning threshold exceeded)' });
      } else {
        lines.push({ t: 'ok',    v: `${ts} [INFO    ] === Check complete — all partitions within normal range ===` });
        lines.push({ t: 'exit0', v: 'Exit code: 0 (all clear)' });
      }

      return lines;
    },
  },

  service_health: {
    label: 'service_health.sh',
    tag: 'Service Watchdog',
    params: [
      {
        id: 'down_service',
        label: 'Simulate failure on',
        type: 'select',
        options: [
          { value: 'none',      label: 'All services running' },
          { value: 'sshd',      label: 'sshd (SSH daemon)' },
          { value: 'nginx',     label: 'nginx (Web server)' },
          { value: 'firewalld', label: 'firewalld (Firewall)' },
        ],
        default: 'nginx',
        hint: 'Pick which service to simulate as down',
      },
    ],
    simulate({ down_service = 'nginx' } = {}) {
      const ts = nowTs();
      const services = ['sshd', 'nginx', 'firewalld'];
      const lines = [
        { t: 'cmd',  v: 'sudo ./scripts/service_health.sh' },
        { t: 'info', v: `${ts} [INFO]  === Service health check started (${services.length} services) ===` },
        { t: 'plain', v: '' },
      ];

      let failures = 0, restarted = 0;

      for (const svc of services) {
        if (svc === down_service) {
          failures++;
          lines.push({ t: 'warn',  v: `${ts} [WARN ]  ${svc} — DOWN. Attempting restart...` });
          lines.push({ t: 'plain', v: `         ● ${svc}.service - ${svcDesc(svc)}` });
          lines.push({ t: 'plain', v: `           Loaded: loaded (/usr/lib/systemd/system/${svc}.service; enabled)` });
          lines.push({ t: 'plain', v: `           Active: failed (Result: exit-code)` });
          lines.push({ t: 'plain', v: '' });
          lines.push({ t: 'info',  v: `${ts} [INFO]  Starting ${svc}...` });
          lines.push({ t: 'ok',    v: `${ts} [INFO]  ${svc} — RESTARTED successfully.` });
          restarted++;
        } else {
          lines.push({ t: 'ok',   v: `${ts} [INFO]  ${svc} — RUNNING` });
        }
      }

      lines.push({ t: 'plain', v: '' });
      if (failures > 0) {
        lines.push({ t: 'warn',  v: `${ts} [INFO]  === Health check complete — Failures: ${failures} | Restarted: ${restarted} ===` });
        lines.push({ t: 'plain', v: '' });
        lines.push({ t: 'warn',  v: 'Exit code: 1 (one or more services were found down)' });
      } else {
        lines.push({ t: 'ok',    v: `${ts} [INFO]  === Health check complete — Failures: 0 | Restarted: 0 ===` });
        lines.push({ t: 'plain', v: '' });
        lines.push({ t: 'exit0', v: 'Exit code: 0 (all services healthy)' });
      }

      return lines;
    },
  },

  system_report: {
    label: 'system_report.sh',
    tag: 'Daily System Report',
    params: [],
    simulate() {
      const ts  = nowTs();
      const date = todayStr();
      const load1 = randFloat(0.05, 1.5);
      const load5 = randFloat(0.05, 1.2);
      const load15 = randFloat(0.05, 0.9);
      const cpuPct = randInt(4, 35);
      const memUsed = randInt(900, 2400);
      const memTotal = 7864;
      const memPct = Math.round(memUsed / memTotal * 100);
      const uptimeDays = randInt(1, 45);
      const uptimeHrs  = randInt(0, 23);
      const uptimeMins = randInt(0, 59);
      return [
        { t: 'cmd',    v: 'sudo ./scripts/system_report.sh' },
        { t: 'border', v: '╔══════════════════════════════════════════════════════════╗' },
        { t: 'border', v: `║        DAILY SYSTEM REPORT — ${date}           ║` },
        { t: 'border', v: `╚══════════════════════════════════════════════════════════╝` },
        { t: 'plain',  v: `Generated: ${ts}` },
        { t: 'plain',  v: '' },
        { t: 'label',  v: 'SYSTEM IDENTITY' },
        { t: 'plain',  v: 'Hostname      : rhel9-server.lab.local' },
        { t: 'plain',  v: 'OS            : Red Hat Enterprise Linux 9.4 (Plow)' },
        { t: 'plain',  v: 'Kernel        : 5.14.0-427.el9.x86_64' },
        { t: 'plain',  v: 'Architecture  : x86_64' },
        { t: 'plain',  v: '' },
        { t: 'label',  v: 'UPTIME & LOAD' },
        { t: 'plain',  v: `up ${uptimeDays} days, ${uptimeHrs} hours, ${uptimeMins} minutes` },
        { t: 'plain',  v: `Load averages (1m / 5m / 15m): ${load1} / ${load5} / ${load15}` },
        { t: 'plain',  v: 'CPU cores     : 4' },
        { t: 'plain',  v: '' },
        { t: 'label',  v: 'CPU USAGE (1-second snapshot)' },
        { t: 'plain',  v: `CPU Usage     : ${cpuPct}%` },
        { t: 'plain',  v: '' },
        { t: 'plain',  v: 'Top 5 CPU consumers:' },
        { t: 'plain',  v: '  PID  USER       %CPU  COMMAND' },
        { t: 'plain',  v: `  ${randInt(800,9999)}  root       ${randFloat(0.5,4.0,1)}   systemd` },
        { t: 'plain',  v: `  ${randInt(800,9999)}  root       ${randFloat(0.1,2.0,1)}   sshd` },
        { t: 'plain',  v: `  ${randInt(800,9999)}  nginx      ${randFloat(0.1,1.5,1)}   nginx: worker` },
        { t: 'plain',  v: `  ${randInt(800,9999)}  root       ${randFloat(0.0,0.8,1)}   firewalld` },
        { t: 'plain',  v: `  ${randInt(800,9999)}  root       ${randFloat(0.0,0.5,1)}   crond` },
        { t: 'plain',  v: '' },
        { t: 'label',  v: 'MEMORY USAGE' },
        { t: 'plain',  v: `              total     used     free   buff/cache   available` },
        { t: 'plain',  v: `Mem:          ${memTotal}M   ${memUsed}M  ${memTotal - memUsed - randInt(200,600)}M     ${randInt(200,600)}M        ${memTotal - memUsed}M` },
        { t: 'plain',  v: `Swap:          2048M       0M  2048M` },
        { t: 'plain',  v: `Usage         : ${memPct}% (${memUsed} MB used of ${memTotal} MB total)` },
        { t: 'plain',  v: '' },
        { t: 'label',  v: 'DISK USAGE' },
        { t: 'plain',  v: 'Filesystem     Type   Size  Used Avail Use% Mounted on' },
        { t: 'plain',  v: '/dev/sda1      xfs     50G   21G   26G  43% /' },
        { t: 'plain',  v: '/dev/sda2      xfs    1.0G  312M  712M  31% /boot' },
        { t: 'warn',   v: '/dev/sda3      xfs     20G   16G  3.4G  83% /var' },
        { t: 'plain',  v: '/dev/sda4      xfs    4.0G  490M  3.3G  12% /tmp' },
        { t: 'plain',  v: '' },
        { t: 'label',  v: 'NETWORK INTERFACES' },
        { t: 'plain',  v: 'lo         UNKNOWN  127.0.0.1/8' },
        { t: 'plain',  v: `ens3       UP       192.168.${randInt(1,5)}.${randInt(10,250)}/24` },
        { t: 'plain',  v: '' },
        { t: 'label',  v: 'CURRENTLY LOGGED-IN USERS' },
        { t: 'plain',  v: 'root     pts/0  2026-05-16 08:14 (192.168.1.45)' },
        { t: 'plain',  v: '' },
        { t: 'plain',  v: 'Active sessions: 1' },
        { t: 'plain',  v: '' },
        { t: 'label',  v: 'LAST 5 FAILED LOGIN ATTEMPTS' },
        { t: 'warn',   v: `root  ssh:notty  203.0.113.45   ${date} 03:12:44` },
        { t: 'warn',   v: `admin ssh:notty  198.51.100.22  ${date} 03:11:09` },
        { t: 'warn',   v: `root  ssh:notty  203.0.113.45   ${date} 03:09:33` },
        { t: 'plain',  v: '' },
        { t: 'label',  v: 'CRITICAL SERVICE STATUS' },
        { t: 'ok',     v: 'sshd            : active' },
        { t: 'ok',     v: 'nginx           : active' },
        { t: 'ok',     v: 'firewalld       : active' },
        { t: 'ok',     v: 'chronyd         : active' },
        { t: 'plain',  v: '' },
        { t: 'label',  v: 'RECENT KERNEL / SYSTEM ERRORS (last 24h)' },
        { t: 'plain',  v: '-- No errors found --' },
        { t: 'plain',  v: '' },
        { t: 'border', v: '══════════════════════════════════════════════════════════' },
        { t: 'ok',     v: `Report saved  : /root/reports/report_${date}.txt` },
        { t: 'border', v: '══════════════════════════════════════════════════════════' },
        { t: 'plain',  v: '' },
        { t: 'exit0',  v: 'Exit code: 0 (success)' },
      ];
    },
  },
};

function svcDesc(svc) {
  return { sshd: 'OpenSSH Server Daemon', nginx: 'The nginx HTTP Server', firewalld: 'firewalld - dynamic firewall daemon' }[svc] || svc;
}

// ── DOM References ────────────────────────────────────────────
const pgTabs    = document.querySelectorAll('.pg-tab');
const pgParams  = document.getElementById('pgParams');
const pgTermBody= document.getElementById('pgTermBody');
const pgTermTitle = document.getElementById('pgTermTitle');
const pgRunBtn  = document.getElementById('pgRunBtn');
const pgClearBtn= document.getElementById('pgClearBtn');
const pgCopyBtn = document.getElementById('pgCopyBtn');
const pgStatus  = document.getElementById('pgStatus');

let activeScript = 'user_setup';
let animHandle   = null;   // { cancel }

// ── Tab Switching ─────────────────────────────────────────────
pgTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.script === activeScript) return;
    cancelAnim();
    pgTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeScript = tab.dataset.script;
    renderParams(activeScript);
    resetTerminal();
    setStatus('');
  });
});

// ── Parameter Rendering ───────────────────────────────────────
function renderParams(scriptKey) {
  const script = SCRIPTS[scriptKey];
  pgTermTitle.textContent = script.label;

  if (!script.params.length) {
    pgParams.innerHTML = `<div class="pg-no-params">No parameters — click <strong>Run Script</strong> to execute.</div>`;
    return;
  }

  pgParams.innerHTML = script.params.map(p => {
    if (p.type === 'text') {
      return `
        <div class="pg-field">
          <label class="pg-label" for="pgp-${p.id}">${p.label}</label>
          <input class="pg-input" id="pgp-${p.id}" type="text"
            placeholder="${p.placeholder || ''}"
            value="${p.default || ''}"
            autocomplete="off" spellcheck="false"
          />
          <span class="pg-hint">${p.hint || ''}</span>
          <span class="pg-err" id="pgperr-${p.id}"></span>
        </div>`;
    }
    if (p.type === 'range') {
      return `
        <div class="pg-field">
          <label class="pg-label" for="pgp-${p.id}">
            ${p.label} — <span class="pg-range-val" id="pgrv-${p.id}">${p.default}%</span>
          </label>
          <input class="pg-range" id="pgp-${p.id}" type="range"
            min="${p.min}" max="${p.max}" step="${p.step}" value="${p.default}"
          />
          <div class="pg-range-labels">
            <span style="color:var(--green)">Safe</span>
            <span style="color:var(--warn)">Warn (80%)</span>
            <span style="color:var(--err)">Critical (95%)</span>
          </div>
          <span class="pg-hint">${p.hint || ''}</span>
        </div>`;
    }
    if (p.type === 'select') {
      const opts = p.options.map(o =>
        `<option value="${o.value}" ${o.value === p.default ? 'selected' : ''}>${o.label}</option>`
      ).join('');
      return `
        <div class="pg-field">
          <label class="pg-label" for="pgp-${p.id}">${p.label}</label>
          <select class="pg-select" id="pgp-${p.id}">${opts}</select>
          <span class="pg-hint">${p.hint || ''}</span>
        </div>`;
    }
    return '';
  }).join('');

  // Wire range live update
  script.params.filter(p => p.type === 'range').forEach(p => {
    const el = document.getElementById(`pgp-${p.id}`);
    const rv = document.getElementById(`pgrv-${p.id}`);
    if (el && rv) el.addEventListener('input', () => { rv.textContent = el.value + '%'; });
  });
}

// ── Collect Params ────────────────────────────────────────────
function collectParams(scriptKey) {
  const script = SCRIPTS[scriptKey];
  const result = {};
  let valid = true;

  for (const p of script.params) {
    const el = document.getElementById(`pgp-${p.id}`);
    if (!el) continue;
    const val = el.value.trim() || p.default;
    result[p.id] = val;

    if (p.type === 'text' && p.pattern) {
      const errEl = document.getElementById(`pgperr-${p.id}`);
      if (!p.pattern.test(val)) {
        if (errEl) errEl.textContent = `Invalid — ${p.hint}`;
        el.classList.add('pg-input-err');
        valid = false;
      } else {
        if (errEl) errEl.textContent = '';
        el.classList.remove('pg-input-err');
      }
    }
  }

  return valid ? result : null;
}

// ── Terminal Rendering ────────────────────────────────────────
const LINE_CLASSES = {
  cmd: 'tline tline-cmd', info: 'tline tline-info', ok: 'tline tline-ok',
  warn: 'tline tline-warn', err: 'tline tline-err', plain: 'tline tline-plain',
  border: 'tline tline-border', label: 'tline tline-label',
  exit0: 'tline tline-exit0', exit1: 'tline tline-exit1',
};

function resetTerminal() {
  pgTermBody.innerHTML = `
    <div class="pg-idle">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
      </svg>
      <span>Click <strong>Run Script</strong> to simulate execution</span>
    </div>`;
  pgRunBtn.textContent = '▶  Run Script';
  pgRunBtn.disabled = false;
  pgCopyBtn.disabled = true;
}

function cancelAnim() {
  if (animHandle) { animHandle.cancel(); animHandle = null; }
}

function setStatus(text, cls = '') {
  pgStatus.textContent = text;
  pgStatus.className = 'pg-status' + (cls ? ' ' + cls : '');
}

// ── Run ───────────────────────────────────────────────────────
pgRunBtn.addEventListener('click', () => {
  const params = collectParams(activeScript);
  if (!params) return;

  cancelAnim();
  pgTermBody.innerHTML = '';

  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  pgTermBody.appendChild(cursor);

  pgRunBtn.disabled = true;
  pgRunBtn.textContent = '⏳  Running...';
  pgCopyBtn.disabled = true;
  setStatus('● Running', 'status-running');

  const lines = SCRIPTS[activeScript].simulate(params);
  let cancelled = false;
  const ids = [];

  function schedule(fn, delay) {
    const id = setTimeout(fn, delay);
    ids.push(id);
  }

  let elapsed = 0;
  const CMD_CHAR_MS  = 22;
  const LINE_GAP_MS  = 70;
  const CMD_PAUSE_MS = 300;

  lines.forEach(line => {
    schedule(() => {
      if (cancelled) return;
      const el = document.createElement('span');
      el.className = LINE_CLASSES[line.t] || 'tline tline-plain';
      pgTermBody.insertBefore(el, cursor);

      if (line.t === 'cmd' && line.v.length) {
        // Typewriter for command line
        let i = 0;
        function typeChar() {
          if (cancelled) return;
          if (i < line.v.length) {
            el.textContent = line.v.slice(0, ++i);
            const id = setTimeout(typeChar, CMD_CHAR_MS);
            ids.push(id);
          } else {
            el.textContent = line.v + '\n';
          }
        }
        typeChar();
      } else {
        el.textContent = line.v + (line.v === '' ? '' : '\n');
      }

      pgTermBody.scrollTop = pgTermBody.scrollHeight;
    }, elapsed);

    const charTime = line.t === 'cmd' ? line.v.length * CMD_CHAR_MS : 0;
    elapsed += charTime + LINE_GAP_MS + (line.t === 'cmd' ? CMD_PAUSE_MS : 0);
  });

  // Done
  schedule(() => {
    if (cancelled) return;
    cursor.remove();
    pgRunBtn.textContent = '↺  Run Again';
    pgRunBtn.disabled = false;
    pgCopyBtn.disabled = false;
    setStatus('✓ Completed', 'status-done');
    animHandle = null;
  }, elapsed + 200);

  animHandle = {
    cancel() {
      cancelled = true;
      ids.forEach(clearTimeout);
    },
  };
});

// ── Clear ─────────────────────────────────────────────────────
pgClearBtn.addEventListener('click', () => {
  cancelAnim();
  resetTerminal();
  setStatus('');
});

// ── Copy Output ───────────────────────────────────────────────
pgCopyBtn.addEventListener('click', () => {
  const text = Array.from(pgTermBody.querySelectorAll('.tline'))
    .map(el => {
      const raw = el.textContent.replace(/\n$/, '');
      if (el.classList.contains('tline-cmd')) return '$ ' + raw;
      return raw;
    })
    .join('\n');

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      pgCopyBtn.textContent = '✓ Copied!';
      setTimeout(() => { pgCopyBtn.textContent = 'Copy Output'; }, 2000);
    });
  }
});

// ── Init ──────────────────────────────────────────────────────
renderParams(activeScript);
resetTerminal();
