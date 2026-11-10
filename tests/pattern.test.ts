import { describe, expect, it } from "vitest";
import { compilePattern, escapeRegExp, wildcardToRegExpSource } from "../src/search/pattern";
import { scanMatches } from "../src/search/match";
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

function compiled(pattern: string, overrides: Partial<SearchOptions> = {}) {
	const opts = options(overrides);
	const result = compilePattern(pattern, opts);
	if (!result.ok) {
		throw new Error(result.error);
	}
	return { compiled: result.compiled, options: opts };
}

function matchedTexts(
	pattern: string,
	text: string,
	overrides: Partial<SearchOptions> = {},
): string[] {
	const setup = compiled(pattern, overrides);
	return scanMatches(text, setup.compiled, setup.options).matches.map(
		(match) => match.text,
	);
}

describe("escapeRegExp", () => {
	it("escapes regex metacharacters", () => {
		expect(escapeRegExp("a.b*c?")).toBe("a\\.b\\*c\\?");
	});
});

describe("wildcardToRegExpSource", () => {
	it("translates stars and question marks into groups", () => {
		expect(wildcardToRegExpSource("第*章?")).toBe("第(.*?)章(.)");
		expect(wildcardToRegExpSource("第*")).toBe("第(.*)");
	});

	it("supports escaped wildcards and control characters", () => {
		expect(wildcardToRegExpSource("\\*\\?\\\\")).toBe("\\*\\?\\\\");
		expect(wildcardToRegExpSource("a\\nb")).toBe("a\\nb");
	});
});

describe("compilePattern", () => {
	it("rejects an empty pattern", () => {
		expect(compilePattern("", options())).toEqual({
			ok: false,
			error: "Pattern is empty",
		});
	});

	it("reports invalid regex", () => {
		const result = compilePattern("[", options());
		expect(result.ok).toBe(false);
	});

	it("matches exact text literally", () => {
		expect(matchedTexts("a.b", "a.b axb", { mode: "exact" })).toEqual([
			"a.b",
		]);
	});

	it("is case-insensitive by default", () => {
		expect(
			matchedTexts("alpha", "Alpha alpha", {
				mode: "exact",
				caseSensitive: false,
			}),
		).toEqual(["Alpha", "alpha"]);
	});

	it("honours case sensitivity", () => {
		expect(
			matchedTexts("alpha", "Alpha alpha", {
				mode: "exact",
				caseSensitive: true,
			}),
		).toEqual(["alpha"]);
	});

	it("supports wildcard groups", () => {
		const setup = compiled("第*章", { mode: "wildcard" });
		const result = scanMatches(
			"第1章 第22章 第章",
			setup.compiled,
			setup.options,
		);
		expect(result.matches.map((match) => match.text)).toEqual([
			"第1章",
			"第22章",
			"第章",
		]);
		expect(result.matches.map((match) => match.groups[0])).toEqual([
			"1",
			"22",
			"",
		]);
	});

	it("supports dotAll for regex and wildcard", () => {
		expect(matchedTexts("a.b", "a\nb", { dotAll: false })).toEqual([]);
		expect(matchedTexts("a.b", "a\nb", { dotAll: true })).toEqual([
			"a\nb",
		]);
		expect(
			matchedTexts("a*b", "a\nxb", { mode: "wildcard", dotAll: true }),
		).toEqual(["a\nxb"]);
	});

	it("supports multiline anchors", () => {
		expect(matchedTexts("^b", "a\nb", { multiline: false })).toEqual([]);
		expect(matchedTexts("^b", "a\nb", { multiline: true })).toEqual(["b"]);
	});

	it("finds zero-width matches", () => {
		expect(matchedTexts("^", "a\nb\nc", { multiline: true })).toEqual([
			"",
			"",
			"",
		]);
	});

	it("filters whole words for Latin text", () => {
		expect(
			matchedTexts("cat", "cat cats scatter cat.", {
				mode: "exact",
				wholeWord: true,
			}),
		).toEqual(["cat", "cat"]);
	});

	it("filters whole words for CJK text", () => {
		expect(
			matchedTexts("项目", "本项目 项目 项目：", {
				mode: "exact",
				wholeWord: true,
			}),
		).toEqual(["项目", "项目"]);
	});

	it("limits match count and reports truncation", () => {
		const setup = compiled("a", { mode: "exact" });
		const result = scanMatches("aaaa", setup.compiled, setup.options, 2);
		expect(result.matches).toHaveLength(2);
		expect(result.truncated).toBe(true);
	});
});
