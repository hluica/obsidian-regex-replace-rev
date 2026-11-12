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
		unicode: false,
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
			unicode: false,
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

describe("scanMatches range", () => {
	it("starts mid-line without turning the scan start into a line anchor", () => {
		const options: SearchOptions = {
			mode: "regex",
			caseSensitive: true,
			wholeWord: false,
			dotAll: false,
			multiline: true,
			unicode: false,
		};
		const result = compilePattern("^", options);
		if (!result.ok) {
			throw new Error(result.error);
		}
		const scan = scanMatches("abc\ndef\nghi", result.compiled, options, 10, {
			from: 5,
			to: 12,
		});
		expect(scan.matches.map((match) => match.start)).toEqual([8]);
	});

	it("keeps an exclusive upper bound", () => {
		const options: SearchOptions = {
			mode: "exact",
			caseSensitive: true,
			wholeWord: false,
			dotAll: false,
			multiline: false,
			unicode: false,
		};
		const result = compilePattern("a", options);
		if (!result.ok) {
			throw new Error(result.error);
		}
		const scan = scanMatches("a a a", result.compiled, options, 10, {
			from: 0,
			to: 3,
		});
		expect(scan.matches.map((match) => match.start)).toEqual([0, 2]);
	});

	it("keeps lookbehind context before the scan start", () => {
		const options: SearchOptions = {
			mode: "regex",
			caseSensitive: true,
			wholeWord: false,
			dotAll: false,
			multiline: false,
			unicode: false,
		};
		const result = compilePattern("(?<=foo)bar", options);
		if (!result.ok) {
			throw new Error(result.error);
		}
		const scan = scanMatches("foobar", result.compiled, options, 10, {
			from: 3,
		});
		expect(scan.matches).toHaveLength(1);
		expect(scan.matches[0]?.start).toBe(3);
	});
});

describe("scanMatches range boundaries", () => {
	function lookaheadOptions(): SearchOptions {
		return {
			mode: "regex",
			caseSensitive: true,
			wholeWord: false,
			dotAll: false,
			multiline: false,
			unicode: false,
		};
	}

	it("includes a zero-width match at the inclusive scan start", () => {
		const options = lookaheadOptions();
		const result = compilePattern("(?=b)", options);
		if (!result.ok) {
			throw new Error(result.error);
		}
		const scan = scanMatches("ab", result.compiled, options, 10, {
			from: 1,
			to: 2,
		});
		expect(scan.matches.map((match) => match.start)).toEqual([1]);
	});

	it("excludes a zero-width match at the exclusive scan end", () => {
		const options = lookaheadOptions();
		const result = compilePattern("(?=b)", options);
		if (!result.ok) {
			throw new Error(result.error);
		}
		const scan = scanMatches("ab", result.compiled, options, 10, {
			from: 0,
			to: 1,
		});
		expect(scan.matches).toHaveLength(0);
	});
});
