import type {
	CompileResult,
	MatchMode,
	SearchOptions,
} from "./types";

const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\]/g;

export function escapeRegExp(text: string): string {
	return text.replace(REGEXP_SPECIAL, "\\$&");
}

/**
 * Convert a wildcard pattern to a regular expression source.
 * `*` -> any sequence, `?` -> one character; each becomes a capture group.
 * Supported escapes: \* \? \\ \n \r \t.
 */
export function wildcardToRegExpSource(pattern: string): string {
	let source = "";

	for (let index = 0; index < pattern.length; index += 1) {
		const char = pattern[index];
		if (char === undefined) {
			continue;
		}

		if (char === "\\") {
			const next = pattern[index + 1];
			if (next === undefined) {
				source += "\\\\";
				continue;
			}
			index += 1;
			switch (next) {
				case "*":
					source += "\\*";
					break;
				case "?":
					source += "\\?";
					break;
				case "\\":
					source += "\\\\";
					break;
				case "n":
					source += "\\n";
					break;
				case "r":
					source += "\\r";
					break;
				case "t":
					source += "\\t";
					break;
				default:
					source += escapeRegExp(`\\${next}`);
					break;
			}
			continue;
		}

		if (char === "*") {
			// A trailing wildcard should consume the rest of the line; a middle
			// wildcard should stop at the next literal so repeated matches do
			// not swallow the whole document.
			source += index + 1 < pattern.length ? "(.*?)" : "(.*)";
			continue;
		}
		if (char === "?") {
			source += "(.)";
			continue;
		}
		source += escapeRegExp(char);
	}

	return source;
}

function flagsFor(options: SearchOptions): string {
	let flags = "g";
	if (!options.caseSensitive) {
		flags += "i";
	}
	if (options.multiline) {
		flags += "m";
	}
	if (options.dotAll) {
		flags += "s";
	}
	if (options.unicode) {
		flags += "u";
	}
	return flags;
}

export function modeSource(mode: MatchMode, pattern: string): string {
	switch (mode) {
		case "exact":
			return escapeRegExp(pattern);
		case "wildcard":
			return wildcardToRegExpSource(pattern);
		case "regex":
			return pattern;
	}
}

export function compilePattern(
	pattern: string,
	options: SearchOptions,
): CompileResult {
	if (pattern.length === 0) {
		return { ok: false, error: "Pattern is empty" };
	}

	const source = modeSource(options.mode, pattern);
	try {
		return {
			ok: true,
			compiled: {
				regex: new RegExp(source, flagsFor(options)),
				source,
				mode: options.mode,
				replacementIsLiteral: options.mode === "exact",
			},
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: message };
	}
}
