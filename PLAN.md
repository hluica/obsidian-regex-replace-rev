# Refined Regex Replace and More — Plan and Status

- **Version:** 0.3.1 (branch `v0.3.0`, pending acceptance)
- **Status:** implemented on `v0.3.0`; E2E-verified in the local dev vault (Obsidian 1.15.0, macOS, Chinese/light and dark UI); 0.3.1 tag/release pending; 0.2.6 baseline is in the community directory
- **Current implementation:** [IMPLEMENTATION.md](IMPLEMENTATION.md)
- **UI specification:** [UI-SPEC.md](UI-SPEC.md)
- **Community readiness audit:** [COMMUNITY-READINESS.md](COMMUNITY-READINESS.md)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md) (starts at 0.2.6)
- **Install/usage:** [README.md](README.md) · [README.zh-CN.md](README.zh-CN.md)

## 1. Objective and scope

Build a find/replace panel for the **current Markdown note** with:

- exact, wildcard, and JavaScript regular-expression matching;
- find, replace once, replace and find, and replace all;
- search options for case, whole word, newlines, multiline anchors, and replacement escapes;
- current-file / captured-selection scope;
- down/up direction and optional wrap;
- match count, persistent position, status/error messages, history, and undo-safe replacement;
- all-match highlighting and zero-width match markers in the editor;
- editor-focus keyboard navigation while the panel is open;
- desktop inline panel at the bottom of the note area; mobile modal fallback;
- independent panels in multiple Obsidian windows;
- bounded result sets and a confirmation step for large replace-all operations.

Out of scope for v0.3.1: vault-wide replace, diff preview, preserve case, multiline literal input, `u`/`y`/`d`/`v` flags, default hotkeys, and real-device validation.

## 2. Current architecture

| Area | Implementation |
|---|---|
| Desktop host | CodeMirror 6 `showPanel` with `Panel.top = false`, inserted into `.cm-panels-bottom` |
| Mobile host | `FindReplaceModal` |
| Open/close | `StateField<boolean>` + `StateEffect` per editor |
| Match feedback | `StateField<DecorationSet>` with all-match marks, active mark, zero-width dot `WidgetType`, and line-break `↵` `WidgetType`; `.rr-match-highlight` / `.rr-match-highlight-active` / `.rr-zero-width` / `.rr-line-break` |
| Editor keymap | `Prec.high(keymap.of(...))`: F3, Shift+F3, Escape; active only while a panel controller exists |
| Shared UI | `FindReplacePanel` mounted in an inline frame or modal |
| Options | Obsidian native `ToggleComponent` switches |
| Target selection | Command resolves the `MarkdownView` by **`editor` identity**, not by global active view |
| Multi-window | One panel per window/document; closing/opening one window does not close another |
| Settings | Declarative `getSettingDefinitions()`; `data.json` with `settingsVersion: 1` |
| History | Last 20 search/replace terms, native menu, clear action |
| Replacement | One `editor.transaction` for all changes; one undo restores |
| Safety | Display scan 10,000; action scan 100,000; highlight cap 5,000 ranges / 1,000 zero-width dots / 1,000 line-break markers; replace-all confirmation above 5,000 |
| Large-replace confirmation | Obsidian `ConfirmationModal` (1.13+), cancel focused by default |

Main files:

- `src/main.ts` — lifecycle, command, editor/window targeting, host selection
- `src/editor/inline-panel.ts` — CM6 panel, all-match decoration field, zero-width widget, keymap, focus controller
- `src/editor/highlights.ts` — pure highlight plans: clamp, sort, dedupe, active priority, caps; zero-width and line-break planning
- `src/search/limits.ts` — display/action/highlight limits and replace-all threshold
- `src/ui/FindReplacePanel.ts` — shared panel behavior, position, scope, history, confirmation
- `src/ui/FindReplaceModal.ts` — mobile/fallback dialog
- `src/settings.ts` — settings/state model and declarative settings tab
- `src/search/` — pure pattern/match/replace engine
- `styles.css` — inline layout, highlights, zero-width markers, compact/mobile rules

## 3. Current feature rules

### 3.1 Modes and options

| Mode | Visible options | Count |
|---|---|---:|
| Exact | Case sensitive, Whole word, Wrap around, Replace escapes | 4 |
| Wildcard | + **Match newlines** | 5 |
| Regex | + **Match newlines**, **Multiline anchors** | 6 |

- `Match newlines` (`s` flag): in wildcard mode, `*` and `?` can cross line breaks; in regex mode, `.` can cross line breaks.
- `Multiline anchors` (`m` flag) is regex-only.
- `Replace escapes` interprets `\n`, `\r`, `\t`, and `\\` in the replacement before group expansion.
- Exact mode replacement is literal; wildcard/regex expand `$1`, `$&`, `$$`, etc.
- `g` is implicit.
- Whole-word filtering uses Unicode letters/numbers/marks/`_`, not `\b`.

### 3.2 Actions

| Action | Behavior |
|---|---|
| Find | Selects the next match in the current direction; skips the current match; wraps when enabled |
| Replace once | Replaces one match and leaves the caret at the replacement end |
| Replace and find | Replaces once, then selects the next match |
| Replace all | Replaces all matches in scope in one transaction; undoable; confirms above 5,000 matches; refuses above 100,000 |

### 3.3 Scope, direction, wrap

