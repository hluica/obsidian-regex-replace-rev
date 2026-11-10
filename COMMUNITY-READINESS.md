# Community Readiness Audit — v0.2.4

- **Plugin:** Regex & Wildcard Find/Replace (`regex-replace-rev`)
- **Version:** 0.2.4
- **Audit date:** 2026-11-11
- **Tag:** `0.2.4` (pushed); GitHub release pending
- **Repository:** `git@github.com:hluica/obsidian-regex-replace-rev.git`
- **Overall:** source, local build artifacts, and auxiliary documentation are **locally ready**; **community submission has not been made**, and GitHub release/assets are not complete.

Official references used:

- [Submission requirements for plugins](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
- [Manifest reference](https://docs.obsidian.md/Reference/Manifest)
- [Submit your plugin](https://docs.obsidian.md/plugins/releasing/submit-plugin)

## 1. Summary

| Area | Status | Notes |
|---|---|---|
| Source code | **Pass with documented limitations** | TS strict, ESLint clean, 41 tests, no disallowed APIs found |
| Compiled artifacts | **Pass locally; release packaging pending** | `main.js`, `styles.css`, `manifest.json`, `versions.json` present; `main.js` intentionally gitignored and must be a release asset |
| Auxiliary docs | **Pass; optional release docs missing** | README EN/ZH, LICENSE, current screenshots, current PLAN/UI-SPEC/IMPLEMENTATION; no CHANGELOG/release workflow |
| Community submission | **Not started** | Repository and tag synced; GitHub release pending; no directory submission |

## 2. Source code

### 2.1 Manifest and versions

| Check | Result | Evidence |
|---|---|---|
| `id` is lowercase/hyphenated and matches folder | PASS | `regex-replace-rev` |
| `name`/`description` do not include “Obsidian” | PASS | manifest |
| `version` matches `versions.json` and package | PASS | `0.2.4` |
| `minAppVersion` matches APIs used | PASS | `1.13.0` (declarative settings) |
| `isDesktopOnly` accurate | PASS | `false`; mobile modal fallback exists |
| `author` present | PASS | `hanluica` |
| `versions.json` has current entry | PASS | `0.2.4: 1.13.0` |

### 2.2 Developer-policy checks

| Check | Result | Evidence |
|---|---|---|
| No network requests/telemetry/ads | PASS | grep: no `fetch`, `XMLHttpRequest`, telemetry, ads |
| No Node/Electron APIs in plugin | PASS | source imports only `obsidian` + CM6; bundle requires only `obsidian`, `@codemirror/state`, `@codemirror/view` |
| No remote code/eval/obfuscation | PASS | no `eval`, `new Function`, remote loading; standard esbuild minified bundle |
| No `innerHTML`/dynamic `<style>` | PASS | grep clean |
| No `!important`/`:has()` | PASS | CSS scan clean |
| No regex lookbehind | PASS | no `(?<`; wording/docs avoid it |
| No global `app` usage | PASS | plugin uses `this.app`; no `window.app`/`globalThis.app` |
| No direct global `document` for panel UI | PASS | panel DOM created on owning element/document; menus use `button.ownerDocument` |
| No default hotkeys/ribbon | PASS | no `addRibbonIcon`, no default hotkey |
| Uses public Obsidian/CM6 APIs | PASS | `registerEditorExtension`, `editorInfoField`, `MarkdownView`, `ToggleComponent`, `Menu` |
| Lifecycle cleanup | PASS | editor extension registered; ResizeObserver disconnected; timer cleared; modal/menu closed; no leaf detachment |
| No view/editor references in plugin singleton | PASS | panel is bound to its editor view; no `MarkdownView` references retained |
| Accessibility baseline | PARTIAL | labels/ARIA/focus-visible/native toggle Space/44px; no full screen-reader audit |
| Mobile support | PASS (emulation) | mobile modal; real devices not tested |
| Multi-window | PASS | two Obsidian windows tested with independent panels |

The only `window.*` use is `window.setTimeout`/`clearTimeout` for the 180ms refresh debounce; timers are cleared on destroy. This is not an app/document global UI access.

### 2.3 Quality checks

```text
npm test          # 4 files, 41 tests passed
npx tsc -noEmit   # passed
npx eslint .      # 0 errors / 0 warnings
npm run build     # passed
dev:errors        # no errors
```

## 3. Compiled artifacts

| Artifact | Status | Details |
|---|---|---|
| `main.js` | Present, local only | 37 KB, production bundle, no source map, external `obsidian`/CM6 modules |
| `styles.css` | Present | static CSS; no dynamic styles |
| `manifest.json` | Present | version 0.2.4 |
| `versions.json` | Present | current entry |
| `main.js` tracked by git? | No | intentionally gitignored; attach to GitHub release |
| `node_modules` in release? | No | ignored; not shipped |

**Release packaging remaining:** create the GitHub release for tag `0.2.4` and attach `main.js`, `manifest.json`, `styles.css`. `versions.json` belongs in the repository (not necessarily the release asset).

## 4. Auxiliary documentation

| Document | Status | Notes |
|---|---|---|
| `README.md` / `README.zh-CN.md` | Current | install, usage, syntax, settings, limitations, development |
| `LICENSE` | Current | MIT, non-template |
| `docs/screenshots/panel-inline.png` | Current | dark/English inline panel |
| `docs/screenshots/modal-fallback.png` | Current | dark/English modal |
| `PLAN.md` | Current | v0.2.4 plan/status |
| `UI-SPEC.md` | Current | v0.2.4 inline/toggle/multi-window spec |
| `IMPLEMENTATION.md` | Current | v0.2.4 implementation and verification record |
| `COMMUNITY-READINESS.md` | Current | this audit |
| `CHANGELOG.md` | Missing | optional but recommended before community release |
| GitHub release workflow | Missing | optional; release assets can be manual |

**README submission note:** the current README says the plugin is not published/installed manually. Update that section to the Community plugins installation flow when a release is actually submitted.

## 5. Submission blockers / next steps

1. **Create the GitHub release for tag `0.2.4`** and attach `main.js`, `manifest.json`, `styles.css`; verify the artifact loads from a clean vault.
2. **Update README install section** for Community plugins once the release exists.
3. **Verify plugin ID uniqueness** and author metadata against the community directory at submission time.
4. Optional: add `CHANGELOG.md`, release workflow/attestation.
5. Known non-blocking limitations: zero-width match marker absent; no all-match highlight; no 1MB/10k benchmark; no real-device Windows/Linux/iOS/Android verification.

No community-directory submission has been performed.
