/* Lightweight regression checks for the Accelerated Training Engine.
   Run with: node tests/accelerated-smoke.test.js
   These are source/contract checks, not a substitute for browser interaction tests. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(Boolean);
const dateFnMatch = html.match(/const dateOk=s=>\{[\s\S]*?\n\};/);
let strictDateChecks = false;
if (dateFnMatch) { try { const dateOk = vm.runInNewContext(dateFnMatch[0] + '; dateOk'); strictDateChecks = dateOk('2024-02-29') && !dateOk('2023-02-29') && !dateOk('2026-02-31') && !dateOk('2026-13-01') && !dateOk('2026-1-01'); } catch (_) {} }
let syntaxOk = scripts.length > 0;
try { for (const src of scripts) new vm.Script(src); } catch (e) { syntaxOk = false; console.error('JS syntax:', e.message); }
const checks = [
  ['inline JavaScript parses without syntax errors', syntaxOk],
  ['duration selector offers 30 days', /id="s_duration"[\s\S]*?value="30" selected/.test(html)],
  ['push/pull focus is the default', /id="s_priority"[\s\S]*?value="pushpull" selected/.test(html)],
  ['120 minutes is stored as available time', /id="s_minutes"[\s\S]*?value="120" selected/.test(html) && /minutesPerDay:toInt\(\$\('#s_minutes'\)\.value,15,240\)/.test(html)],
  ['profile stores duration and training focus', /toInt\(\$\('#s_duration'\)\.value,1,84\)/.test(html) && /durationDays:dur/.test(html) && /priority==='grind'/.test(html) && /priority:\$\('#s_priority'\)\.value/.test(html)],
  ['30-day plan has a dedicated push/pull template', /function sprintPlanDay\(w,d\)/.test(html) && /durationDays<84\)return sprintPlanDay/.test(html) && /Deload/.test(html) && /Test Day/.test(html) && /hasEquip\(\['bar'\]\)/.test(html) && /minutesPerDay\|\|90/.test(html)],
  ['program end date is duration-aware', /n>=planDuration\(\)/.test(html)],
  ['goal status uses configured program duration, not a fixed 84 days', /const duration=planDuration\(\);[\s\S]*?elapsed\/Math\.max\(1,duration\)/.test(html)],
  ['backup dates reject impossible calendar dates at runtime', strictDateChecks],
  ['app and service worker versions are bumped together', /APP_VERSION='2\.7\.1'/.test(html) && /const VERSION='2\.7\.1'/.test(sw)],
  ['calendar shows only configured duration', /Array\.from\(\{length:weeks\}/.test(html) && /n>=planDuration\(\)/.test(html)],
  ['adaptive feedback and recovery engine remains present', /function proposals\(/.test(html) && /function safetyState\(/.test(html) && /function readinessLevel\(/.test(html)],
  ['offline shell remains restricted and versioned', /const VERSION='2\.7\.1'/.test(sw) && /app-shell cache only/.test(sw)],
  ['README documents 30-day engine', /Accelerated Training Engine/.test(readme) && /30 วัน/.test(readme)]
];
let failed = 0;
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; }
if (failed) process.exitCode = 1;
