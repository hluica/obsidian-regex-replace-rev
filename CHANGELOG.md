# Changelog

This changelog starts at **0.2.6**, the baseline community release. Earlier
versions are intentionally not reconstructed.

## 0.3.3 — 2026-11-11 (release candidate, branch `v0.3.0`)

0.3.3 is the first public-release candidate; it remains on the development
branch pending acceptance, merge, tag, and community-directory update.

### Added

- **Unicode (u) option** in regex mode. It adds the `u` flag, enables
  `\p{...}` property escapes, and matches astral characters as one code point.
  The toggle is hidden in exact/wildcard modes, is persisted with the panel
  state, and defaults to off.
- **Accessibility grouping/landmarks**: the panel is a labelled `region`, the
  inline title is a level-2 heading, the option row is a labelled group, and
  history buttons expose `aria-haspopup="menu"` plus `aria-expanded` state.
- **Third-party theme audit**: Catppuccin (enabled) and Minimal were tested in
  the dev vault; the panel, switches, status, zero-width dots, and `↵` markers
  use theme variables.

### Changed

- Regex mode now exposes seven options (case, whole word, match newlines,
  multiline anchors, Unicode, wrap, replace escapes).
- The active match uses an accent-tinted background and a 2px accent outline
  instead of the selection color alone. This keeps the active match stronger
  than inactive matches on themes whose highlight background is opaque.

### Fixed

- Active-match contrast on Catppuccin: the current match was weaker than the
  all-match peach background; the accent outline and tint now make it distinct.
- Accessibility tree lacked a panel landmark/heading and history expansion
  state; both are now exposed.
- Tablet/mobile global `button` padding was shrinking the selection and
  history icons to a few pixels; plugin-scoped padding overrides restore full
  icons. The selection-refresh control now uses the `scan` icon, distinct from
  the history clocks.

### Verification

- 61 unit tests across 6 files; TypeScript, ESLint, and production build pass.
- `\p{Script=Han}+` finds 2,665 runs with Unicode enabled and no matches when
  disabled; astral `.` matches one code point with `u` and two surrogate halves
  without it.
- Chromium accessibility tree: region “查找与替换”, heading level 2, seven
  named checkboxes (including Unicode), three named comboboxes, live status,
  history `aria-expanded=false`.
- Catppuccin and Minimal: panel chrome, active/inactive highlights, toggles,
  scope button, zero-width dots, and newline markers remain visible.
- Four compact/narrow and one 1 MB checks from 0.3.2 remain green.

## 0.3.2 — 2026-11-11 (branch `v0.3.0`, internal, not released)

0.3.2 is another internal transitional version; 0.3.3 is the next external
release candidate.

### Added

- A **Use current selection** button next to the scope selector. It captures
  the current editor selection, switches the scope to Selection, and refreshes
  the captured range without closing/reopening the panel. With no selection it
  falls back to the current file and reports the existing “no selection”
  message.
- A success message (“Selection updated”) after refreshing a valid selection.

### Changed

- The find/replace history buttons now use the Lucide **history** icon instead
  of a chevron-down that looked like a dropdown.
- Panel-driven settings writes are debounced by 500 ms. The settings tab and
  `saveSettings()` remain immediate; `onunload` flushes a pending save. This
  avoids writing `data.json` on every Find/Replace keystroke.
- `collectLineBreakPositions()` is now a pure function in
  `src/editor/highlights.ts`, covered by unit tests; the panel computes it when
  the match set changes and reuses the cached positions when the selection or
  active index changes.

### Verification

- 59 unit tests across 6 files; TypeScript, ESLint, and production build pass.
- Selection button: refreshes a body selection (1 match), reports “已更新选区范围”;
  with an empty selection it resets to Current file and reports the existing
  message.
- History buttons render `lucide-history`.
- `data.json` mtime stays unchanged 120 ms after Find and updates after the
  500 ms debounce.
- Compact 124px panel: scope select keeps “当前文件”, refresh button remains
  visible, no horizontal overflow.

## 0.3.1 — 2026-11-11 (branch `v0.3.0`, internal, pending acceptance)

0.3.0 was never released; 0.3.1 supersedes it on the same branch. **0.3.1 is an internal transitional version and will not be released; 0.3.2 follows as another internal iteration, with 0.3.3 as the next external release candidate.**

