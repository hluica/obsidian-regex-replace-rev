# Changelog

This changelog starts at **0.2.6**, the baseline community release. Earlier
versions are intentionally not reconstructed.

## 0.3.0 — 2026-11-11 (branch `v0.3.0`, pending acceptance)

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
