import type { Editor } from "obsidian";
import type { PluginSettings, SearchUiState } from "../settings";

export type HistoryKind = "search" | "replace";

export interface PanelPlugin {
	settings: PluginSettings;
	saveSettings(): Promise<void>;
	getInitialState(): SearchUiState;
	recordHistory(kind: HistoryKind, value: string): void;
	clearHistory(): void;
	savePanelSession(state: SearchUiState, find: string, replace: string): void;
	clearActiveModal(): void;
}

export interface PanelHost {
	plugin: PanelPlugin;
	containerEl: HTMLElement;
	variant: "modal" | "inline";
	getEditor: () => Editor | null;
	getDocumentKey: () => string;
	requestClose: () => void;
	highlightMatch?: (from: number, to: number) => void;
	clearHighlight?: () => void;
}
