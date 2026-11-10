# Implementation Record — v0.2.6 (inline panel refinements)

Status: **implemented and verified in the local dev vault** (Obsidian 1.15.0, macOS, dark theme, English UI). Source on `main`; tag/release `0.2.6` pending. Not published to the community store. Source/build/docs audit: [COMMUNITY-READINESS.md](COMMUNITY-READINESS.md).

v0.2.6 is the current implementation. The desktop panel is embedded at the bottom of the note display area with a thin separator, fixed-width mode selects, compact action buttons, a visible current-match highlight, native Obsidian toggle switches, auto-height option rows, wildcard/regex newline support, status lines aligned with form labels, and independent panels in multiple Obsidian windows.

## Screenshots (real Obsidian windows, dark + English)

Desktop inline panel (bottom of the note area, 1px separator, current match highlighted, wildcard `s` visible):

![Inline desktop panel](docs/screenshots/panel-inline.png)

Mobile / fallback dialog:

![Modal fallback](docs/screenshots/modal-fallback.png)

## Architecture

- `src/editor/inline-panel.ts`
  - `StateField<boolean>` + `StateEffect` to open/close the panel per editor.
  - `showPanel.from(field, open => open ? constructor : null)`; `Panel.top = false` → `.cm-panels-bottom`.
  - Panel DOM: `.rr-inline-panel` → `.rr-inline-frame` → `.rr-inline-container` → shared `FindReplacePanel`.
  - `editorInfoField` supplies the Obsidian `Editor`; `EditorView.findFromDOM()` maps a MarkdownView container to its CM6 view.
  - A second `StateField<DecorationSet>` + `setInlineMatchHighlight` effect draws `.rr-match-highlight` over the current match **even while the find input has focus**. Zero-width matches intentionally fall back to no mark (the caret/position is still selected; no visual marker).
  - Highlight/clear effects are coalesced into a `setTimeout(0)` task and cancelled on close/destroy. This avoids dispatching `EditorView.update` while CM6 is mounting the panel inside an update (the previous `Calls to EditorView.update are not allowed while an update is in progress` error on an empty find pattern).
  - `Panel.update()` refreshes the count on document changes; `WeakMap` of panel controllers focuses an already-open panel.
  - Escape and the header ✕ hide the panel and clear the highlight; the editor regains focus.
  - A `ResizeObserver` adds `rr-compact` below 620px so narrow split panes stack the controls. `.rr-inline-panel` caps at `max-height: 70vh` with `overflow-y: auto` so an English regex panel in a very narrow window does not exceed the viewport.
- `src/main.ts`
  - Registers the editor extension once per plugin instance.
  - The command finds the `MarkdownView` by **editor identity** (`findMarkdownViewForEditor`), not the global active view. This makes the command act on the window/editor that invoked it.
  - On desktop it opens the inline panel in that editor’s CM6 view; on mobile or when no CM6 editor DOM exists it opens the modal fallback.
  - `closeOtherInlinePanelsInWindow()` closes other panels only in the same `ownerDocument`; panels in other Obsidian windows remain open. Mobile closes all inline panels before showing the modal.
- `src/ui/FindReplacePanel.ts`
  - Shared UI/behavior; inline header/title/close; no global target tracking.
  - Mode-aware options:
    - exact: case, whole word, wrap, replace escapes (4);
    - wildcard: + Match newlines (5);
    - regex: + Match newlines + Multiline anchors (6).
  - **Match newlines** uses `s`: in wildcard mode `*`/`?` cross line breaks; in regex mode `.` crosses line breaks. Multiline anchors (`m`) are regex-only.
  - Options use **native `ToggleComponent` switches** (`.rr-option` + `.checkbox-container`), 28px column gaps on desktop and 16px in compact/mobile. No reserved empty row; wrapping changes the panel height.
  - Clicking the option label or the switch toggles it; the native `.checkbox-container` is keyboard-focusable and Space toggles it.
  - The **Replace escapes** toggle is part of `SearchUiState`; the settings model has no separate `processEscapes` item.
  - Document change resets a captured selection scope.
- `src/ui/FindReplaceModal.ts`
  - Mobile/fallback host. Single-column layout on narrow/mobile screens with actions after the replace field.
- CSS
  - `.rr-inline-panel` has a single **1px solid high-contrast top line**, no card border, no rounded frame.
  - Four action buttons are 28px tall in a 252px 2×2 column (about 122px each); hover and pressed (accent + translateY) feedback. The width fits the English “Replace and find” (101px text; 120px content).
  - Labels are left-aligned; the status row spans the full grid and starts at the same left edge as “Find/Replace/Mode”. The message sits at the right edge above the native status bar.
  - Mode selects are three equal fixed 160px widths, spanning field + actions columns instead of matching the input width.
  - Compact layout for narrow editors; mobile modal uses 44px controls; inline panel has 28px status-bar clearance.

## What was built

