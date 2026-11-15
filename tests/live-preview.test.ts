import { describe, expect, it } from "vitest";
import { toEditorRanges } from "../src/editor/live-preview";

const mapper = {
	offsetToPos(offset: number) {
		return { line: Math.floor(offset / 10), ch: offset % 10 };
	},
};

describe("toEditorRanges", () => {
	it("maps document offsets to editor positions", () => {
		expect(
			toEditorRanges(mapper, [
				{ from: 3, to: 7 },
				{ from: 12, to: 24 },
			]),
		).toEqual([
			{ from: { line: 0, ch: 3 }, to: { line: 0, ch: 7 } },
			{ from: { line: 1, ch: 2 }, to: { line: 2, ch: 4 } },
		]);
	});

	it("drops zero-width and inverted ranges", () => {
		expect(
			toEditorRanges(mapper, [
				{ from: 4, to: 4 },
				{ from: 9, to: 2 },
				{ from: 0, to: 1 },
			]),
		).toEqual([{ from: { line: 0, ch: 0 }, to: { line: 0, ch: 1 } }]);
	});

	it("returns an empty list for no ranges", () => {
		expect(toEditorRanges(mapper, [])).toEqual([]);
	});
});
