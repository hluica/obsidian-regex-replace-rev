# Community Readiness Audit — v0.3.0

- **Plugin:** Refined Regex Replace and More (`regex-replace-rev`)
- **Version:** 0.3.0 (branch `v0.3.0`, pending acceptance)
- **Audit date:** 2026-11-11
- **Repository:** `git@github.com:hluica/obsidian-regex-replace-rev.git`
- **Overall:** 0.2.6 is listed in the Obsidian community directory; 0.3.0 source/build/docs are locally ready, with tag/release and directory update pending acceptance.

Official references used:

- [Submission requirements for plugins](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
- [Manifest reference](https://docs.obsidian.md/Reference/Manifest)
- [Submit your plugin](https://docs.obsidian.md/plugins/releasing/submit-plugin)

## 1. Summary

| Area | Status | Notes |
|---|---|---|
| Source code | **Pass with documented limitations** | TS strict, ESLint clean, 51 tests, no disallowed APIs found |
| Compiled artifacts | **Pass locally; release packaging pending** | `main.js`, `styles.css`, `manifest.json`, `versions.json` present; `main.js` intentionally gitignored and must be a release asset |
| Auxiliary docs | **Pass** | README EN/ZH, LICENSE, CHANGELOG (0.2.6 baseline), current screenshots, PLAN/UI-SPEC/IMPLEMENTATION |
| Community listing | **0.2.6 listed; 0.3.0 update pending** | Release 0.3.0 first, then update the directory entry |

## 2. Source code

### 2.1 Manifest and versions

| Check | Result | Evidence |
|---|---|---|
| `id` is lowercase/hyphenated and matches folder | PASS | `regex-replace-rev` |
| `name`/`description` do not include “Obsidian” | PASS | manifest |
| `version` matches `versions.json` and package | PASS | `0.3.0` |
| `minAppVersion` matches APIs used | PASS | `1.13.0` (declarative settings, `ConfirmationModal`) |
| `isDesktopOnly` accurate | PASS | `false`; mobile modal fallback exists |
| `author` present | PASS | `hanluica` |
| `versions.json` has current entry | PASS | `0.3.0: 1.13.0` |

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
| Accessibility baseline | PARTIAL | labels/ARIA/focus-visible/native toggle Space/44px/outline for active match; no full screen-reader audit |
| Mobile support | PASS (emulation) | mobile modal; real devices not tested |
| Multi-window | PASS | two Obsidian windows tested in 0.2.6; 0.3.0 changes are per-editor |

The only `window.*` use is `window.setTimeout`/`clearTimeout` for the 180ms refresh debounce and highlight coalescing; timers are cleared on destroy.

### 2.3 Quality checks

```text
npm test          # 6 files, 51 tests passed
npx tsc -noEmit   # passed
npx eslint .      # 0 errors / 0 warnings
npm run build     # passed, main.js ≈44 KB
dev:errors        # no errors
```

## 3. Compiled artifacts

| Artifact | Status | Details |
|---|---|---|
| `main.js` | Present, local only | ≈44 KB, production bundle, no source map, external `obsidian`/CM6 modules |
| `styles.css` | Present | static CSS; highlight/zero-width/status rules added |
| `manifest.json` | Present | version 0.3.0 |
| `versions.json` | Present | current entry |
| `main.js` tracked by git? | No | intentionally gitignored; attach to GitHub release |
| `node_modules` in release? | No | ignored; not shipped |

**Release packaging remaining:** after acceptance, merge `v0.3.0`, create tag `0.3.0`, create the GitHub release, and attach `main.js`, `manifest.json`, `styles.css`; then update the community directory entry.

## 4. Auxiliary documentation

| Document | Status | Notes |
|---|---|---|
| `README.md` / `README.zh-CN.md` | Current | 0.3.0 features, installation, usage, syntax, settings, limitations |
| `LICENSE` | Current | MIT, non-template |
| `CHANGELOG.md` | Added | starts at 0.2.6 baseline; 0.3.0 entry |
| `docs/screenshots/panel-inline.png` | Current | Chinese/light; all-match highlight + `11 / 164` |
| `docs/screenshots/panel-zero-width.png` | Added | zero-width markers |
| `docs/screenshots/modal-fallback.png` | Current | Chinese/light mobile modal |
| `docs/screenshots/panel-dark.png` | Added | dark theme all-match/active contrast |
| `PLAN.md` | Current | 0.3.0 plan/status |
| `UI-SPEC.md` | Current | 0.3.0 visibility/layout spec |
| `IMPLEMENTATION.md` | Current | 0.3.0 implementation/verification record |
| `COMMUNITY-READINESS.md` | Current | this audit |
| GitHub release workflow | Missing | optional; release assets can be manual |

## 5. Submission / release next steps

1. Accept and merge `v0.3.0`.
2. Create tag `0.3.0` and its GitHub release; attach `main.js`, `manifest.json`, `styles.css`; verify the artifact loads from a clean vault.
3. Update the existing community-directory entry to 0.3.0.
4. Optional: add a release workflow/attestation; add a `npm run deploy` script for the dev vault.
5. Known non-blocking limitations: real iOS/Android and Windows/Linux not re-tested; highlight ranges capped; no full screen-reader audit; YAML property decorations not independently verified.

## 6. Verification highlights

- 164 matches in the 55 KB note: all-match highlights visible, active match distinct, position `3 / 164`.
- Selection/reopen position: `11 / 164`; caret off matches: `— / 164`.
- Zero-width `^`: 229 matches, 12 visible markers, active marker; F3/Shift+F3/Escape from editor.
- Replace-all confirmation at 19,588 matches (Cancel focused); 6,000-match confirm + undo; 150,000-match cap message.
- 1 MB / 10,500 matches: count update 184.9 ms including the 180 ms debounce; no errors.
- Mobile modal: 44px controls, position `2 / 164`, no errors.
