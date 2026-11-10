import { en } from "./en";
import { zh } from "./zh";
import type { Strings } from "./types";

export function stringsFor(language: string): Strings {
	return language.toLowerCase().startsWith("zh") ? zh : en;
}