- **Current file**: whole document.
- **Selection**: captured when the panel opens or the scope is switched to Selection; range updated after replacements; reset to Current file when the document changes.
- Direction down/up; Shift+Enter reverses once; F3/Shift+F3 navigate.
- Wrap off produces boundary messages instead of wrapping.

### 3.4 Match visibility and navigation (0.3.1)

- Every match in scope is marked with `.rr-match-highlight` using the theme highlight color.
- The active match adds `.rr-match-highlight-active` with the selection background and an accent outline.
- The status row always shows `count` on the left and `position / total` next to it: `164 个匹配  11 / 164`.
- The position follows Find, Replace, selection changes, replacement, document changes, and reopening the panel.
- Zero-width matches render a small translucent gray `.rr-zero-width` dot above the insertion point (zero layout width); the active match is a filled accent dot with a background halo, so it is distinct from other matches and from a blockquote border.
- Matches containing `\n` render a `.rr-line-break` `↵` pill at each affected line end; the active match's pill is accent-filled. This makes newline-only matches and mixed matches such as `。\n` visible.
- Highlight ranges are capped at 5,000, zero-width dots at 1,000, and line-break markers at 1,000; the active match is always kept.
- F3 / Shift+F3 / Escape work from the editor while the panel is open; the panel does not need focus.
- The panel still owns its own input key handling (Enter, Shift+Enter, Mod+Enter, F3, Shift+F3, Escape).

### 3.5 Safety and status

- Display scans stop at 10,000 matches; the count shows `10000+`.
- Action scans stop at 100,000; replace-all refuses to run when the limit is reached.
- Replace all asks for confirmation above 5,000 matches; Cancel receives initial focus.
- Highlight updates are coalesced through the existing `setTimeout(0)` task to avoid dispatching while CodeMirror is updating.

### 3.6 UI rules

- Desktop panel sits at the bottom of the editor content column with a **1px solid separator line**, title, and close button; no heavy card border.
- Labels and the status count are left-aligned; the position follows the count; the status message sits at the right.
- Mode selects are three equal fixed **160px** controls, spanning the field + action columns.
- Action buttons are **122×28px** in a **252px** 2×2 column; hover/pressed feedback.
- Native toggles have 28px gaps on desktop, 16px in compact/mobile; they wrap naturally.
- The panel has no reserved empty option row; its height follows content. Very narrow windows cap the panel at **70vh** and scroll internally.
- Mobile modal is single-column with 44px controls.
- Each Obsidian window can display its own panel.

## 4. Non-functional status

| Area | Status |
|---|---|
| TypeScript strict / ESLint / tests / build | 56 tests pass; `tsc` and ESLint clean; production build passes (≈44 KB) |
| Dark/light theme | Light and dark verified in Obsidian 1.15 for 0.3.1; active match uses an outline in addition to color |
| English/Chinese UI | Verified; new strings in both languages |
| Accessibility | Labels, ARIA on selects/status, focus-visible, native toggle Space support, 44px mobile targets; highlight has outline + color; full screen-reader audit not performed |
| Multi-window | Two Obsidian windows tested in 0.2.6; the v0.3.1 panel/keymap changes are per-editor |
| Mobile | Obsidian mobile emulation tested; real iOS/Android not tested |
| Windows/Linux | not re-tested for 0.3.1 |
| Performance | 1 MB / 10,000+ matches: count refresh ≈185 ms including 180 ms debounce; engine scan itself milliseconds; highlight caps prevent unbounded decoration sets |
| Bounded actions | 100,000 match cap; 5,000 replace-all confirmation; 150,000-match note tested |
| Community directory | 0.2.6 baseline listed; 0.3.1 submission/release pending acceptance |

## 5. Acceptance status (v0.3.1)

- [x] Three modes × four actions
- [x] Exact 4 / wildcard 5 / regex 6 options
- [x] Wildcard `s` for `*`/`?`, regex `s` for `.`
- [x] Regex-only multiline anchors
- [x] Whole-word, case, wrap, direction
- [x] Current-file and selection scope
- [x] Match count, position, errors, action messages
- [x] History (20, clear, persist)
- [x] Single-transaction replace + undo
- [x] Desktop inline panel, 1px separator, close/Escape
- [x] **All-match highlighting with active match**
- [x] **Persistent current position**
- [x] **Zero-width match markers (dot style, active distinct)**
- [x] **Line-break markers for `\n` / `。\n` matches**
- [x] **F3/Shift+F3/Escape from the editor**
- [x] **Replace-all confirmation and 100,000 match cap**
- [x] Multi-window independent panels
- [x] Mobile modal fallback
- [x] Settings tab (4 items)
- [ ] Real iOS/Android and Windows/Linux verification
- [x] Dark-theme 0.3.1 visual audit and screenshot
- [ ] 0.3.1 tag/release and community-directory update

## 6. Next steps

1. **v0.3.2:** real-device/platform checks, third-party theme pass, selection-refresh button, history icon, settings-save debounce.
2. **v0.3.2:** optional multi-line find/replace fields and a `u` flag toggle, only after user feedback.
3. **Release:** create tag/release `0.3.1`, attach `main.js`, `manifest.json`, `styles.css`, update the community directory entry.
4. Keep the 0.2.6 baseline changelog; do not reconstruct older versions.

## 7. Development

```bash
npm install
npm test
npx tsc -noEmit
npm run lint
npm run build
```

Build output: `main.js`, `styles.css`, `manifest.json`. The dev vault install path is documented in [README.md](README.md). `main.js` is intentionally ignored by git and attached to releases as a build artifact.
