# Refined Regex Replace and More — Plan and Status

- **Version:** 0.2.6
- **Status:** implemented and verified in the local dev vault (Obsidian 1.15.0, macOS, dark theme, English UI); source on `main`; tag/release `0.2.6` pending; **not yet listed in the community directory**
- **Current implementation:** [IMPLEMENTATION.md](IMPLEMENTATION.md)
- **UI specification:** [UI-SPEC.md](UI-SPEC.md)
- **Community readiness audit:** [COMMUNITY-READINESS.md](COMMUNITY-READINESS.md)
- **Install/usage:** [README.md](README.md) · [README.zh-CN.md](README.zh-CN.md)


## 1. Objective and scope

Build a find/replace panel for the **current Markdown note** with:

- exact, wildcard, and JavaScript regular-expression matching;
- find, replace once, replace and find, and replace all;
- search options for case, whole word, newlines, multiline anchors, and replacement escapes;
- current-file / captured-selection scope;
- down/up direction and optional wrap;
- match count, status/error messages, history, and undo-safe replacement;
- desktop inline panel at the bottom of the note area; mobile modal fallback;
- independent panels in multiple Obsidian windows.

Out of scope for v0.2.6: vault-wide replace, all-match highlighting, diff preview, preserve case, multiline literal input, `u`/`y`/`d`/`v` flags, default hotkeys, and community-directory publication.

## 2. Current architecture

| Area | Implementation |
|---|---|
| Desktop host | CodeMirror 6 `showPanel` with `Panel.top = false`, inserted into `.cm-panels-bottom` |
| Mobile host | `FindReplaceModal` |
| Open/close | `StateField<boolean>` + `StateEffect` per editor |
| Match feedback | CM6 `Decoration` mark `.rr-match-highlight`; also sets the editor selection |
| Shared UI | `FindReplacePanel` mounted in an inline frame or modal |
| Options | Obsidian native `ToggleComponent` switches |
| Target selection | Command resolves the `MarkdownView` by **`editor` identity**, not by global active view |
| Multi-window | One panel per window/document; closing/opening one window does not close another |
| Settings | Declarative `getSettingDefinitions()`; `data.json` with `settingsVersion: 1` |
| History | Last 20 search/replace terms, native menu, clear action |
| Replacement | One `editor.transaction` for all changes; one undo restores |

Main files:

- `src/main.ts` — lifecycle, command, editor/window targeting, host selection
- `src/editor/inline-panel.ts` — CM6 panel, bottom placement, match highlight, focus controller
- `src/ui/FindReplacePanel.ts` — shared panel behavior
- `src/ui/FindReplaceModal.ts` — mobile/fallback dialog
- `src/settings.ts` — settings/state model and declarative settings tab
- `src/search/` — pure pattern/match/replace engine
- `styles.css` — inline layout, dark/light variables, compact/mobile rules

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
| Replace all | Replaces all matches in scope in one transaction; undoable |

### 3.3 Scope, direction, wrap

- **Current file**: whole document.
- **Selection**: captured when the panel opens or the scope is switched to Selection; range updated after replacements; reset to Current file when the document changes.
- Direction down/up; Shift+Enter reverses once; F3/Shift+F3 navigate.
- Wrap off produces boundary messages instead of wrapping.

### 3.4 UI rules

- Desktop panel sits at the bottom of the editor content column with a **1px solid separator line**, title, and close button; no heavy card border.
- Labels and the bottom status count are left-aligned to the same edge; status message sits at the right.
- Mode selects are three equal fixed **160px** controls, spanning the field + action columns.
- Action buttons are **122×28px** in a **252px** 2×2 column; hover/pressed feedback.
- Native toggles have 28px gaps on desktop, 16px in compact/mobile; they wrap naturally.
- The panel has no reserved empty option row; its height follows content. Very narrow windows cap the panel at **70vh** and scroll internally.
- Mobile modal is single-column with 44px controls.
- Each Obsidian window can display its own panel.

## 4. Non-functional status

| Area | Status |
|---|---|
| TypeScript strict / ESLint / tests / build | 41 tests pass; `tsc` and ESLint clean; build passes |
| Dark/light theme | Dark and light verified in Obsidian 1.15; third-party themes not specifically tested |
| English/Chinese UI | Verified; English labels/buttons fit after layout fixes |
| Accessibility | Labels, ARIA on selects/status, focus-visible, native toggle Space support, 44px mobile targets; full screen-reader audit not performed |
| Multi-window | Two Obsidian windows tested with independent panels |
| Mobile | Obsidian mobile emulation tested; real iOS/Android not tested |
| Windows/Linux | not tested |
| Performance | **No 1MB/10k-match benchmark recorded**; debounce is 180ms, replace-all is one transaction |
| Community directory | Source/build/docs audited in [COMMUNITY-READINESS.md](COMMUNITY-READINESS.md); source on `main`; tag/release `0.2.6` pending; no directory submission yet |

## 5. Acceptance status (v0.2.6)

- [x] Three modes × four actions
- [x] Exact 4 / wildcard 5 / regex 6 options
- [x] Wildcard `s` for `*`/`?`, regex `s` for `.`
- [x] Regex-only multiline anchors
- [x] Whole-word, case, wrap, direction
- [x] Current-file and selection scope
- [x] Match count, errors, action messages
- [x] History (20, clear, persist)
- [x] Single-transaction replace + undo
- [x] Desktop inline panel, 1px separator, close/Escape
- [x] Visible current-match decoration while find input focused
- [x] Native toggle options, auto-height, English/dark layout
- [x] Multi-window independent panels
- [x] Mobile modal fallback
- [x] Settings tab (4 items)
- [ ] Zero-width match visual marker (current selection is collapsed; no decoration)
- [ ] 1MB/10k-match performance benchmark
- [ ] Real iOS/Android and Windows/Linux verification
- [ ] Community submission/release packaging

## 6. Next steps

1. **P1:** Add a zero-width match marker (widget/caret decoration) if desired.
2. **P1:** Record a 1MB/10k-match benchmark and large-document interaction test.
3. **P2:** Real-device/platform checks and third-party-theme pass.
4. **P2:** Add GitHub release workflow/tag/assets and submit to the community directory when the user asks.

## 7. Development

```bash
npm install
npm test
npx tsc -noEmit
npm run lint
npm run build
```

Build output: `main.js`, `styles.css`, `manifest.json`. The dev vault install path is documented in [README.md](README.md). `main.js` is intentionally ignored by git and attached to releases as a build artifact.
