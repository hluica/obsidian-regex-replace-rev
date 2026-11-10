import { describe, expect, it } from "vitest";
import { compilePattern } from "../src/search/pattern";
import { findMatchFrom, scanMatches } from "../src/search/match";
import type { SearchOptions } from "../src/search/types";

function matchesOf(text: string) {
	const options: SearchOptions = {
		mode: "exact",
		caseSensitive: true,
		wholeWord: false,
		dotAll: false,
		multiline: false,
	};
	const result = compilePattern("a", options);
	if (!result.ok) {
		throw new Error(result.error);
	}
	return scanMatches(text, result.compiled, options).matches;
}

describe("findMatchFrom", () => {
	it("finds forward matches without wrapping", () => {
		const matches = matchesOf("a a a");
		expect(findMatchFrom(matches, 0, "forward", false)?.index).toBe(0);
		expect(findMatchFrom(matches, 1, "forward", false)?.index).toBe(1);
		expect(findMatchFrom(matches, 2, "forward", false)?.index).toBe(1);
		expect(findMatchFrom(matches, 5, "forward", false)).toBeNull();
	});

	it("wraps forward", () => {
		const matches = matchesOf("a a a");
		const result = findMatchFrom(matches, 5, "forward", true);
		expect(result?.index).toBe(0);
		expect(result?.wrapped).toBe(true);
	});

	it("finds backward matches without wrapping", () => {
		const matches = matchesOf("a a a");
		expect(findMatchFrom(matches, 5, "backward", false)?.index).toBe(2);
		expect(findMatchFrom(matches, 3, "backward", false)?.index).toBe(1);
		expect(findMatchFrom(matches, 0, "backward", false)).toBeNull();
	});

	it("wraps backward", () => {
		const matches = matchesOf("a a a");
		const result = findMatchFrom(matches, 0, "backward", true);
		expect(result?.index).toBe(2);
		expect(result?.wrapped).toBe(true);
	});

	it("handles zero-width matches", () => {
		const options: SearchOptions = {
			mode: "regex",
			caseSensitive: true,
			wholeWord: false,
			dotAll: false,
			multiline: true,
		};
		const result = compilePattern("^", options);
		if (!result.ok) {
			throw new Error(result.error);
		}
		const matches = scanMatches("a\nb\nc", result.compiled, options).matches;
		expect(matches).toHaveLength(3);
		expect(findMatchFrom(matches, 0, "forward", false)?.index).toBe(0);
		expect(findMatchFrom(matches, 1, "forward", false)?.index).toBe(1);
		expect(findMatchFrom(matches, 1, "backward", false)?.index).toBe(0);
	});

	it("returns null for no matches", () => {
		expect(findMatchFrom([], 0, "forward", true)).toBeNull();
	});
});
