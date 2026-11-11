# UI Specification — v0.3.0

- **Status:** implemented on branch `v0.3.0` (pending acceptance); E2E-verified in Obsidian 1.15.0, macOS, Chinese/light and dark UI
- **Implementation record:** [IMPLEMENTATION.md](IMPLEMENTATION.md)
- **Plan/status:** [PLAN.md](PLAN.md)
- **Community audit:** [COMMUNITY-READINESS.md](COMMUNITY-READINESS.md)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
- **Screenshots:** [inline panel](docs/screenshots/panel-inline.png) · [dark theme](docs/screenshots/panel-dark.png) · [zero-width markers](docs/screenshots/panel-zero-width.png) · [modal fallback](docs/screenshots/modal-fallback.png)

This specification describes the current inline design and the 0.3.0 match-visibility layer.

## 1. Principles

1. The panel lives at the bottom of the note display area and participates in editor layout; it must not cover the note.
2. A single high-contrast 1px line separates the panel from the note. No heavy card border or rounded frame.
3. Use Obsidian-native components: `ToggleComponent` switches, `TextComponent`, `DropdownComponent`, `ButtonComponent`, `Menu`, `ConfirmationModal`, and CSS variables.
4. Labels and status information follow the label column, not the input/option column.
5. Every match in scope is visible; the active match is stronger and the position is always readable.
6. One panel per window/document; panels in other Obsidian windows remain independent.
7. Layout must work in English and Chinese, light and dark themes, desktop and mobile modal.
8. Large operations are bounded and confirmed; the UI must not lock up on a pathological result set.

## 2. Hosts

### 2.1 Desktop: inline CM6 panel

- Registered with `registerEditorExtension`.
- `StateField<boolean>` + `StateEffect` opens/closes the panel per editor.
- `Panel.top = false` → `.cm-panels-bottom`, i.e., the bottom of the note display area.
- DOM: `.rr-inline-panel` → `.rr-inline-frame` → `.rr-inline-container` → `.rr-panel`.
- The panel has a title/close header, the shared find/replace grid, and no target filename. It belongs to its editor view.
- Width follows the editor content column. Under 620px content width, `rr-compact` switches to a single-column layout.
- Very narrow windows cap the panel at `max-height: 70vh` with internal scrolling.
- Opening again focuses the existing panel; ✕/Escape closes and returns focus to the editor.
- Each Obsidian window has its own panel; the command finds the view by `editor` identity and only closes panels in the same `ownerDocument`.

### 2.2 Mobile / fallback: modal

- `Platform.isMobile` opens `FindReplaceModal`; no inline panel is created.
- The desktop fallback also uses the modal if no CM6 editor DOM is found.
- Modal content is single-column; actions appear after the replace field; controls are 44px tall.
- The modal uses native selection feedback; custom decorations are an inline-host feature.

## 3. Layout and dimensions

### 3.1 Inline panel

- Outer `.rr-inline-panel`: primary background, 1px `--background-modifier-border-focus` top line, 70vh max height, internal scroll if needed.
- `.rr-inline-frame`: content padding; no border/radius/background card.
- Header: 13px/600 title, 26px close button.
- Grid on desktop: `52px / minmax(0,1fr) / 252px` with 8px gaps.
- Mode row spans columns 2–3; status row spans columns 1–3.
- Labels left-aligned; the status count starts at the same left edge as `Find:`/`Replace:`/`Mode:`; the position follows the count; the status message is right-aligned.
- Inputs/selects 30px tall; action buttons 122×28px in a 252px 2×2 column.
- Mode selects: three fixed 160px controls, not matched to the input width.
- Options: native toggles; 28px column gap desktop, 16px compact/mobile; row height auto.
- Bottom clearance: 28px keeps the status message above Obsidian's status bar.

| Item | Desktop | Compact | Modal/mobile |
|---|---|---|---|
| Grid | 52 / 1fr / 252 | single column | single column |
| Input/select height | 30 | 30 | 44 |
| Action buttons | 122×28 | full-width 2×2, 28 | full-width 2×2, 44 |
| Mode selects | 160×3 | 100% stacked | 100% stacked |
| Option gap | 28px | 16px | 16px |
| Options | 4/5/6 by mode | wraps | wraps, 44px targets |
| Panel height | content | content; 70vh cap | modal content |

### 3.2 Status row (0.3.0)

