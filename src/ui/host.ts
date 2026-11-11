import type { App, Editor } from "obsidian";
import type { PluginSettings, SearchUiState } from "../settings";

export type HistoryKind = "search" | "replace";

export interface PanelHighlightRange {
	from: number;
	to: number;
}

export interface PanelHighlight {
	ranges: PanelHighlightRange[];
	active: PanelHighlightRange | null;
	lineBreaks?: number[];
}

export interface PanelPlugin {
	app: App;
	settings: PluginSettings;
	saveSettings(): Promise<void>;
	scheduleSaveSettings(): void;
	getInitialState(): SearchUiState;
	recordHistory(kind: HistoryKind, value: string): void;
	clearHistory(): void;
	savePanelSession(state: SearchUiState, find: string, replace: string): void;
	clearActiveModal(): void;
}

export interface PanelHost {
	app: App;
	plugin: PanelPlugin;
	containerEl: HTMLElement;
	variant: "modal" | "inline";
	getEditor: () => Editor | null;
	getDocumentKey: () => string;
	requestClose: () => void;
	highlightMatches?: (highlight: PanelHighlight | null) => void;
	clearHighlight?: () => void;
}
