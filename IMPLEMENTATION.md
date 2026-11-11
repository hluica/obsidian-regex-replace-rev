# Implementation Record — v0.3.1 (match markers and visibility)

Status: **implemented on branch `v0.3.0`, pending acceptance; development continues on the branch until the next stable version**. E2E-verified in the local dev vault (Obsidian 1.15.0, macOS, Chinese/light and dark UI). The 0.2.6 baseline is listed in the community directory; 0.3.1 is an internal transitional version and will not be tagged/released (0.3.0 was also not released). 0.3.2 is the next external release candidate. See [CHANGELOG.md](CHANGELOG.md) and [COMMUNITY-READINESS.md](COMMUNITY-READINESS.md).

v0.3.1 adds all-match highlighting, a persistent current-match position, redesigned zero-width dots, visible line-break markers for `\n` matches, editor-focus keyboard navigation, and bounded replace-all behavior.

## Screenshots (real Obsidian window, Chinese/light and dark)

Desktop inline panel: all matches in the visible note are highlighted, the active match has an accent outline, and the status shows `164 个匹配  11 / 164`:

![Inline desktop panel](docs/screenshots/panel-inline.png)

Dark theme with the same all-match/active distinction:

![Inline desktop panel, dark theme](docs/screenshots/panel-dark.png)

Zero-width matches (`^` with multiline anchors): translucent gray dots, with a filled active dot and halo:

![Zero-width markers](docs/screenshots/panel-zero-width.png)

Newline-only match (`\n`): each line break gets an `↵` pill; the active break is filled:

![Newline markers](docs/screenshots/panel-newline.png)

Mixed match (`。\n`): the visible character is highlighted and the break gets a marker:

![Combined text and newline](docs/screenshots/panel-newline-combo.png)

Mobile / fallback dialog:

![Modal fallback](docs/screenshots/modal-fallback.png)

## Architecture

### All-match decorations — `src/editor/inline-panel.ts`

- `StateEffect` `setInlineMatchHighlights` carries `{ ranges, active, lineBreaks? } | null`; `matchHighlightField` stores one `DecorationSet`.
- Marks: `.rr-match-highlight` for every match, `.rr-match-highlight-active` for the active range.
- Zero-width ranges become `Decoration.widget` instances (`.rr-zero-width`, active `.rr-zero-width-active`). They are translucent gray filled dots for inactive matches and filled accent dots with a `--background-primary` halo for the active match; the shape no longer resembles a blockquote border.
- Newline positions inside a match text become `LineBreakMarker` widgets (`.rr-line-break`, active `.rr-line-break-active`) displaying `↵`. A newline-only match has no mark, but its marker is visible; `。\n` shows both the character mark and the marker.
- `src/editor/highlights.ts` has two pure planners: `buildHighlightPlan()` clamps, sorts, de-duplicates, prioritizes the active range, and applies the 5,000 mark / 1,000 zero-width caps; `buildLineBreakPlan()` de-duplicates line-break positions, marks the active range, and caps at 1,000 markers while preserving the active break.
- The existing `setTimeout(0)` coalescing remains; highlight requests from a CodeMirror update or panel mount are dispatched after the current update completes.
- `closeInlinePanel` clears highlights and closes the panel in one transaction.

### Editor-focus navigation

- `panelControllers` now exposes `focus`, `findNext`, `findPrevious`, and `close`.
- `createInlinePanelExtension` returns `Prec.high(keymap.of(F3, Shift-F3, Escape))`. Handlers return `false` when no panel controller exists, so normal editor behavior is untouched when the panel is closed.
- The panel's own input key handling remains unchanged.

### Position and selection tracking

- `FindReplacePanel` tracks `activeIndex`, `matchCount`, and `truncated`; `collectLineBreaks()` derives absolute `\n` positions from matched text and sends them with each highlight request.
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
  - line-break markers `1_000`;
  - confirmation threshold `5_000`.
