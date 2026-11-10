export type MatchMode = "exact" | "wildcard" | "regex";
export type SearchScope = "file" | "selection";
export type SearchDirection = "forward" | "backward";

export interface SearchOptions {
	mode: MatchMode;
	caseSensitive: boolean;
	wholeWord: boolean;
	dotAll: boolean;
	multiline: boolean;
}

export interface MatchRange {
	/** Start offset relative to the searched text. */
	start: number;
	/** End offset relative to the searched text. */
	end: number;
	text: string;
	/** Capture groups, starting at group 1. */
	groups: Array<string | undefined>;
	namedGroups?: Record<string, string | undefined>;
}

export interface CompiledPattern {
	regex: RegExp;
	source: string;
	mode: MatchMode;
	replacementIsLiteral: boolean;
}

export type CompileResult =
	| { ok: true; compiled: CompiledPattern }
	| { ok: false; error: string };

export interface ScanResult {
	matches: MatchRange[];
	truncated: boolean;
}

export interface FindMatchResult<T extends MatchRange = MatchRange> {
	match: T;
	index: number;
	wrapped: boolean;
}

export interface ReplacementChange {
	/** Start offset relative to the searched text. */
	start: number;
	/** End offset relative to the searched text. */
	end: number;
	text: string;
}