### Changed

- Redesigned zero-width markers from theme-accent vertical bars to small
  **translucent gray dots** for inactive matches and **filled accent dots** with a
  background-colored halo for the active match. The dots use a pseudo-element
  with zero layout width and sit just above the insertion point, so they do
  not shift text, collide with a blockquote border, or get confused with one.
- Compact panels below 260px now stack the four action buttons one per row and
  allow the count/position group to wrap; 700px/500px viewport checks show no
  horizontal overflow.
- Panel resize handling defers compact-class updates to
  `requestAnimationFrame` and ignores unchanged widths, avoiding
  ResizeObserver loop warnings while a popout or window is being resized.
- Added **line-break markers** for matches that contain `\n` (for example
  `\n`, `。\n`, or a dotAll match crossing lines). Each covered newline shows
  a small `↵` pill at the end of the affected line; the active match's pill is
  filled with the accent color. The pill is absolutely positioned so it does
  not change line width. A newline-only match is now visible even though
  the newline itself has no glyph.

### Added

- `buildLineBreakPlan()` pure planner with de-duplication, clamping, active
  priority, and a 1,000-marker cap.
- 4 new unit tests for line-break planning and a stacked zero-width de-duplication test.

### Verification

- 56 unit tests across 6 files; TypeScript, ESLint, and production build pass.
- Obsidian 1.15.0 light/dark: zero-width active dot, newline-only match `↵`,
  and combined `。\n` match with both the character highlight and the mark.
- Compact checks: 700px viewport → 324px panel, 500px → 124px panel; action
  buttons one per row at 124px, status wraps to 44px, no horizontal overflow.
- 1 MB / 10,500 lines: `\n` count 10,000+ in 185.4 ms (including the 180 ms
  debounce); dotAll `.*` 185.3 ms; zero-width `^` 188.5 ms; no freeze.
- Selection scope with `\n` and `。\n`: count/offset/marker positions correct.
- Popout window: independent panels; F3/Escape in the popout; closing it via
  the normal window command leaves the main panel intact and logs no errors.

## 0.3.0 — 2026-11-11 (branch `v0.3.0`, not released)

### Added

- Highlight **all matches** in the current file or captured selection, with a
  distinct active-match style, so a search result is visible without stepping
  through it.
- Show a persistent **current position** (`3 / 164`) next to the match count;
  it follows Find, selection changes, replacements, and panel reopen.
- Draw a small marker for **zero-width matches** (`^`, `\b`, lookahead), with a
  distinct active marker.
- Support **F3 / Shift+F3 / Escape from the editor** while the panel is open;
  the panel no longer requires focus for match navigation.
- Confirm **Replace all** when more than 5,000 matches are affected; the
  confirmation can be cancelled and still leaves one undoable transaction.

### Changed

- Match scans for display are capped at 10,000 visible results and action scans
  at 100,000; replace-all refuses to run beyond the action cap instead of
  building an unbounded transaction.
- Highlight rendering keeps at most 5,000 ranges and 1,000 zero-width markers,
  while always preserving the active match.
- The status row now separates count, position, and message; the match position
  has the same left alignment as the count.

### Fixed

- The panel no longer loses its current-match feedback after a document change
  or when the editor keeps focus.
- Highlight updates requested during a CodeMirror update are still coalesced;
  the v0.2.6 mount-time dispatch guard remains in place.

### Verification

- 51 unit tests across 6 files; TypeScript, ESLint, and production build pass.
- Obsidian 1.15.0 dev vault: 164 matches in a 55 KB note, all-match highlights,
  position tracking, zero-width markers, F3/Shift+F3/Escape from the editor,
  replace-all confirmation and undo, 100,000-match cap, mobile modal.
- 1 MB / 10,000+ match note: count refresh ≈185 ms including the 180 ms
  debounce (scanning itself is milliseconds); `dev:errors` empty.

## 0.2.6 — 2026-11-11 (baseline)

- Baseline community release: desktop inline find/replace panel, mobile modal,
  exact / wildcard / regex modes, case / whole word / newline / multiline /
  wrap / replacement-escape options, current-file and selection scope,
  direction, history, and single-transaction replacement.
- Listed in the Obsidian community directory; GitHub release `0.2.6` with
  `main.js`, `manifest.json`, and `styles.css`.
