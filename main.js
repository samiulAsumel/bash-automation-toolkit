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