```
.rr-status
  .rr-status-left
    .rr-count        — 164 个匹配 / 164 matches / 10000+ 个匹配
    .rr-position     — 11 / 164 or — / 164
  .rr-message        — action/error message, right aligned
```

- Count and position share the left edge with the labels.
- Position uses tabular numerals and does not wrap.
- The message uses `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
- In compact/mobile the row wraps; the message can fall to a second line.

### 3.3 Grid

```
grid-template-columns: 52px minmax(0, 1fr) 252px;
grid-auto-rows: min-content;
gap: 8px;
align-items: center;
```

| Row | Column 1 | Column 2 | Column 3 |
|---|---|---|---|
| 1 | Find: | input + history | Find / Replace and find |
| 2 | Replace: | input + history | Replace / Replace all |
| 3 | Mode: | three fixed selects (span 2–3) | same |
| 4 | — | options (span 2–3) | — |
| 5 | — | count + position + message (span 1–3) | same |

Labels are left-aligned. In compact/mobile single-column mode the mode row, options, and status reset to `grid-column: 1 / -1`, and actions move after the replace field.

## 4. DOM / classes

```
.rr-inline-panel
  .rr-inline-frame
    .rr-inline-container
      .rr-panel.rr-panel--inline
        .rr-panel-header
          .rr-panel-title
          button.rr-panel-close
        .rr-grid
          label.rr-label[for=rr-find-*]
          .rr-field
            input.rr-input
            button.rr-history
          .rr-actions
            button.rr-btn
          label.rr-label[for=rr-replace-*]
          .rr-field
            input.rr-input
            button.rr-history
          .rr-actions
            button.rr-btn
          span.rr-label
          .rr-mode-row
            .rr-select-wrap > select.rr-select
            .rr-select-wrap > select.rr-select
            .rr-select-wrap > select.rr-select
          .rr-options
            .rr-option
              span.rr-option-label
              .checkbox-container   ← native ToggleComponent
          .rr-status
            .rr-status-left
              .rr-count
              .rr-position
            .rr-message[role=status][aria-live=polite]
