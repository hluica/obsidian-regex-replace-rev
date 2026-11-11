# Implementation Record — v0.3.0 (match visibility and navigation)

Status: **implemented on branch `v0.3.0`, pending acceptance and merge**. E2E-verified in the local dev vault (Obsidian 1.15.0, macOS, Chinese/light and dark UI). The 0.2.6 baseline is listed in the community directory; the 0.3.0 tag/release is pending. See [CHANGELOG.md](CHANGELOG.md) and [COMMUNITY-READINESS.md](COMMUNITY-READINESS.md).

v0.3.0 adds all-match highlighting, a persistent current-match position, zero-width markers, editor-focus keyboard navigation, and bounded replace-all behavior.

## Screenshots (real Obsidian window, Chinese/light)

Desktop inline panel: all matches in the visible note are highlighted, the active match has an accent outline, and the status shows `164 个匹配  11 / 164`:

![Inline desktop panel](docs/screenshots/panel-inline.png)

Dark theme with the same all-match/active distinction:

![Inline desktop panel, dark theme](docs/screenshots/panel-dark.png)

Zero-width matches (`^` with multiline anchors): line-start markers, with a stronger active marker:

![Zero-width markers](docs/screenshots/panel-zero-width.png)

Mobile / fallback dialog:

![Modal fallback](docs/screenshots/modal-fallback.png)

## Architecture

### All-match decorations — `src/editor/inline-panel.ts`

- `StateEffect` `setInlineMatchHighlights` carries `{ ranges, active } | null`; `matchHighlightField` stores one `DecorationSet`.
- Marks: `.rr-match-highlight` for every match, `.rr-match-highlight-active` for the active range.
- Zero-width ranges become `Decoration.widget` instances (`.rr-zero-width`, active `.rr-zero-width-active`) instead of marks, because a mark with `from === to` renders nothing.
- `src/editor/highlights.ts` is a pure planner: clamps to the document, sorts, de-duplicates exact ranges and zero-width positions, prioritizes the active range, and applies the 5,000 mark / 1,000 zero-width caps.
- The existing `setTimeout(0)` coalescing remains; highlight requests from a CodeMirror update or panel mount are dispatched after the current update completes.
- `closeInlinePanel` clears highlights and closes the panel in one transaction.

### Editor-focus navigation

- `panelControllers` now exposes `focus`, `findNext`, `findPrevious`, and `close`.
- `createInlinePanelExtension` returns `Prec.high(keymap.of(F3, Shift-F3, Escape))`. Handlers return `false` when no panel controller exists, so normal editor behavior is untouched when the panel is closed.
- The panel's own input key handling remains unchanged.

### Position and selection tracking

- `FindReplacePanel` tracks `activeIndex`, `matchCount`, and `truncated`.
- After each scan, the selected range is matched against the scanned matches; `refresh()` re-derives the position so reopening the panel with a selected match shows the correct index.
- CodeMirror `selectionSet` updates call `handleSelectionChange()`; it only re-syncs when the active index actually changes.
- The status row is now `count + position` on the left and the action message on the right.
- Document changes reset the position and schedule the debounced refresh.

### Bounded replace-all

- Limits live in `src/search/limits.ts`:
  - display scan `10_000`;
  - action scan `100_000`;
  - highlight ranges `5_000`;
  - zero-width markers `1_000`;
  - confirmation threshold `5_000`.
- Find / Replace / Replace-all scan with the action limit instead of `Infinity`.
- Replace all refuses to run when the scan is truncated; above 5,000 matches it opens an Obsidian `ConfirmationModal` (1.13+). The cancel button has initial focus; confirming re-scans and executes one transaction.
- The count shows `10000+` when the display scan is truncated; the position uses the same display total.

### UI/CSS

- `.rr-status-left` groups the count and position; `.rr-position` uses tabular numerals.
- `.rr-match-highlight` uses `var(--text-highlight-bg, var(--text-selection))`; the active class uses `var(--text-selection)` plus an accent outline so the distinction is not color-only.
- `.rr-zero-width` is a zero-width inline block with a 2px accent left border, `pointer-events: none`, and reduced opacity for inactive markers.
- Existing desktop/compact/mobile layout rules are unchanged.

## What was built

