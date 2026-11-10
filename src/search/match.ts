import type {
	CompiledPattern,
	FindMatchResult,
	MatchRange,
	ScanResult,
	SearchOptions,
} from "./types";

const WORD_CHARACTER = /[\p{L}\p{N}\p{M}_]/u;

export function isWordCharacter(char: string | undefined): boolean {
	return char !== undefined && WORD_CHARACTER.test(char);
}

export function isWholeWord(
	text: string,
	start: number,
	end: number,
): boolean {
	return !isWordCharacter(text[start - 1]) && !isWordCharacter(text[end]);
}

function advanceStringIndex(text: string, index: number): number {
	if (index >= text.length) {
		return text.length + 1;
	}
	const code = text.codePointAt(index);
	if (code !== undefined && code > 0xffff) {
		return index + 2;
	}
	return index + 1;
}

function toMatch(exec: RegExpExecArray): MatchRange {
	const text = exec[0] ?? "";
	const named = exec.groups;
	return {
		start: exec.index,
		end: exec.index + text.length,
		text,
		groups: exec.slice(1),
		...(named === undefined
			? {}
			: { namedGroups: { ...named } }),
	};
}

/**
 * Scan all matches. `limit` is a safety valve for the UI count; use
 * Number.POSITIVE_INFINITY for replacements.
 */
export function scanMatches(
	text: string,
	compiled: CompiledPattern,
	options: SearchOptions,
	limit = Number.POSITIVE_INFINITY,
): ScanResult {
	const regex = compiled.regex;
	regex.lastIndex = 0;
	const matches: MatchRange[] = [];
	let truncated = false;

	while (true) {
		const exec = regex.exec(text);
		if (exec === null) {
			break;
		}

		const start = exec.index;
		const end = start + (exec[0] ?? "").length;
		if (!options.wholeWord || isWholeWord(text, start, end)) {
			matches.push(toMatch(exec));
			if (matches.length >= limit) {
				truncated = true;
				break;
			}
		}

		if (exec[0]?.length === 0) {
			const nextIndex = advanceStringIndex(text, regex.lastIndex);
			regex.lastIndex = nextIndex;
			if (nextIndex > text.length) {
				break;
			}
		}
	}

	return { matches, truncated };
}

export function findMatchFrom<T extends MatchRange>(
	matches: T[],
	fromOffset: number,
	direction: "forward" | "backward",
	wrap: boolean,
): FindMatchResult<T> | null {
	if (matches.length === 0) {
		return null;
	}

	if (direction === "forward") {
		for (let index = 0; index < matches.length; index += 1) {
			const match = matches[index];
			if (match !== undefined && match.start >= fromOffset) {
				return { match, index, wrapped: false };
			}
		}
		if (!wrap) {
			return null;
		}
		const first = matches[0];
		return first === undefined ? null : { match: first, index: 0, wrapped: true };
	}

	for (let index = matches.length - 1; index >= 0; index -= 1) {
		const match = matches[index];
		if (match !== undefined && match.end <= fromOffset) {
			return { match, index, wrapped: false };
		}
	}
	if (!wrap) {
		return null;
	}
	const lastIndex = matches.length - 1;
	const last = matches[lastIndex];
	return last === undefined
		? null
		: { match: last, index: lastIndex, wrapped: true };
}

export function findMatchAtSelection<T extends MatchRange>(
	matches: T[],
	start: number,
	end: number,
): T | null {
	for (const match of matches) {
		if (match.start === start && match.end === end) {
			return match;
		}
	}
	return null;
}
