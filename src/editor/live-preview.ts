import type { Editor, EditorPosition, EditorRange } from "obsidian";
import type { HighlightRange } from "./highlights";

/**
 * Obsidian's in-document find paints matches with this class. Live Preview
 * treats ranges carrying it as "already visible": instead of replacing their
 * Markdown syntax with rendered widgets, it shows the original source. Adding
 * the class therefore both highlights the match and reveals the raw text of
 * constructs such as callout markers, emphasis delimiters, and links.
 */
export const LIVE_PREVIEW_HIGHLIGHT_CLASS =
	"obsidian-search-match-highlight";

declare module "obsidian" {
	interface Editor {
		/**
		 * Undocumented, but used by Obsidian's own in-document find. Adds a
		 * named highlight set to the editor. `unfold` expands folded ranges
		 * that contain a highlight so the match is on screen.
		 */
		addHighlights?(
			ranges: EditorRange[],
			className: string,
			clearExisting?: boolean,
			unfold?: boolean,
		): void;
		/**
		 * Removes the highlight set registered under `className`.
		 */
		removeHighlights?(className: string): void;
	}
}

export interface PositionMapper {
	offsetToPos(offset: number): EditorPosition;
}

/**
 * Drop empty ranges and convert document offsets into editor positions.
 * Live Preview highlights need at least one character to reveal.
 */
export function toEditorRanges(
	mapper: PositionMapper,
	ranges: readonly HighlightRange[],
): EditorRange[] {
	const result: EditorRange[] = [];
	for (const range of ranges) {
		if (range.to <= range.from) {
			continue;
		}
		result.push({
			from: mapper.offsetToPos(range.from),
			to: mapper.offsetToPos(range.to),
		});
	}
	return result;
}

export function clearLivePreviewHighlights(editor: Editor | null): void {
	if (editor === null || typeof editor.removeHighlights !== "function") {
		return;
	}
	editor.removeHighlights(LIVE_PREVIEW_HIGHLIGHT_CLASS);
}

/**
 * Mirror the visible match ranges into Obsidian's search-highlight layer when
 * Live Preview is active, so rendered Markdown around a match is shown as raw
 * source and the match highlight is visible. Source mode needs no help: the
 * raw text is already on screen.
 */
export function syncLivePreviewHighlights(
	editor: Editor | null,
	ranges: readonly HighlightRange[],
	livePreview: boolean,
): void {
	if (
		editor === null ||
		typeof editor.addHighlights !== "function" ||
		typeof editor.removeHighlights !== "function"
	) {
		return;
	}

	editor.removeHighlights(LIVE_PREVIEW_HIGHLIGHT_CLASS);
	if (!livePreview) {
		return;
	}

	const editorRanges = toEditorRanges(editor, ranges);
	if (editorRanges.length === 0) {
		return;
	}
	editor.addHighlights(
		editorRanges,
		LIVE_PREVIEW_HIGHLIGHT_CLASS,
		false,
		true,
	);
}
