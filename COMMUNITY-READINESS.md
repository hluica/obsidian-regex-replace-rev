# Community Readiness Audit — v0.3.3

- **Plugin:** Refined Regex Replace and More (`regex-replace-rev`)
- **Version:** 0.3.3 (released 2026-11-11; 0.3.0/0.3.1/0.3.2 were internal)
- **Audit date:** 2026-11-11
- **Repository:** `git@github.com:hluica/obsidian-regex-replace-rev.git`
- **Overall:** 0.3.3 is released from tag `0.3.3`; 0.2.6 is listed in the Obsidian community directory and the 0.3.3 directory update is pending.

Official references used:

- [Submission requirements for plugins](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
- [Manifest reference](https://docs.obsidian.md/Reference/Manifest)
- [Submit your plugin](https://docs.obsidian.md/plugins/releasing/submit-plugin)

## 1. Summary

| Area | Status | Notes |
|---|---|---|
| Source code | **Pass with documented limitations** | TS strict, ESLint clean, 61 tests, no disallowed APIs found |
| Compiled artifacts | **Pass locally; release packaging pending** | `main.js`, `styles.css`, `manifest.json`, `versions.json` present; `main.js` intentionally gitignored and must be a release asset |
| Auxiliary docs | **Pass** | README EN/ZH, LICENSE, CHANGELOG (0.2.6 baseline), current screenshots, PLAN/UI-SPEC/IMPLEMENTATION |
| Community listing | **0.2.6 listed; 0.3.3 update pending** | 0.3.3 is released; update the directory entry |

## 2. Source code

### 2.1 Manifest and versions

| Check | Result | Evidence |
|---|---|---|
| `id` is lowercase/hyphenated and matches folder | PASS | `regex-replace-rev` |
| `name`/`description` do not include “Obsidian” | PASS | manifest |
| `version` matches `versions.json` and package | PASS | `0.3.3` |
| `minAppVersion` matches APIs used | PASS | `1.13.0` (declarative settings, `ConfirmationModal`) |
| `isDesktopOnly` accurate | PASS | `false`; mobile modal fallback exists |
| `author` present | PASS | `hanluica` |
| `versions.json` has current entry | PASS | `0.3.3: 1.13.0` |

### 2.2 Developer-policy checks

| Check | Result | Evidence |
|---|---|---|
| No network requests/telemetry/ads | PASS | no `fetch`, `XMLHttpRequest`, telemetry, ads |
| No Node/Electron APIs in plugin | PASS | source imports only `obsidian` + CM6; bundle externals unchanged |
| No remote code/eval/obfuscation | PASS | no `eval`, `new Function`, remote loading |
| No `innerHTML`/dynamic `<style>` | PASS | grep clean; widget DOM uses `createElement` on the owner document |
| No `!important`/`:has()` | PASS | CSS scan clean |
| No regex lookbehind | PASS | no `(?<`; docs avoid it |
| No global `app` usage | PASS | plugin uses `this.app`; no `window.app`/`globalThis.app` |
| No direct global `document` for panel UI | PASS | panel DOM created on owning element/document; menus use `button.ownerDocument` |
| No default hotkeys/ribbon | PASS | no `addRibbonIcon`, no default hotkey |
| Uses public Obsidian/CM6 APIs | PASS | `registerEditorExtension`, `editorInfoField`, `MarkdownView`, `ToggleComponent`, `Menu`, `ConfirmationModal`, CM6 `keymap`/`Decoration` |
| Lifecycle cleanup | PASS | editor extension registered; ResizeObserver disconnected; timers cleared; modal/menu closed; no leaf detachment |
| No view/editor references in plugin singleton | PASS | panel is bound to its editor view; no `MarkdownView` references retained |
| Accessibility baseline | PARTIAL | labelled region/heading, named controls, grouped options, history menu state, live status, focus-visible, 44px targets; Chromium AX tree audited; full VoiceOver/Narrator outstanding |
| Mobile support | PASS (emulation) | mobile modal; real devices not tested |
| Multi-window | PASS | two Obsidian windows tested in 0.2.6; 0.3.3 changes are per-editor |

The only `window.*` use is `window.setTimeout`/`clearTimeout` for the 180ms refresh debounce and highlight coalescing; timers are cleared on destroy.

### 2.3 Quality checks

```text
npm test          # 6 files, 61 tests passed
npx tsc -noEmit   # passed
npx eslint .      # 0 errors / 0 warnings
npm run build     # passed, main.js ≈48 KB
dev:errors        # no errors
```

## 3. Compiled artifacts

| Artifact | Status | Details |
|---|---|---|
| `main.js` | Present, local only | ≈48 KB, production bundle, no source map, external `obsidian`/CM6 modules |
| `styles.css` | Present | static CSS; highlight/zero-width/line-break/status rules added |
| `manifest.json` | Present | version 0.3.3 |
| `versions.json` | Present | current entry |
| `main.js` tracked by git? | No | intentionally gitignored; attach to GitHub release |
| `node_modules` in release? | No | ignored; not shipped |

**Release packaging remaining:** attach the rebuilt `main.js`, `manifest.json`, and `styles.css` to the GitHub release for tag `0.3.3` if not already uploaded, and update the community directory entry. Verify from a clean vault.

## 4. Auxiliary documentation

| Document | Status | Notes |
|---|---|---|
| `README.md` / `README.zh-CN.md` | Current | 0.3.3 features, installation, usage, syntax, accessibility, limitations |
| `LICENSE` | Current | MIT, non-template |
| `CHANGELOG.md` | Added | starts at 0.2.6 baseline; 0.3.0–0.3.3 entries |
| `docs/screenshots/panel-inline.png` | Current | Chinese/light; all-match highlight + position |
| `docs/screenshots/panel-zero-width.png` | Current | translucent gray / accent zero-width dots |
| `docs/screenshots/panel-newline.png` | Added | newline-only `\n` markers |
| `docs/screenshots/panel-newline-combo.png` | Added | mixed `。\n` marker |
| `docs/screenshots/modal-fallback.png` | Current | Chinese/light mobile modal |
| `docs/screenshots/panel-dark.png` | Added | dark theme all-match/active contrast |
| `docs/screenshots/theme-catppuccin.png` | Added | Catppuccin active/inactive contrast |
| `docs/screenshots/theme-minimal.png` | Added | Minimal active/inactive contrast |
| `PLAN.md` | Current | 0.3.3 plan/status |
| `UI-SPEC.md` | Current | 0.3.3 Unicode/accessibility/theme spec |
| `IMPLEMENTATION.md` | Current | 0.3.3 implementation/verification record |
| `COMMUNITY-READINESS.md` | Current | this audit |
| GitHub release workflow | Missing | optional; release assets can be manual |

## 5. Submission / release next steps

1. Attach the rebuilt release assets (`main.js`, `manifest.json`, `styles.css`) to tag `0.3.3` if the hosting release still needs them.
2. Update the existing community-directory entry to 0.3.3.
3. Verify from a clean vault.
4. Run a full VoiceOver/Narrator session and real iOS/Android/Windows/Linux checks after release.
5. Optional: add a release workflow/attestation; add a `npm run deploy` script for the dev vault.
6. Known non-blocking limitations: real iOS/Android and Windows/Linux not re-tested; highlight ranges capped; no full screen-reader audit; YAML property decorations not independently verified.

## 6. Verification highlights

- 164 matches in the 55 KB note: all-match highlights visible, active match distinct, position `3 / 164`.
- Selection/reopen position: `11 / 164`; caret off matches: `— / 164`.
- Zero-width `^`: 229 matches, 16 visible translucent-gray dots, filled active dot; F3/Shift+F3/Escape from editor.
- Newline `\n`: 228 matches, 24 `↵` markers; active break filled; mixed `。\n` shows `。` mark + `↵`.
- Replace-all confirmation at 19,588 matches (Cancel focused); 6,000-match confirm + undo; 150,000-match cap message.
- 1 MB / 10,500 matches: count update 184.9 ms including the 180 ms debounce; no errors.
- 0.3.2: scope refresh with a body selection (1 match), history icons, 500ms settings debounce (data.json mtime unchanged at 120ms, updated after 500ms), narrow scope control fit.
- 0.3.3: `\p{Script=Han}+` finds 2,665 runs with Unicode on and none with it off; astral `.` is one code point with `u`; Chromium AX tree exposes region/heading/options group/checks/status; Tab order reaches every control and leaves the panel to the workspace; hovering a component then the panel background no longer emits a spurious “查找与替换” tooltip; Catppuccin and Minimal render highlights, toggles, dots, and `↵`; tablet/mobile button padding no longer clips the scan/history icons.
- 1 MB / 10,500 lines: `\n` 185.4 ms, dotAll `.*` 185.3 ms, zero-width `^` 188.5 ms (all including debounce); caps hold; no freeze.
- Compact 700px → 324px panel and 500px → 124px panel: no horizontal overflow; 124px uses one action per row and wraps status; documented 70vh internal scroll.
- Popout window: independent panel, F3/Escape verified; normal `workspace:close-window` leaves the main panel open with no errors.
- Dark theme: zero dots and `↵` markers use theme variables; active states remain distinct.
- Mobile modal: 44px controls, position `2 / 164`, no errors.
