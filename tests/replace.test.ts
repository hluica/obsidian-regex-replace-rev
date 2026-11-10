import { describe, expect, it } from "vitest";
import { compilePattern } from "../src/search/pattern";
import { scanMatches } from "../src/search/match";
import {
	applyChanges,
	expandReplacement,
	processEscapes,
	replaceAllText,
} from "../src/search/replace";
import type { SearchOptions } from "../src/search/types";

function options(overrides: Partial<SearchOptions> = {}): SearchOptions {
	return {
		mode: "regex",
		caseSensitive: true,
		wholeWord: false,
		dotAll: false,
		multiline: false,
		...overrides,
	};
}

function compile(pattern: string, overrides: Partial<SearchOptions> = {}) {
	const opts = options(overrides);
	const result = compilePattern(pattern, opts);
	if (!result.ok) {
		throw new Error(result.error);
	}
	return { compiled: result.compiled, options: opts };
}

function nativeReplace(
	text: string,
	pattern: string,
	overrides: Partial<SearchOptions>,
	replacement: string,
): string {
	const opts = options(overrides);
	let flags = "g";
	if (!opts.caseSensitive) {
		flags += "i";
	}
	if (opts.multiline) {
		flags += "m";
	}
	if (opts.dotAll) {
		flags += "s";
	}
	return text.replace(new RegExp(pattern, flags), replacement);
}

function replaceWithEngine(
	text: string,
	pattern: string,
	overrides: Partial<SearchOptions>,
	replacement: string,
	interpretEscapes = false,
) {
	const setup = compile(pattern, overrides);
	const matches = scanMatches(
		text,
		setup.compiled,
		setup.options,
		Number.POSITIVE_INFINITY,
	).matches;
	return replaceAllText(
		text,
		matches,
		replacement,
		setup.compiled,
		interpretEscapes,
	);
}

describe("expandReplacement", () => {
	it("expands numbered groups like String.replace", () => {
		const text = "John Smith";
		const setup = compile("(\\w+)\\s+(\\w+)");
		const match = scanMatches(text, setup.compiled, setup.options).matches[0];
		if (match === undefined) {
			throw new Error("missing match");
		}
		expect(expandReplacement("$2 $1", match, text, false)).toBe(
			nativeReplace(text, "(\\w+)\\s+(\\w+)", {}, "$2 $1"),
		);
	});

	it("expands named groups", () => {
		const text = "hello";
		const setup = compile("(?<word>\\w+)");
		const match = scanMatches(text, setup.compiled, setup.options).matches[0];
		if (match === undefined) {
			throw new Error("missing match");
		}
		expect(expandReplacement("$<word>!", match, text, false)).toBe(
			nativeReplace(text, "(?<word>\\w+)", {}, "$<word>!"),
		);
	});

	it("supports $& and $$", () => {
		expect(replaceWithEngine("abc", "b", {}, "[$&$$]").text).toBe(
			nativeReplace("abc", "b", {}, "[$&$$]"),
		);
	});

	it("matches String.replace for $` and $'", () => {
		expect(
			replaceWithEngine("abcabc", "b", {}, "<$`|$'>").text,
		).toBe(nativeReplace("abcabc", "b", {}, "<$`|$'>"));
	});

	it("matches String.replace for two-digit fallback", () => {
		expect(replaceWithEngine("abc", "(a)", {}, "$12").text).toBe(
			nativeReplace("abc", "(a)", {}, "$12"),
		);
	});

	it("leaves $0 literal", () => {
		expect(replaceWithEngine("a", "(a)", {}, "$0").text).toBe(
			nativeReplace("a", "(a)", {}, "$0"),
		);
	});

	it("handles unmatched optional groups", () => {
		expect(replaceWithEngine("b ab", "(a)?b", {}, "[$1]").text).toBe(
			nativeReplace("b ab", "(a)?b", {}, "[$1]"),
		);
	});
});

describe("processEscapes", () => {
	it("converts supported escape sequences", () => {
		expect(processEscapes("a\\nb\\tc\\\\d")).toBe("a\nb\tc\\d");
	});

	it("preserves unknown escapes", () => {
		expect(processEscapes("\\d\\w")).toBe("\\d\\w");
	});
});

describe("replaceAllText", () => {
	it("works in exact mode with a literal replacement", () => {
		const result = replaceWithEngine(
			"a.b a.b",
			"a.b",
			{ mode: "exact" },
			"$1",
		);
		expect(result).toEqual({ text: "$1 $1", count: 2 });
	});

	it("works in wildcard mode with groups", () => {
		const result = replaceWithEngine(
			"第1章 第22章",
			"第*章",
			{ mode: "wildcard" },
			"第$1节",
		);
		expect(result).toEqual({ text: "第1节 第22节", count: 2 });
	});

	it("handles zero-width matches", () => {
		const text = "a\nb\nc";
		const result = replaceWithEngine(text, "^", { multiline: true }, "- ");
		expect(result.text).toBe("- a\n- b\n- c");
		expect(result.count).toBe(3);
	});

	it("compares with native replace for flags", () => {
		const text = "Alpha\nalpha";
		const result = replaceWithEngine(
			text,
			"^alpha",
			{ multiline: true, caseSensitive: false },
			"X",
		);
		expect(result.text).toBe(
			nativeReplace(
				text,
				"^alpha",
				{ multiline: true, caseSensitive: false },
				"X",
			),
		);
	});

	it("applies escape processing before token expansion", () => {
		const result = replaceWithEngine(
			"a",
			"(a)",
			{},
			"$1\\nline",
			true,
		);
		expect(result.text).toBe("a\nline");
	});
});

describe("applyChanges", () => {
	it("applies sorted and unsorted changes", () => {
		expect(
			applyChanges("abcdef", [
				{ start: 4, end: 5, text: "E" },
				{ start: 1, end: 2, text: "B" },
			]),
		).toBe("aBcdEf");
	});

	it("supports insertions", () => {
		expect(
			applyChanges("ab", [
				{ start: 0, end: 0, text: ">" },
				{ start: 2, end: 2, text: "<" },
			]),
		).toBe(">ab<");
	});
});
