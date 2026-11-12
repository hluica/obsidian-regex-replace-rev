import type { SearchDirection } from "./types";

/** A slice of the document plus the absolute offset of its first character. */
export interface TextRegion {
	text: string;
	offsetBase: number;
}

/** A region plus the absolute scan bounds used to collect its matches. */
export interface DirectionalRegion extends TextRegion {
	/** Inclusive absolute offset where the engine starts scanning. */
	scanFrom: number;
	/** Exclusive absolute offset where the engine stops scanning. */
	scanTo: number;
}

export function fullRegion(region: TextRegion): DirectionalRegion {
	return {
		...region,
		scanFrom: region.offsetBase,
		scanTo: region.offsetBase + region.text.length + 1,
	};
}

/**
 * Restrict a scoped text region to the one-way span from `anchor` to the
 * edge in the current direction. Forward keeps `[anchor, end)`; backward
 * keeps `[start, anchor)`. An anchor outside the region is clamped so a
 * stale cursor cannot produce an out-of-bounds slice.
 *
 * The scan bounds keep the full source text available to the regex engine,
 * so `^`, `\b`, and lookarounds keep their document semantics. `scanTo` is
 * one past the end for a forward scan so an end-of-input zero-width match is
 * still found; backward uses the anchor as an exclusive stop.
 */
export function limitToDirection(
	region: TextRegion,
	anchor: number,
	direction: SearchDirection,
): DirectionalRegion {
	const start = region.offsetBase;
	const end = start + region.text.length;
	const clamped = Math.min(Math.max(anchor, start), end);

	if (direction === "forward") {
		return {
			text: region.text.slice(clamped - start),
			offsetBase: clamped,
			scanFrom: clamped,
			scanTo: end + 1,
		};
	}

	return {
		text: region.text.slice(0, clamped - start),
		offsetBase: start,
		scanFrom: start,
		scanTo: clamped,
	};
}
