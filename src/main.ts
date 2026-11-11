import type { EditorView } from "@codemirror/view";
import { MarkdownView, Platform, Plugin, type Editor } from "obsidian";
import {
	closeInlinePanel,
	createInlinePanelExtension,
	findEditorView,
	focusInlinePanel,
	setInlinePanelOpen,
} from "./editor/inline-panel";
import { currentStrings } from "./i18n";
import {
	DEFAULT_UI_STATE,
	FindReplaceSettingTab,
	createDefaultSettings,
	normalizeSettings,
	normalizeUiState,
	type PluginSettings,
	type SearchUiState,
} from "./settings";
import { FindReplaceModal } from "./ui/FindReplaceModal";
import type { HistoryKind, PanelPlugin } from "./ui/host";

const HISTORY_LIMIT = 20;
const SETTINGS_SAVE_DEBOUNCE_MS = 500;

export default class RegexReplacePlugin
	extends Plugin
	implements PanelPlugin
{
	settings: PluginSettings = createDefaultSettings();
	private activeModal: FindReplaceModal | null = null;
	private saveTimer: number | null = null;
	private unloading = false;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerEditorExtension(createInlinePanelExtension(this));
		this.addSettingTab(new FindReplaceSettingTab(this.app, this));

		this.addCommand({
			id: "open-find-replace",
			name: currentStrings().commandName,
			editorCallback: (editor: Editor) => {
				this.openFindReplace(editor);
			},
		});
	}

	onunload(): void {
		this.unloading = true;
		this.activeModal?.close();
		this.activeModal = null;
		this.flushSettingsSave();
	}

	async onExternalSettingsChange(): Promise<void> {
		await this.loadSettings();
	}

	async loadSettings(): Promise<void> {
		this.cancelScheduledSave();
		const raw: unknown = await this.loadData();
		this.settings = normalizeSettings(raw);
		if (!this.settings.rememberHistory) {
			this.clearHistory();
		}
	}

	async saveSettings(): Promise<void> {
		this.cancelScheduledSave();
		await this.saveData(this.settings);
	}

	scheduleSaveSettings(): void {
		if (this.unloading) {
			void this.saveSettingsNow().catch(() => undefined);
			return;
		}
		if (this.saveTimer !== null) {
			return;
		}
		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			void this.saveSettingsNow().catch(() => undefined);
		}, SETTINGS_SAVE_DEBOUNCE_MS);
	}

	private cancelScheduledSave(): void {
		if (this.saveTimer !== null) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
	}

	private async saveSettingsNow(): Promise<void> {
		await this.saveData(this.settings);
	}

	private flushSettingsSave(): void {
		this.cancelScheduledSave();
		void this.saveSettingsNow().catch(() => undefined);
	}

	getInitialState(): SearchUiState {
		if (this.settings.rememberLastState) {
			return normalizeUiState(this.settings.lastState, DEFAULT_UI_STATE);
		}
		return {
			...DEFAULT_UI_STATE,
			mode: this.settings.defaultMode,
		};
	}

	recordHistory(kind: HistoryKind, value: string): void {
		if (!this.settings.rememberHistory || value.length === 0) {
			return;
		}
		const list =
			kind === "search"
				? this.settings.history.search
				: this.settings.history.replace;
		const existing = list.indexOf(value);
		if (existing !== -1) {
			list.splice(existing, 1);
		}
		list.unshift(value);
		if (list.length > HISTORY_LIMIT) {
			list.length = HISTORY_LIMIT;
		}
	}

	clearHistory(): void {
		this.settings.history = { search: [], replace: [] };
	}

	savePanelSession(
		state: SearchUiState,
		find: string,
		replace: string,
	): void {
		if (!this.settings.rememberLastState) {
			return;
		}
		this.settings.lastState = normalizeUiState(state, DEFAULT_UI_STATE);
		this.settings.lastSearch = find;
		this.settings.lastReplace = replace;
	}

	clearActiveModal(): void {
		this.activeModal = null;
	}

	private openFindReplace(editor: Editor): void {
		this.activeModal?.close();

		if (Platform.isMobile) {
			this.closeAllInlinePanels();
			this.openModal(editor);
			return;
		}

		const markdownView = this.findMarkdownViewForEditor(editor);
		if (markdownView === null) {
			this.openModal(editor);
			return;
		}
		const editorView = findEditorView(markdownView);
		if (editorView === null) {
			this.openModal(editor);
			return;
		}

		// One panel per window/document, but panels in other Obsidian windows
		// are independent and must stay open.
		this.closeOtherInlinePanelsInWindow(editorView);
		editorView.dispatch({ effects: setInlinePanelOpen.of(true) });
		focusInlinePanel(editorView);
	}

	private findMarkdownViewForEditor(editor: Editor): MarkdownView | null {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			if (leaf.view instanceof MarkdownView && leaf.view.editor === editor) {
				return leaf.view;
			}
		}
		return null;
	}

	private closeOtherInlinePanelsInWindow(active: EditorView): void {
		const activeDocument = active.dom.ownerDocument;
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			if (!(leaf.view instanceof MarkdownView)) {
				continue;
			}
			const editorView = findEditorView(leaf.view);
			if (
				editorView !== null &&
				editorView !== active &&
				editorView.dom.ownerDocument === activeDocument
			) {
				closeInlinePanel(editorView);
			}
		}
	}

	private closeAllInlinePanels(): void {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			if (!(leaf.view instanceof MarkdownView)) {
				continue;
			}
			const editorView = findEditorView(leaf.view);
			if (editorView !== null) {
				closeInlinePanel(editorView);
			}
		}
	}

	private openModal(editor: Editor): void {
		this.activeModal?.close();
		const modal = new FindReplaceModal(this.app, this, editor);
		this.activeModal = modal;
		modal.open();
	}
}
