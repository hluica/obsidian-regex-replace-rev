import { Modal, type App, type Editor } from "obsidian";
import { currentStrings } from "../i18n";
import { FindReplacePanel } from "./FindReplacePanel";
import type { PanelPlugin } from "./host";

export class FindReplaceModal extends Modal {
	private readonly plugin: PanelPlugin;
	private readonly editor: Editor;
	private panel: FindReplacePanel | null = null;

	constructor(app: App, plugin: PanelPlugin, editor: Editor) {
		super(app);
		this.plugin = plugin;
		this.editor = editor;
	}

	onOpen(): void {
		const strings = currentStrings();
		this.shouldRestoreSelection = false;
		this.modalEl.addClass("rr-modal");
		this.titleEl.setText(strings.title);
		this.titleEl.id = "rr-modal-title";
		this.contentEl.addClass("rr-content");
		this.contentEl.empty();

		this.panel = new FindReplacePanel({
			app: this.app,
			plugin: this.plugin,
			containerEl: this.contentEl,
			labelledBy: "rr-modal-title",
			variant: "modal",
			getEditor: () => this.editor,
			getDocumentKey: () => "modal",
			requestClose: () => {
				this.close();
			},
		});
		this.panel.mount();
		this.panel.focusFind();
	}

	onClose(): void {
		this.panel?.destroy();
		this.panel = null;
		this.contentEl.empty();
		this.plugin.clearActiveModal();
	}
}
