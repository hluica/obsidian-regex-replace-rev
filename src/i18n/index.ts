import { getLanguage } from "obsidian";
import { stringsFor } from "./strings";
import type { Strings } from "./types";

export type { Strings } from "./types";
export { stringsFor };

export function currentStrings(): Strings {
	return stringsFor(getLanguage());
}
