/**
 * Guard rails for large result sets.
 *
 * The search engine itself is fast, but the UI, decoration set, and a single
 * replacement transaction must not be allowed to grow without bound.
 */
export const DISPLAY_MATCH_LIMIT = 10_000;
export const ACTION_MATCH_LIMIT = 100_000;
export const MAX_HIGHLIGHT_RANGES = 5_000;
export const MAX_ZERO_WIDTH_MARKERS = 1_000;
export const MAX_LINE_BREAK_MARKERS = 1_000;
export const REPLACE_ALL_CONFIRM_THRESHOLD = 5_000;

export function shouldConfirmReplaceAll(count: number): boolean {
	return count > REPLACE_ALL_CONFIRM_THRESHOLD;
}
