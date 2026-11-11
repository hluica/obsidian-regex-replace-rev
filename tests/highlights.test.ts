import { describe, expect, it } from "vitest";
import { buildHighlightPlan } from "../src/editor/highlights";

describe("buildHighlightPlan", () => {
	it("sorts ranges and marks the active range", () => {
		const plan = buildHighlightPlan(
			[
				{ from: 10, to: 12 },
				{ from: 1, to: 3 },
				{ from: 20, to: 21 },
			],
			{ from: 10, to: 12 },
			100,
		);

		expect(plan.marks).toEqual([
			{ from: 1, to: 3, active: false },
			{ from: 10, to: 12, active: true },
			{ from: 20, to: 21, active: false },
		]);
		expect(plan.zeroWidth).toEqual([]);
	});

	it("clamps ranges to the document and drops inverted ranges", () => {
		const plan = buildHighlightPlan(
			[
				{ from: -5, to: 2 },
				{ from: 8, to: 200 },
				{ from: 50, to: 40 },
			],
			null,
			20,
		);

		expect(plan.marks).toEqual([
			{ from: 0, to: 2, active: false },
			{ from: 8, to: 20, active: false },
		]);
	});

	it("de-duplicates zero-width positions and keeps the active flag", () => {
		const plan = buildHighlightPlan(
			[
				{ from: 3, to: 3 },
				{ from: 3, to: 3 },
				{ from: 7, to: 7 },
				{ from: 1, to: 4 },
			],
			{ from: 3, to: 3 },
			20,
		);

		expect(plan.zeroWidth).toEqual([
			{ pos: 3, active: true },
			{ pos: 7, active: false },
		]);
		expect(plan.marks).toEqual([{ from: 1, to: 4, active: false }]);
	});

	it("caps marks but always keeps the active mark", () => {
		const ranges = Array.from({ length: 10 }, (_, index) => ({
			from: index * 2,
			to: index * 2 + 1,
		}));
		const plan = buildHighlightPlan(ranges, { from: 18, to: 19 }, 100, 3);

		expect(plan.marks).toHaveLength(3);
		expect(plan.marks.some((mark) => mark.active)).toBe(true);
		expect(plan.marks.find((mark) => mark.active)?.from).toBe(18);
		expect(plan.omittedMarks).toBeGreaterThan(0);
	});

	it("caps zero-width markers but always keeps the active one", () => {
		const ranges = Array.from({ length: 10 }, (_, index) => ({
			from: index,
			to: index,
		}));
		const plan = buildHighlightPlan(ranges, { from: 9, to: 9 }, 100, 10, 3);

		expect(plan.zeroWidth).toHaveLength(3);
		expect(plan.zeroWidth.some((marker) => marker.active)).toBe(true);
		expect(plan.zeroWidth.find((marker) => marker.active)?.pos).toBe(9);
		expect(plan.omittedZeroWidth).toBeGreaterThan(0);
	});

	it("returns an empty plan for no ranges", () => {
		const plan = buildHighlightPlan([], null, 10);
		expect(plan.marks).toEqual([]);
		expect(plan.zeroWidth).toEqual([]);
		expect(plan.omittedMarks).toBe(0);
		expect(plan.omittedZeroWidth).toBe(0);
	});
});