- Find / Replace / Replace-all scan with the action limit instead of `Infinity`.
- Replace all refuses to run when the scan is truncated; above 5,000 matches it opens an Obsidian `ConfirmationModal` (1.13+). The cancel button has initial focus; confirming re-scans and executes one transaction.
- The count shows `10000+` when the display scan is truncated; the position uses the same display total.

### UI/CSS

- `.rr-status-left` groups the count and position; `.rr-position` uses tabular numerals.
- `.rr-match-highlight` uses `var(--text-highlight-bg, color-mix(... --text-selection ...))`; the active class uses `var(--text-selection)` plus an accent outline so the distinction is not color-only.
- `.rr-zero-width` is a 6px translucent-gray filled circular dot above the insertion point for inactive matches; `.rr-zero-width-active` is filled accent with a background-colored halo. Both use a zero-layout-width pseudo-element, so text does not shift.
- `.rr-line-break` is an absolutely positioned `↵` pill at the line end; `.rr-line-break-active` is accent-filled with `--text-on-accent` text. It does not change line width.
- Below 260px, `.rr-narrow` stacks the four action buttons one per row and lets `.rr-status-left` wrap; this avoids clipped action labels in very narrow panes.
- `ResizeObserver` compact updates are coalesced through `requestAnimationFrame` and skipped when the width is unchanged; the initial update happens before observing. This avoids ResizeObserver loop warnings during viewport/popout resizes.

## What was built

| Area | Status |
|---|---|
| Three modes (exact / wildcard / regex) | done |
| Four actions (find, replace once, replace & find, replace all) | done |
| Native toggle options and mode-aware visibility | done |
| All-match highlighting | done |
| Active match with distinct outline | done |
| Persistent `position / total` | done |
| Zero-width match markers (translucent gray / accent dots) | done |
| Line-break markers (`\n`, `。\n`) | done |
| F3 / Shift+F3 / Escape from the editor | done |
| Replace-all confirmation above 5,000 | done |
| 100,000 action-scan cap and `10000+` display | done |
| Current-file / captured selection scope | done |
| Live count + status/error messages | done |
| History (20, clear, persist) | done |
| Desktop inline panel, compact/narrow layout, multi-window | done (0.2.6 regression baseline; 0.3.1 narrow fix) |
| Mobile modal fallback | done |
| Declarative settings | done |
| Unit tests, lint, type-check, build | done |

## Verification performed

### Static

```bash
npm test          # 6 files, 56 tests passed
npx tsc -noEmit   # passed
npx eslint .      # 0 errors, 0 warnings
npm run build     # main.js produced (v0.3.1, ~44 KB)
```

### Obsidian end-to-end (dev vault)

