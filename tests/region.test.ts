import { describe, expect, it } from "vitest";
import { compilePattern } from "../src/search/pattern";
import { scanMatches } from "../src/search/match";
import { replaceAllText } from "../src/search/replace";
import {
	fullRegion,
	limitToDirection,
	type TextRegion,
} from "../src/search/region";
import type { SearchOptions } from "../src/search/types";

const options: SearchOptions = {
	mode: "exact",
	caseSensitive: true,
	wholeWord: false,
	dotAll: false,
	multiline: false,
	unicode: false,
};

const scope: TextRegion = {
	text: "alpha beta gamma",
	offsetBase: 100,
};

function region(
	text: string,
	offsetBase: number,
	scanFrom: number,
	scanTo: number,
) {
	return { text, offsetBase, scanFrom, scanTo };
}

describe("limitToDirection", () => {
	it("keeps the suffix from the anchor when searching forward", () => {
		expect(limitToDirection(scope, 106, "forward")).toEqual(
			region("beta gamma", 106, 106, 117),
		);
	});

	it("keeps the prefix before the anchor when searching backward", () => {
		expect(limitToDirection(scope, 106, "backward")).toEqual(
			region("alpha ", 100, 100, 106),
		);
	});

	it("keeps the whole region when the anchor is at its start forward", () => {
		expect(limitToDirection(scope, 100, "forward")).toEqual(
			region(scope.text, 100, 100, 117),
		);
	});

	it("keeps the whole region when the anchor is at its end backward", () => {
		expect(limitToDirection(scope, 116, "backward")).toEqual(
			region(scope.text, 100, 100, 116),
		);
	});

	it("produces an empty forward region at the end", () => {
		expect(limitToDirection(scope, 116, "forward")).toEqual(
			region("", 116, 116, 117),
		);
	});

	it("produces an empty backward region at the start", () => {
		expect(limitToDirection(scope, 100, "backward")).toEqual(
			region("", 100, 100, 100),
		);
	});

	it("clamps an anchor outside the region", () => {
		expect(limitToDirection(scope, 0, "forward")).toEqual(
			region(scope.text, 100, 100, 117),
		);
		expect(limitToDirection(scope, 500, "backward")).toEqual(
			region(scope.text, 100, 100, 116),
		);
	});

	it("handles an empty source region", () => {
		const empty: TextRegion = { text: "", offsetBase: 42 };
		expect(limitToDirection(empty, 42, "forward")).toEqual(
			region("", 42, 42, 43),
		);
		expect(limitToDirection(empty, 42, "backward")).toEqual(
			region("", 42, 42, 42),
		);
	});
});

describe("fullRegion", () => {
	it("scans the whole scoped text including an end zero-width match", () => {
		expect(fullRegion(scope)).toEqual(
			region(scope.text, 100, 100, 117),
		);
	});
});

describe("directional region with the search engine", () => {
	it("finds and replaces only matches after the anchor", () => {
		const text = "target\nmiddle\ntarget\nend target";
		const forward = limitToDirection({ text, offsetBase: 0 }, 14, "forward");
		const compiled = compilePattern("target", options);
		if (!compiled.ok) {
			throw new Error(compiled.error);
		}

		const found = scanMatches(
			text,
			compiled.compiled,
			options,
			Number.POSITIVE_INFINITY,
			{ from: forward.scanFrom, to: forward.scanTo },
		).matches;
		expect(found.map((match) => match.start)).toEqual([14, 25]);

		const regionMatches = found.map((match) => ({
			...match,
			start: match.start - forward.offsetBase,
			end: match.end - forward.offsetBase,
		}));
		const result = replaceAllText(
			forward.text,
			regionMatches,
			"done",
			compiled.compiled,
			false,
		);
		expect(text.slice(0, forward.offsetBase) + result.text).toBe(
			"target\nmiddle\ndone\nend done",
		);
	});

	it("finds and replaces only matches before the anchor", () => {
		const text = "target\nmiddle\ntarget\nend target";
		const backward = limitToDirection({ text, offsetBase: 0 }, 21, "backward");
		const compiled = compilePattern("target", options);
		if (!compiled.ok) {
			throw new Error(compiled.error);
		}

		const found = scanMatches(
			text,
			compiled.compiled,
			options,
			Number.POSITIVE_INFINITY,
			{ from: backward.scanFrom, to: backward.scanTo },
		).matches;
		expect(found.map((match) => match.start)).toEqual([0, 14]);

		const regionMatches = found.map((match) => ({
			...match,
			start: match.start - backward.offsetBase,
			end: match.end - backward.offsetBase,
		}));
		const result = replaceAllText(
			backward.text,
			regionMatches,
			"done",
			compiled.compiled,
			false,
		);
		expect(result.text + text.slice(21)).toBe(
			"done\nmiddle\ndone\nend target",
		);
	});
});