```

Editor decorations, owned by the CM6 field:

```
.rr-match-highlight
.rr-match-highlight.rr-match-highlight-active
.rr-zero-width
.rr-zero-width.rr-zero-width-active
```

Modal uses `.modal.rr-modal`, `.modal-content.rr-content`, `.rr-panel.rr-panel--modal`; the native Modal title replaces the inline header. All DOM is created on the owning element/document; no global `document` for panel UI. The history menu uses `button.ownerDocument`.

## 5. Modes and options

| Mode | Options | Count |
|---|---|---:|
| Exact | Case sensitive, Whole word, Wrap around, Replace escapes | 4 |
| Wildcard | + Match newlines | 5 |
| Regex | + Match newlines, Multiline anchors | 6 |

- **Match newlines** (`s`): wildcard `*`/`?` cross line breaks; regex `.` crosses line breaks.
- **Multiline anchors** (`m`): regex only.
- **Replace escapes**: interpret `\n`, `\r`, `\t`, `\\` before group expansion.
- Hidden options remain in state, but their flags are ignored when not applicable. Exact mode hides Match newlines and Multiline anchors; wildcard hides only Multiline anchors.
- Option rows are not reserved: wrapping changes panel height. `70vh` caps extreme cases.

Labels (Chinese / English):

| Concept | Chinese | English |
|---|---|---|
| Match newlines | 匹配换行符 | Match newlines |
| Position | `11 / 164` | `11 / 164` |
| No active position | `— / 164` | `— / 164` |
| Zero-width marker | 细竖线 | thin accent bar |

## 6. States and messages

| State | Count | Position | Buttons | Message |
|---|---|---|---|---|
| Empty find | — | — | disabled | Enter something to find |
| No matches | No matches | — | disabled | No matches |
| Invalid regex | — | — | disabled | Invalid regular expression: … |
| Valid, N matches | N matches | `— / N` or `i / N` | enabled | last action/empty |
| Find lands | N matches | `i / N` | enabled | Found match i of N / wrapped |
| Replace once/all | recomputed | — / new N | enabled | Replaced N… undo available |
| Selection scope empty | — | — | disabled until file scope | No selection; using current file |
| Document changed | recomputed | — / new N | per result | Target changed; scope reset |
| No editor | — | — | disabled | No active editor (modal fallback) |
| Too many for action | `10000+` | `— / 10000+` | find/replace once enabled; replace-all shows error | Results limited to 100000; narrow the pattern |
| Replace-all confirmation | current | current | modal | Replace N matches? This is one undoable action. |

The status container has `role="status"`, `aria-live="polite"`, `aria-atomic="true"` on the message. Errors use text and `--text-error`, not color alone.

## 7. Match highlighting

- **All matches** in the current file or captured selection use `.rr-match-highlight` with `--text-highlight-bg` (fallback `--text-selection`). Visible at all times, including while the find field has focus.
- **Active match** adds `.rr-match-highlight-active`, using `--text-selection` and an accent outline. The outline means the distinction is not color-only.
- **Zero-width matches** use a 2px accent bar (`.rr-zero-width`), with `.rr-zero-width-active` for the active position. The bar has zero width plus a border and `pointer-events: none`, so it does not shift text or block the caret.
- At most 5,000 ranges and 1,000 zero-width markers are rendered; the active range is always preserved. The count/position still reflect the scan total up to 10,000/100,000.
- Highlights are cleared on close, empty/error states, and document switch.
- Highlight effects are coalesced into a `setTimeout(0)` task; no dispatch occurs while CodeMirror is updating.

## 8. Interaction and keyboard

- Opening focuses the find field and selects its text.
- Enter in find: find in current direction. Shift+Enter: reverse once. F3/Shift+F3: next/previous.
- Enter in replace: replace and find. Shift+Enter: replace once. Mod+Enter: replace all.
- While the panel is open, F3 / Shift+F3 / Escape also work with editor focus (CM6 keymap).
- History buttons open a native `Menu` with recent values and Clear; Enter/Space accessible.
- Escape or header ✕ closes, clears highlights, and focuses the editor.
- Find selects the match and dispatches all-match + active decorations; the highlight remains visible while the find input keeps focus.
- Toggle labels and switches are both clickable; native toggle Space toggles.
- Re-running the command in the same window focuses the existing panel; opening a panel in another window leaves this one open.
- Replace all above 5,000 matches opens `ConfirmationModal`; Cancel has initial focus; confirming executes one transaction.

## 9. Accessibility

- Inputs have visible `<label for>`; mode/scope/direction selects have `aria-label` and tooltips.
- History buttons/close have textual ARIA labels and tooltips.
- Status message uses `aria-live=polite`; errors are textual.
- Buttons use real `<button>` elements and `disabled`; focus-visible outlines are defined.
- Native toggles are keyboard-focusable and Space-tested; label row click tested.
- All-match/active distinction uses an outline in addition to color; zero-width markers are `aria-hidden`.
- Mobile targets ≥44px.
- Tab flow: find → find history → find actions → replace → replace history → replace actions → mode → scope → direction → visible toggles.
- Full screen-reader audit is not recorded.

## 10. Responsive, themes, multi-window

- `rr-compact` at panel content width <620px: single column, stacked actions/modes/options/status, no spacer.
- `max-height: 70vh` with internal scroll prevents the English regex panel from exceeding a 600px-wide window.
- Only Obsidian CSS variables; no `.theme-dark` branches, no `!important`, no `:has`.
- Multi-window: command targets `editor` identity; panels are closed only within the same `ownerDocument`; one panel per window.
- Chinese/light and dark verified for 0.3.0; English strings use the same layout and were verified in 0.2.6.
- Mobile modal verified in emulation; real devices not re-tested.

## 11. Differences from the native find UI

| Item | Native find | This panel |
|---|---|---|
| Placement | top bar | bottom of note area, with 1px separator |
| Matching | literal/regex | exact / wildcard / regex |
| Modes/actions | narrower set | four actions, scope/direction, history |
| Options | few | native toggles, mode-dependent, includes replacement escapes |
| Match feedback | native highlight | all-match + active decoration + position |
| Host | editor | inline CM6 panel; modal fallback on mobile |
| Multi-window | per editor | one panel per window, independent |
| Large operations | native | bounded scan + confirmation |

## 12. Known UI gaps

- Very narrow windows require internal scrolling at the 70vh cap.
- The mobile modal has no custom all-match decorations; it relies on native selection.
- No full screen-reader or third-party-theme audit yet.
- Highlight ranges/zero-width markers are capped; extremely large result sets show `10000+` and only the first 5,000 highlighted ranges.
- YAML frontmatter/property widgets may not display raw-document decorations; not independently verified.
