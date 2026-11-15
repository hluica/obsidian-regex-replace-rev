# Community Readiness Audit — v0.3.5

- **Plugin:** Refined Regex Replace and More (`regex-replace-rev`)
- **Version:** 0.3.5 (released 2026-11-15; 0.3.0/0.3.1/0.3.2 were internal)
- **Audit date:** 2026-11-15
- **Repository:** `git@github.com:hluica/obsidian-regex-replace-rev.git`
- **Overall:** 0.3.5 is released from tag `0.3.5`; 0.2.6 is listed in the Obsidian community directory and the 0.3.5 directory update is pending.

Official references used:

- [Submission requirements for plugins](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
- [Manifest reference](https://docs.obsidian.md/Reference/Manifest)
- [Submit your plugin](https://docs.obsidian.md/plugins/releasing/submit-plugin)

## 1. Summary

| Area | Status | Notes |
|---|---|---|
| Source code | **Pass with documented limitations** | TS strict, ESLint clean, 81 tests, no disallowed APIs found |
| Compiled artifacts | **Pass locally; release packaging pending** | `main.js`, `styles.css`, `manifest.json`, `versions.json` present; `main.js` intentionally gitignored and must be a release asset |
| Auxiliary docs | **Pass** | README EN/ZH, LICENSE, CHANGELOG (0.2.6–0.3.5), current screenshots, PLAN/UI-SPEC/IMPLEMENTATION |
| Community listing | **0.2.6 listed; 0.3.5 update pending** | 0.3.5 is released; update the directory entry |

## 2. Source code

### 2.1 Manifest and versions

| Check | Result | Evidence |
|---|---|---|
| `id` is lowercase/hyphenated and matches folder | PASS | `regex-replace-rev` |
| `name`/`description` do not include “Obsidian” | PASS | manifest |
| `version` matches `versions.json` and package | PASS | `0.3.5` |
| `minAppVersion` matches APIs used | PASS | `1.13.0` (declarative settings, `ConfirmationModal`) |
| `isDesktopOnly` accurate | PASS | `false`; mobile modal fallback exists |
| `author` present | PASS | `hanluica` |
| `versions.json` has current entry | PASS | `0.3.5: 1.13.0` |

### 2.2 Developer-policy checks

| Check | Result | Evidence |
|---|---|---|
| No network requests/telemetry/ads | PASS | no `fetch`, `XMLHttpRequest`, telemetry, ads |
| No Node/Electron APIs in plugin | PASS | source imports only `obsidian` + CM6; bundle externals unchanged |
| No remote code/eval/obfuscation | PASS | no `eval`, `new Function`, remote loading |
| No `innerHTML`/dynamic `<style>` | PASS | grep clean; widgets and panel use the owning window’s `createDiv`/`createSpan` helpers |
| No `!important`/`:has()` | PASS | CSS scan clean |
| No regex lookbehind | PASS | no `(?<`; docs avoid it |
| No global `app` usage | PASS | plugin uses `this.app`; no `window.app`/`globalThis.app` |
| No direct global `document` for panel UI | PASS | panel DOM created on the owning window; menus use `button.ownerDocument`; `prefer-create-el` warning fixed |
| No default hotkeys/ribbon | PASS | no `addRibbonIcon`, no default hotkey |
| Uses public Obsidian/CM6 APIs | PASS with one documented exception | public `registerEditorExtension`, `editorInfoField`, `editorLivePreviewField`, `MarkdownView`, `ToggleComponent`, `Menu`, `ConfirmationModal`, CM6 `keymap`/`Decoration`; the Live Preview reveal calls `editor.addHighlights`/`removeHighlights`, which are undocumented but used by Obsidian's own in-document find, are feature-detected, and fall back to the marks-only behavior |
| Lifecycle cleanup | PASS | editor extension registered; ResizeObserver disconnected; timers cleared; modal/menu closed; no leaf detachment |
| No view/editor references in plugin singleton | PASS | panel is bound to its editor view; no `MarkdownView` references retained |
| Accessibility baseline | PARTIAL | labelled region/heading, named controls, grouped options, history menu state, live status, focus-visible, 44px targets; Chromium AX tree audited; full VoiceOver/Narrator outstanding |
| Mobile support | PASS (emulation) | mobile modal; real devices not tested |
| Multi-window | PASS | two Obsidian windows tested in 0.2.6; 0.3.4 DOM helpers and per-editor panels preserve popout document ownership; the 0.3.5 highlight set lives in each editor's state |

The only `window.*` use is `window.setTimeout`/`clearTimeout` for the 180ms refresh debounce and highlight coalescing; timers are cleared on destroy.

### 2.3 Quality checks

```text
npm test          # 8 files, 81 tests passed
npx tsc -noEmit   # passed
npx eslint .      # 0 errors / 0 warnings
npm run build     # passed, main.js ≈55 KB
dev:errors        # no errors
```

## 3. Compiled artifacts

| Artifact | Status | Details |
|---|---|---|
| `main.js` | Present, local only | ≈55 KB, production bundle, no source map, external `obsidian`/CM6 modules |
| `styles.css` | Present | static CSS; highlight/zero-width/line-break/status rules added |
| `manifest.json` | Present | version 0.3.5 |
| `versions.json` | Present | current entry |
| `main.js` tracked by git? | No | intentionally gitignored; attach to GitHub release |
| `node_modules` in release? | No | ignored; not shipped |

**Release packaging remaining:** attach the rebuilt `main.js`, `manifest.json`, and `styles.css` to the GitHub release for tag `0.3.5`, and update the community directory entry. Verify from a clean vault.

## 4. Auxiliary documentation

| Document | Status | Notes |
|---|---|---|
| `README.md` / `README.zh-CN.md` | Current | 0.3.5 features, installation, usage, syntax, accessibility, limitations |
| `LICENSE` | Current | MIT, non-template |
| `CHANGELOG.md` | Added | starts at 0.2.6 baseline; 0.3.0–0.3.5 entries |
| `docs/screenshots/panel-inline.png` | Current | Chinese/light; all-match highlight + position |
| `docs/screenshots/panel-zero-width.png` | Current | translucent gray / accent zero-width dots |
| `docs/screenshots/panel-newline.png` | Added | newline-only `\n` markers |
| `docs/screenshots/panel-newline-combo.png` | Added | mixed `。\n` marker |
| `docs/screenshots/modal-fallback.png` | Current | Chinese/light mobile modal |
| `docs/screenshots/panel-dark.png` | Added | dark theme all-match/active contrast |
| `docs/screenshots/theme-catppuccin.png` | Added | Catppuccin active/inactive contrast |
| `docs/screenshots/theme-minimal.png` | Added | Minimal active/inactive contrast |
| `docs/screenshots/live-preview-reveal.png` | Added | Live Preview callout marker shown as source with the highlight; clear button visible |
| `PLAN.md` | Current | 0.3.5 plan/status |
| `UI-SPEC.md` | Current | 0.3.5 clear controls and Live Preview reveal, 0.3.4 wrap-off bounds, 0.3.3 UI layer |
| `IMPLEMENTATION.md` | Current | 0.3.5 implementation/verification record |
| `COMMUNITY-READINESS.md` | Current | this audit |
| GitHub release workflow | Missing | optional; release assets can be manual |

## 5. Submission / release next steps

1. Attach the rebuilt release assets (`main.js`, `manifest.json`, `styles.css`) to tag `0.3.5`.
2. Update the existing community-directory entry to 0.3.5.
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
- 0.3.4: current-file wrap-off regions respond to cursor direction; selection scope stays at the full captured selection from its top/bottom; zero-match regions recover when the cursor moves back into a match; selection boundary messages are distinct; Replace and find continues past the replacement; main and popout panel/marker nodes have the correct `ownerDocument`; `prefer-create-el` warning resolved.
- 0.3.5: clear buttons appear only while their field has text and reset count/message/highlights on Find; `~~`, `**bold**`, and a matched `> [!note]` header are shown as raw source with the highlight; Find keeps the reveal after Obsidian's editor click clears highlight sets; source mode keeps the custom mark without the search layer; closing the panel restores rendering; mobile emulation shows 44px clear targets.