- Plugin `0.3.1` loads and reloads with no `dev:errors`; manifest version 0.3.1.
- Desktop panel opens in `.cm-panels-bottom`; status shows `164 个匹配  — / 164` before Find.
- All-match highlighting: 164 matches, 17 visible `.rr-match-highlight` nodes in the viewport; Find adds one `.rr-match-highlight-active` and shows `3 / 164` plus “已定位第 3 / 164 个匹配”.
- Selecting a body match with the editor API updates the position to `11 / 164` and adds the active class. Moving the caret off matches returns `— / 164` and removes the active class.
- Closing and reopening the panel with a selected match restores `11 / 164` and the active highlight.
- Zero-width: `^` with multiline anchors produced 229 matches; 16 visible translucent-gray `.rr-zero-width` dots; Find produced one filled `.rr-zero-width-active` and `9 / 229` (later `47 / 229` in the scrolled test).
- Newline: regex `\n` on the 55 KB note produced 228 matches and 24 visible `.rr-line-break` pills; Find produced one `.rr-line-break-active` and `47 / 228`, with no `.rr-match-highlight` (the break has no glyph).
- Mixed `。\n` on a small note: 1 match, 1 `.rr-match-highlight` containing `。`, 1 `.rr-line-break`, and the marker sits at the line end.
- Dark theme: zero dot, active dot, and `↵` markers use theme variables; inactive vs active contrast is visible.
- Editor-focus keys: F3 from `.cm-content` moved `9 / 229 → 10 / 229`; Shift+F3 returned to `9 / 229`; Escape closed the panel and left focus in the editor.
- Replace all: `.` on the 55 KB note produced 19,588 matches; Replace all opened “替换全部匹配？” with “确定替换 19588 处？” and Cancel focused; Cancel closed the modal without changes.
- Replace all on a 6,000-match scratch note: confirmation → replace → `已替换 6000 处，可撤销`; undo restored all 6,000 characters.
- Safety cap: a 150,000-match scratch note shows `10000+` and Replace all reports “结果超过 100000 条，请缩小查找范围” without opening a modal.
- 1 MB scratch note (10,500 matches): input-to-count update 184.9 ms including the 180 ms debounce; `10000+` count and 10 visible highlights; `dev:errors` empty.
- 1 MB / 10,500-line note: `\n` count `10000+` in 185.4 ms including debounce; dotAll `.*` 185.3 ms; zero-width `^` 188.5 ms; visible markers capped and no freeze.
- Selection scope (`第一段。\n第二段\n第三段。`): `\n` → 1 match/1 marker; `。\n` → 1 match, 1 character mark, 1 active `↵`; offsets are absolute and correct.
- Compact widths: 700px viewport → 324px panel (compact), 500px → 124px panel (compact + narrow). At 124px, actions are one per row, labels fit, status-left wraps, status height 44px, no horizontal overflow; the panel uses the documented 70vh internal scroll.
- Document edit with `\n` search: inserting a real newline updates 2 → 3 matches/markers; undo returns to 2. Replace all of `\n` with `|` gives `a|b|c`, `无匹配`, and undo restores `a\nb\nc`.
- Popout window: main and popout panels are independent; F3 in the popout changes `1 / 2 → 2 / 2`; Escape closes only the popout panel. Closing the popout through `workspace:close-window` leaves the main panel open and logs no errors.
- ResizeObserver regression: manual width changes and CDP viewport changes (700px, 500px) produce no `ResizeObserver loop` errors after the rAF/width guard. Forcing `leaf.detach()` on a popout can still produce browser resize warnings; normal window close does not.
- Mobile emulation: `.modal.rr-modal` opens single-column, 44px controls, 6 options; Find updates `2 / 164`; no errors.
- Scratch notes were deleted after testing; no content changes were left in the dev vault.

### Known limitations

- Highlight rendering is capped at 5,000 ranges / 1,000 zero-width dots / 1,000 line-break markers; the count and position still report the full scanned total.
- Replace-all is blocked above 100,000 matches rather than offering a chunked or background replacement.
- The mobile modal has no custom decorations; it relies on the native selection, count, and position.
- CM6 decorations in YAML frontmatter/properties are not independently verified; the editor's property widgets may not show marks that exist in the raw document.
- Real iOS/Android, Windows/Linux, and third-party themes are not re-tested for 0.3.1.
- At 124px panel width the compact panel is taller than 70vh and the status row requires internal scrolling; this is the documented narrow-window tradeoff.
- Programmatic popout teardown with `leaf.detach()` still emits browser ResizeObserver warnings in some runs; normal `workspace:close-window` was clean.
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
- `src/editor/highlights.ts` — pure highlight/line-break planning (clamp/sort/dedupe/caps)
- `src/ui/FindReplacePanel.ts` — shared UI/behavior, position, scope, history, confirmation
- `src/ui/FindReplaceModal.ts` — mobile/fallback dialog
- `src/ui/host.ts` — shared host contracts
- `src/settings.ts` — settings/state model, declarative settings tab
- `src/i18n/` — en/zh strings
- `src/search/` — pure engine; `src/search/limits.ts` guard rails
- `styles.css` — inline separator, highlights, zero-width dots, line-break markers, compact/mobile styling
- `tests/` — 56 unit tests across 6 files
