# iPhone / Safari manual checklist (v2.5.0)

Automated tests only run in Chromium. Run this on a real iPhone (Safari, then the installed Home Screen PWA).
Static scan found no unsupported APIs (no structuredClone / .at() / :has() / dvh / requestIdleCallback / wakeLock).
Feature-checked APIs: BroadcastChannel, AudioContext (webkit prefix handled), storage.persist, navigator.share.
Known iOS limits: `navigator.vibrate` does nothing on iOS (the "vibrate" setting has no effect there).

1. Open the site in Safari, finish Setup (try Grind + second lift), force-quit Safari, reopen: data must still be there.
2. Share > Add to Home Screen. Open from the icon (standalone). Check the notch / home-indicator areas (safe-area).
3. Airplane mode, reopen the PWA: app loads and today's session opens (service worker cache).
4. Bump check: after deploying a new version, reopen online: the update banner appears, applying it keeps data.
5. Rest timer: start a 90 s rest, lock the screen 30 s, unlock: remaining time is correct; sound plays after the first tap.
6. Backup: Settings > export. Share sheet should offer the file; re-import it on a second device.
7. Date fields: Setup start date and test date open the native picker and save correctly.
8. Grind: pull-up from 0 shows negative pull-ups and "ช่วงฐาน" titles; log 2 sessions of >=3 negatives, press "คำนวณแผนใหม่", day 14 should become a real pull-up test.
9. Grind with two lifts: Mon/Wed/Fri = lift A, Tue/Thu/Sat = lift B, Sunday rest.
10. Private Browsing: IndexedDB may fail; the app should show a clear message instead of a blank page.
