import type {
	CompiledPattern,
	MatchRange,
	ReplacementChange,
} from "./types";

/**
 * Convert the optional escape sequences in a replacement string.
 * Supported: \\ \n \r \t; unknown escapes are preserved.
 */
export function processEscapes(text: string): string {
	let result = "";
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (char === undefined) {
			continue;
		}
		if (char !== "\\") {
			result += char;
			continue;
		}
		const next = text[index + 1];
		if (next === undefined) {
			result += "\\";
			continue;
		}
		index += 1;
		switch (next) {
			case "\\":
				result += "\\";
				break;
			case "n":
				result += "\n";
				break;
			case "r":
				result += "\r";
				break;
			case "t":
				result += "\t";
				break;
			default:
				result += `\\${next}`;
				break;
		}
	}
	return result;
}

function isDigit(char: string | undefined): boolean {
	return char !== undefined && char >= "0" && char <= "9";
}

/**
 * Expand a JavaScript-style replacement string for one match.
 * When `literal` is true (exact mode), the replacement is returned unchanged.
 */
export function expandReplacement(
	replacement: string,
	match: MatchRange,
	text: string,
	literal: boolean,
): string {
	if (literal) {
		return replacement;
	}

	const groupCount = match.groups.length;
	let result = "";

	for (let index = 0; index < replacement.length; index += 1) {
		const char = replacement[index];
		if (char === undefined) {
			continue;
		}
		if (char !== "$") {
			result += char;
			continue;
		}

		const next = replacement[index + 1];
		if (next === undefined) {
			result += "$";
			continue;
		}

		switch (next) {
			case "$":
				result += "$";
				index += 1;
				continue;
			case "&":
				result += match.text;
				index += 1;
				continue;
			case "`":
				result += text.slice(0, match.start);
				index += 1;
				continue;
			case "'":
				result += text.slice(match.end);
				index += 1;
				continue;
			case "<": {
				const end = replacement.indexOf(">", index + 2);
				if (end === -1) {
					result += "$";
					continue;
				}
				const name = replacement.slice(index + 2, end);
				const named = match.namedGroups;
				if (
					named !== undefined &&
					Object.prototype.hasOwnProperty.call(named, name)
				) {
					result += named[name] ?? "";
					index = end;
					continue;
				}
				result += "$";
				continue;
			}
			default:
				break;
		}

		if (!isDigit(next)) {
			result += "$";
			continue;
		}

		const secondDigit = replacement[index + 2];
		const hasTwoDigits = isDigit(secondDigit);
		const twoDigit = hasTwoDigits
			? Number(`${next}${secondDigit}`)
			: Number.NaN;
		const oneDigit = Number(next);

		if (twoDigit >= 1 && twoDigit <= groupCount) {
			result += match.groups[twoDigit - 1] ?? "";
			index += 2;
			continue;
		}
		if (oneDigit >= 1 && oneDigit <= groupCount) {
			result += match.groups[oneDigit - 1] ?? "";
			index += 1;
			continue;
		}

		result += "$";
	}

	return result;
}

export function buildReplacementChanges(
	text: string,
	matches: MatchRange[],
	replacement: string,
	compiled: CompiledPattern,
	interpretEscapes: boolean,
): ReplacementChange[] {
	const prepared = interpretEscapes ? processEscapes(replacement) : replacement;
	return matches.map((match) => ({
		start: match.start,
		end: match.end,
		text: expandReplacement(prepared, match, text, compiled.replacementIsLiteral),
	}));
}

export function applyChanges(
	text: string,
	changes: ReplacementChange[],
): string {
	if (changes.length === 0) {
		return text;
	}
	const sorted = [...changes].sort((a, b) => a.start - b.start || a.end - b.end);
	let result = "";
	let cursor = 0;
	for (const change of sorted) {
		result += text.slice(cursor, change.start);
		result += change.text;
		cursor = change.end;
	}
	result += text.slice(cursor);
	return result;
}

export interface ReplaceAllResult {
	text: string;
	count: number;
}

export function replaceAllText(
	text: string,
	matches: MatchRange[],
	replacement: string,
	compiled: CompiledPattern,
	interpretEscapes: boolean,
): ReplaceAllResult {
	const changes = buildReplacementChanges(
		text,
		matches,
		replacement,
		compiled,
		interpretEscapes,
	);
	return { text: applyChanges(text, changes), count: changes.length };
}
