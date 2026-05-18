# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

A static portfolio site showcasing 5 production-grade Bash scripts for RHEL 9 systems administration. There is no build system, no npm, no bundler — pure vanilla HTML/CSS/JS served as static files and deployed to GitHub Pages.

**Live URL:** `samiulAsumel.github.io/bash-automation-toolkit`

---

## Dev Server & Validation

```bash
# Start local dev server (always port 7800)
python3 -m http.server 7800

# Validate JS syntax (no runtime — syntax only)
node --check main.js
node --check playground.js

# Lint Bash scripts
shellcheck scripts/*.sh

# Headless screenshot for visual verification
google-chrome --headless=new --screenshot=/tmp/shot.png \
  --window-size=1400,900 --no-sandbox --disable-gpu \
  --virtual-time-budget=5000 http://localhost:7800
```

There are no tests beyond `node --check` and `shellcheck`. Visual verification via headless Chrome is the only way to confirm the UI is correct — PDF file size is a useful proxy (larger = more visible content rendered).

---

## Frontend Architecture

**No framework. No dependencies. No build step.**

| File | Role |
|---|---|
| `index.html` | Full 7-section single-page app — all markup is static |
| `style.css` | All styling via CSS custom properties; Bebas Neue + DM Mono + DM Sans |
| `main.js` | All interactivity for the portfolio site |
| `playground.js` | Script simulator — isolated from main.js |

### main.js internals

`main.js` owns five distinct systems, all wired on DOMContentLoaded (no framework lifecycle):

1. **Terminal engine** — `runTerminal(container, lines, opts)` renders an animated typewriter. Line types (`cmd`, `ok`, `warn`, `err`, `plain`) map to CSS classes. Used by the hero terminal and each script card.

2. **Script card terminals** — Each `.script-card .term-body[data-lines]` embeds its terminal lines as a JSON string in the `data-lines` attribute. `main.js` parses this and triggers the terminal animation via IntersectionObserver on first scroll-into-view.

3. **Scroll-reveal** — Progressive enhancement pattern. CSS default = visible. JS adds `.pre-reveal` (opacity 0 + translateY) to all `.script-card, .std-card` on load; IntersectionObserver removes it. `@media print` overrides `.pre-reveal` to always show. **Do not revert to the old pattern** (CSS-default hidden + JS-add `.revealed`) — headless Chrome never fires IntersectionObserver reliably.

4. **DEEP_DOCS + renderDeepDoc** — All Script Reference documentation lives in the `DEEP_DOCS` object (keyed by `user_setup`, `backup`, `disk_monitor`, `service_health`, `system_report`). `renderDeepDoc(key)` dynamically builds and injects HTML into `#deepPanel`. Clicking `.deep-nav-btn` switches the active doc. Copy buttons inside the panel are re-wired after each render.

5. **Copy-to-clipboard** — `copyText(text)` uses `navigator.clipboard` with a `document.execCommand` fallback. `.copy-btn` elements copy the previous sibling's `data-copy` or `textContent`. `.step-copy-btn` elements target a `data-target` element by ID.

### playground.js internals

Entirely separate from `main.js`. Contains a `SCRIPTS` object (same five scripts) where each entry has `params` (form field definitions with validation patterns) and a `simulate()` function that generates fake-but-realistic terminal output with randomized values. The playground renders its own terminal using the same `runTerminal` function (duplicated, not shared).

### CSS conventions

- All colors via CSS custom properties (`--bg`, `--fg`, `--m1`–`--m4`, `--accent`, `--warn`, `--err`)
- Terminal line classes: `.tline-cmd`, `.tline-ok`, `.tline-warn`, `.tline-err`, `.tline-plain`
- Card reveal: `.pre-reveal` class on `.script-card` and `.std-card` (added by JS, removed by observer)
- Log sample classes: `.ls-ok`, `.ls-warn`, `.ls-info` inside `.log-sample`

---

## Bash Script Architecture

All 5 scripts follow an identical structure:

```
set -euo pipefail
trap 'log "ERROR" "Script failed at line $LINENO."' ERR

# Constants (LOG_FILE, configurable vars as UPPER_SNAKE)
# Helper functions (log, require_root, ...)
# Validation (require_root, arg count, path checks)
# Main logic
# Exit with explicit code
```

**Shared patterns:**
- `log()` function: `echo "$(date '+%Y-%m-%d %H:%M:%S') [$LEVEL] $MSG" | tee -a "$LOG_FILE"`
- Root check: `[[ $EUID -eq 0 ]] || { echo "[ERROR] Must run as root."; exit 1; }`
- All scripts require `sudo` — no SUID
- Exit codes: 0 = success, 1 = error, 2 = critical (disk_monitor only)

**Log file locations:**
- `user_setup.sh` → `/var/log/user_setup.log`
- `backup.sh` → `/var/log/backup.log`
- `disk_monitor.sh` → `/var/log/disk_alert.log`
- `service_health.sh` → `/var/log/service_health.log`
- `system_report.sh` → `/root/reports/report_YYYY-MM-DD.txt`

When editing a script, update the corresponding entry in `DEEP_DOCS` in `main.js` and the matching `simulate()` in `playground.js` to keep the site accurate.

---

## Deployment

Push to `main` → GitHub Pages auto-deploys in ~60–90 seconds. No CI pipeline. No build step needed.