| Area | Status |
|---|---|
| Three modes (exact / wildcard / regex) | done |
| Four actions (find, replace once, replace & find, replace all) | done |
| Native toggle options: case, whole word, wrap, replace escapes | done |
| Wildcard `s` (Match newlines for `*`/`?`) | done |
| Regex `s` (Match newlines for `.`) | done |
| Regex-only Multiline anchors | done |
| Option-row auto height (no reserved empty row) | done |
| Direction down/up, wrap-off boundary feedback | done |
| Current file / captured selection scope | done |
| Live match count + status/error messages | done |
| Search/replace history (20 entries, clear) | done |
| Desktop inline panel at note bottom, thin separator | done |
| Visible current-match decoration while find focused | done |
| Smaller buttons with hover/pressed feedback | done |
| Independent panels in multiple Obsidian windows | done |
| Compact stacked layout in narrow panes | done |
| Very narrow panel scroll cap (70vh) | done |
| Mobile modal fallback, ordered single-column layout | done |
| Declarative settings (1.13+) | done |
| Dark theme + English UI verified | done |
| Single-transaction replacement + undo | done |
| Unit tests, lint, type-check, build | done |

## Verification performed

### Static

```bash
npm test          # 4 files, 41 tests passed
npx tsc -noEmit   # passed
npx eslint .      # 0 errors, 0 warnings
npm run build     # main.js produced (v0.2.6)
```

### Obsidian end-to-end (dev vault, dark + English)

- Plugin loads with no `dev:errors`; manifest version 0.2.6.
- Command opens `.rr-inline-panel` inside `.cm-panels-bottom` at the bottom of the note area.
- Separator computed as 1px `--background-modifier-border-focus`; no frame border/card radius.
- English/dark labels and status measured at left **360px** (`Find:`, `Replace:`, `Mode:`, and the match count); status message right-aligned.
- Action buttons measured **122×28px**; English “Replace and find” text ≈101px with 120px content width; no ellipsis.
- Exact mode: 4 toggles; wildcard: 5 (Match newlines visible); regex: 6 (Match newlines + Multiline anchors).
- Wildcard `s` behavior: pattern `写*你` with Match newlines off → “No matches”; on → 1 match. Regex/wildcard engine test already covers `a.b`/`a*b` with dotAll.
- Options `Match newlines` tooltip: “In wildcard mode, let * and ? match newlines; in regex mode, let . match newlines (s flag).” Chinese: “通配符模式下让 * 和 ? 匹配换行符；正则模式下让 . 匹配换行符（s 标志）。”
- Find via Enter selected the match and drew `.rr-match-highlight` while the find input remained focused; dark-theme highlight visible.
- Replace all via the inline panel changed the note; undo restored it. Replace escapes (`A\nB` with toggle on) inserted a newline.
- Header ✕ and Escape both close the panel, clear the highlight and return focus to the editor.
- Empty find pattern on panel mount no longer throws; the panel opens with “Enter something to find”. Find then clear restores highlight 1 → 0 without errors; close/reopen with a pending highlight is clean.
- Toggle labels, switches and Space key were exercised; state updates correctly.
- Dark modal: `.modal.rr-modal` opens single-column with actions after replace, 44px controls, four exact-mode toggles.
- English button/label overflow checked; no truncation after widening the action column.
- **Multi-window**: two Obsidian windows each showed 1 `.rr-inline-panel`; invoking the command in the second window selected `test` in `Untitled.md`, while the main window kept its `笔记` selection; closing the main panel left the second panel at 1; `dev:errors` empty.
- Width sweep (English/dark; window width / panel width / rows / panel height):
  - 1000 / 656 / exact 2, wildcard 2, regex 2 / 290
  - 900 / 556 compact / 2 / 493
  - 800 / 456 compact / exact 2, wildcard 2, regex 3 / 493, 493, 520
  - 700 / 356 compact / 2, 3, 3 / capped 560 (content 644–696, internal scroll)
  - 600 / 256 compact / 4, 5, 6 / capped 560 (content 748–852, internal scroll)
- Settings tab has 4 items.

## Known limitations

- No highlight for **all** matches; only the current match is decorated/selected, with a count.
- Zero-width matches have no separate visual marker (the caret/selection is collapsed and the find message still reports the result).
- Whole-word regex alternation edge case (`foo|foobar`) as documented.
- Single-line input fields; multi-line replacement uses `\n` or the panel’s Replace escapes toggle.
- No vault-wide replace; no `u` flag exposure.
- The inline panel consumes vertical space while open; its height changes when toggle options wrap. Very narrow windows cap it at 70vh and require internal scrolling.
- No 1MB/10k performance benchmark is recorded.
- Real iOS/Android devices and Windows/Linux were not tested; mobile mode was tested with Obsidian’s mobile emulation.
- The panel follows the editor content column width; in very wide notes it does not stretch to the full window.

## Install / update

Build artifacts at the project root: `main.js`, `manifest.json`, `styles.css`.

Dev vault used for verification:

```
/Users/hanluica/Documents/Obsidian/dev/.obsidian/plugins/regex-replace-rev/
```

For another vault, copy the same three files into `<vault>/.obsidian/plugins/regex-replace-rev/` and enable the plugin. `main.js` is intentionally gitignored and must be attached to the GitHub release as a build artifact.

## Main files

- `src/main.ts` — plugin lifecycle, command, editor/window targeting, inline/modal host selection
- `src/editor/inline-panel.ts` — CM6 panel extension, bottom placement, current-match decoration, controller, focus
- `src/ui/FindReplacePanel.ts` — shared UI/behavior, native toggle options, mode-aware options
- `src/ui/FindReplaceModal.ts` — mobile/fallback dialog
- `src/ui/host.ts` — shared host contracts
- `src/settings.ts` — settings/state model, declarative settings tab
- `src/i18n/` — en/zh strings
- `src/search/` — pure engine
- `styles.css` — inline separator, buttons, compact/mobile styling
- `tests/` — 41 unit tests
