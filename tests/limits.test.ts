import { describe, expect, it } from "vitest";
import {
	ACTION_MATCH_LIMIT,
	DISPLAY_MATCH_LIMIT,
	MAX_HIGHLIGHT_RANGES,
	MAX_ZERO_WIDTH_MARKERS,
	REPLACE_ALL_CONFIRM_THRESHOLD,
	shouldConfirmReplaceAll,
} from "../src/search/limits";

describe("search limits", () => {
	it("uses ordered guard rails", () => {
		expect(MAX_HIGHLIGHT_RANGES).toBeLessThanOrEqual(DISPLAY_MATCH_LIMIT);
		expect(DISPLAY_MATCH_LIMIT).toBeLessThanOrEqual(ACTION_MATCH_LIMIT);
		expect(MAX_ZERO_WIDTH_MARKERS).toBeLessThanOrEqual(MAX_HIGHLIGHT_RANGES);
		expect(REPLACE_ALL_CONFIRM_THRESHOLD).toBeLessThanOrEqual(
			ACTION_MATCH_LIMIT,
		);
	});

	it("confirms only above the replace-all threshold", () => {
		expect(shouldConfirmReplaceAll(0)).toBe(false);
		expect(shouldConfirmReplaceAll(REPLACE_ALL_CONFIRM_THRESHOLD)).toBe(false);
		expect(shouldConfirmReplaceAll(REPLACE_ALL_CONFIRM_THRESHOLD + 1)).toBe(
			true,
		);
	});
});