| Area | Status |
|---|---|
| Three modes (exact / wildcard / regex) | done |
| Four actions (find, replace once, replace & find, replace all) | done |
| Native toggle options and mode-aware visibility | done |
| All-match highlighting | done |
| Active match with distinct outline | done |
| Persistent `position / total` | done |
| Zero-width match markers | done |
| F3 / Shift+F3 / Escape from the editor | done |
| Replace-all confirmation above 5,000 | done |
| 100,000 action-scan cap and `10000+` display | done |
| Current-file / captured selection scope | done |
| Live count + status/error messages | done |
| History (20, clear, persist) | done |
| Desktop inline panel, compact layout, multi-window | done (0.2.6 regression baseline) |
| Mobile modal fallback | done |
| Declarative settings | done |
| Unit tests, lint, type-check, build | done |

## Verification performed

### Static

```bash
npm test          # 6 files, 51 tests passed
npx tsc -noEmit   # passed
npx eslint .      # 0 errors, 0 warnings
npm run build     # main.js produced (v0.3.0, ~44 KB)
```

### Obsidian end-to-end (dev vault)

- Plugin `0.3.0` loads and reloads with no `dev:errors`; manifest version 0.3.0.
- Desktop panel opens in `.cm-panels-bottom`; status shows `164 个匹配  — / 164` before Find.
- All-match highlighting: 164 matches, 17 visible `.rr-match-highlight` nodes in the viewport; Find adds one `.rr-match-highlight-active` and shows `3 / 164` plus “已定位第 3 / 164 个匹配”.
- Selecting a body match with the editor API updates the position to `11 / 164` and adds the active class. Moving the caret off matches returns `— / 164` and removes the active class.
- Closing and reopening the panel with a selected match restores `11 / 164` and the active highlight.
- Zero-width: `^` with multiline anchors produced 229 matches; 12 visible `.rr-zero-width` markers; Find produced one `.rr-zero-width-active` and `9 / 229`.
- Editor-focus keys: F3 from `.cm-content` moved `9 / 229 → 10 / 229`; Shift+F3 returned to `9 / 229`; Escape closed the panel and left focus in the editor.
- Replace all: `.` on the 55 KB note produced 19,588 matches; Replace all opened “替换全部匹配？” with “确定替换 19588 处？” and Cancel focused; Cancel closed the modal without changes.
- Replace all on a 6,000-match scratch note: confirmation → replace → `已替换 6000 处，可撤销`; undo restored all 6,000 characters.
- Safety cap: a 150,000-match scratch note shows `10000+` and Replace all reports “结果超过 100000 条，请缩小查找范围” without opening a modal.
- 1 MB scratch note (10,500 matches): input-to-count update 184.9 ms including the 180 ms debounce; `10000+` count and 10 visible highlights; `dev:errors` empty.
- Mobile emulation: `.modal.rr-modal` opens single-column, 44px controls, 6 options; Find updates `2 / 164`; no errors.
- Scratch notes were deleted after testing; no content changes were left in the dev vault.

### Known limitations

- Highlight rendering is capped at 5,000 ranges / 1,000 zero-width markers; the count and position still report the full scanned total.
- Replace-all is blocked above 100,000 matches rather than offering a chunked or background replacement.
- The mobile modal has no custom decorations; it relies on the native selection, count, and position.
- CM6 decorations in YAML frontmatter/properties are not independently verified; the editor's property widgets may not show marks that exist in the raw document.
- Real iOS/Android, Windows/Linux, and third-party themes are not re-tested for 0.3.0.
- The `u` regex flag, multiline literal inputs, preserve case, and vault-wide replace remain out of scope.

## Install / update

Build artifacts at the project root: `main.js`, `manifest.json`, `styles.css`.

Dev vault used for verification:

```
/Users/hanluica/Documents/Obsidian/dev/.obsidian/plugins/regex-replace-rev/
```

For another vault, copy the same three files into `<vault>/.obsidian/plugins/regex-replace-rev/` and enable the plugin. `main.js` is intentionally gitignored and must be attached to the GitHub release as a build artifact.

## Main files

- `src/main.ts` — plugin lifecycle, command, editor/window targeting, host selection
- `src/editor/inline-panel.ts` — CM6 panel extension, all-match decoration field, zero-width widget, keymap
- `src/editor/highlights.ts` — pure highlight planning (clamp/sort/dedupe/caps)
- `src/ui/FindReplacePanel.ts` — shared UI/behavior, position, scope, history, confirmation
- `src/ui/FindReplaceModal.ts` — mobile/fallback dialog
- `src/ui/host.ts` — shared host contracts
- `src/settings.ts` — settings/state model, declarative settings tab
- `src/i18n/` — en/zh strings
- `src/search/` — pure engine; `src/search/limits.ts` guard rails
- `styles.css` — inline separator, highlights, zero-width markers, compact/mobile styling
- `tests/` — 51 unit tests across 6 files
