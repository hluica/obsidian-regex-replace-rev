import {
	MAX_HIGHLIGHT_RANGES,
	MAX_ZERO_WIDTH_MARKERS,
} from "../search/limits";

export interface HighlightRange {
	from: number;
	to: number;
}

export interface HighlightMark extends HighlightRange {
	active: boolean;
}

export interface HighlightZeroWidth {
	pos: number;
	active: boolean;
}

export interface HighlightPlan {
	marks: HighlightMark[];
	zeroWidth: HighlightZeroWidth[];
	omittedMarks: number;
	omittedZeroWidth: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max));
}

/**
 * Turn absolute match ranges into the sorted, de-duplicated set of marks and
 * zero-width widgets the editor should draw.
 *
 * The active range is always kept, even when it falls outside the highlight
 * cap, so Find never loses its current marker.
 */
export function buildHighlightPlan(
	ranges: readonly HighlightRange[],
	active: HighlightRange | null,
	docLength: number,
	markLimit = MAX_HIGHLIGHT_RANGES,
	zeroWidthLimit = MAX_ZERO_WIDTH_MARKERS,
): HighlightPlan {
	const deduped = new Map<string, HighlightMark>();

	const add = (range: HighlightRange, isActive: boolean): void => {
		const from = clamp(range.from, 0, docLength);
		const to = clamp(range.to, 0, docLength);
		if (from > to) {
			return;
		}
		const key = `${from}:${to}`;
		const existing = deduped.get(key);
		if (existing !== undefined) {
			existing.active = existing.active || isActive;
			return;
		}
		deduped.set(key, { from, to, active: isActive });
	};

	for (const range of ranges) {
		add(range, false);
	}
	if (active !== null) {
		add(active, true);
	}

	const sorted = [...deduped.values()].sort(
		(a, b) =>
			a.from - b.from ||
			a.to - b.to ||
			Number(b.active) - Number(a.active),
	);

	const marks: HighlightMark[] = [];
	const zeroWidth = new Map<number, boolean>();
	let omittedMarks = 0;
	let omittedZeroWidth = 0;

	for (const item of sorted) {
		if (item.from === item.to) {
			const existing = zeroWidth.get(item.from);
			if (existing !== undefined) {
				zeroWidth.set(item.from, existing || item.active);
				continue;
			}
			if (zeroWidth.size < zeroWidthLimit) {
				zeroWidth.set(item.from, item.active);
				continue;
			}
			if (!item.active) {
				omittedZeroWidth += 1;
				continue;
			}
			const replaceable = [...zeroWidth.keys()].find(
				(pos) => zeroWidth.get(pos) === false,
			);
			if (replaceable === undefined) {
				omittedZeroWidth += 1;
				continue;
			}
			zeroWidth.delete(replaceable);
			zeroWidth.set(item.from, true);
			continue;
		}

		if (marks.length < markLimit) {
			marks.push(item);
			continue;
		}
		if (!item.active) {
			omittedMarks += 1;
			continue;
		}
		const replaceable = marks.findIndex((mark) => !mark.active);
		if (replaceable === -1) {
			omittedMarks += 1;
			continue;
		}
		marks.splice(replaceable, 1);
		omittedMarks += 1;
		marks.push(item);
	}

	marks.sort((a, b) => a.from - b.from || a.to - b.to);
	const zeroWidthList = [...zeroWidth.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([pos, isActive]) => ({ pos, active: isActive }));

	return {
		marks,
		zeroWidth: zeroWidthList,
		omittedMarks,
		omittedZeroWidth,
	};
}
