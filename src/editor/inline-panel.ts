import { StateEffect, StateField } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	showPanel,
	type DecorationSet,
	type Panel,
	type ViewUpdate,
} from "@codemirror/view";
import { editorInfoField, MarkdownView } from "obsidian";
import { FindReplacePanel } from "../ui/FindReplacePanel";
import type { PanelPlugin } from "../ui/host";

export const setInlinePanelOpen = StateEffect.define<boolean>();
export const setInlineMatchHighlight = StateEffect.define<{
	from: number;
	to: number;
} | null>();

const matchHighlightMark = Decoration.mark({ class: "rr-match-highlight" });

const matchHighlightField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(value, tr) {
		let next = value.map(tr.changes);
		for (const effect of tr.effects) {
			if (effect.is(setInlineMatchHighlight)) {
				if (effect.value === null) {
					return Decoration.none;
				}
				const docLength = tr.state.doc.length;
				const from = Math.max(
					0,
					Math.min(effect.value.from, docLength),
				);
				const to = Math.max(
					0,
					Math.min(effect.value.to, docLength),
				);
				if (from >= to) {
					return Decoration.none;
				}
				next = Decoration.set([
					matchHighlightMark.range(from, to),
				]);
			}
		}
		return next;
	},
	provide: (field) => EditorView.decorations.from(field),
});

export function closeInlinePanel(view: EditorView): void {
	view.dispatch({
		effects: [
			setInlineMatchHighlight.of(null),
			setInlinePanelOpen.of(false),
		],
	});
}

const panelControllers = new WeakMap<EditorView, { focus: () => void }>();

export function focusInlinePanel(view: EditorView): boolean {
	const controller = panelControllers.get(view);
	if (controller === undefined) {
		return false;
	}
	controller.focus();
	return true;
}

export function findEditorView(view: MarkdownView): EditorView | null {
	const dom = view.containerEl.querySelector<HTMLElement>(".cm-editor");
	if (dom === null) {
		return null;
	}
	return EditorView.findFromDOM(dom);
}

class InlineFindReplacePanel implements Panel {
	readonly dom: HTMLElement;
	readonly top = false;
	private readonly view: EditorView;
	private readonly panel: FindReplacePanel;
	private readonly closePanel: () => void;
	private highlightTimer: number | null = null;
	private pendingHighlight: { from: number; to: number } | null = null;
	private hasPendingHighlight = false;
	private destroyed = false;

	constructor(view: EditorView, plugin: PanelPlugin) {
		this.view = view;
		const doc = view.dom.ownerDocument;
		this.dom = doc.createElement("div");
		this.dom.className = "rr-inline-panel";
		const frame = this.dom.createDiv({ cls: "rr-inline-frame" });
		const container = frame.createDiv({ cls: "rr-inline-container" });

		const getEditor = () => {
			const info = view.state.field(editorInfoField, false);
			return info?.editor ?? null;
		};

		this.closePanel = () => {
			this.cancelPendingHighlight();
			closeInlinePanel(view);
			getEditor()?.focus();
		};

		const getDocumentKey = () => {
			const info = view.state.field(editorInfoField, false);
			return info?.file?.path ?? "";
		};

		this.panel = new FindReplacePanel({
			plugin,
			containerEl: container,
			variant: "inline",
			getEditor,
			getDocumentKey,
			requestClose: this.closePanel,
			highlightMatch: (from, to) => {
				this.queueHighlight({ from, to });
			},
			clearHighlight: () => {
				this.queueHighlight(null);
			},
		});
	}

	mount(): void {
		this.panel.mount();
		this.panel.focusFind();
		panelControllers.set(this.view, {
			focus: () => this.panel.focusFind(),
		});
		this.dom.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && !event.defaultPrevented) {
				event.preventDefault();
				this.closePanel();
			}
		});
	}

	update(update: ViewUpdate): void {
		if (update.docChanged) {
			this.panel.handleEditorChange();
		}
	}

	destroy(): void {
		this.destroyed = true;
		this.cancelPendingHighlight();
		panelControllers.delete(this.view);
		this.panel.destroy();
		this.dom.remove();
	}

	/**
	 * Highlight effects can be requested while CodeMirror is mounting the
	 * panel, which is itself inside an EditorView update. Dispatching there
	 * throws "Calls to EditorView.update are not allowed while an update is
	 * in progress", so coalesce the latest request into a task after the
	 * current update completes.
	 */
	private queueHighlight(value: { from: number; to: number } | null): void {
		this.pendingHighlight = value;
		this.hasPendingHighlight = true;
		if (this.highlightTimer !== null) {
			return;
		}
		this.highlightTimer = window.setTimeout(() => {
			this.highlightTimer = null;
			if (this.destroyed || !this.hasPendingHighlight) {
				return;
			}
			const pending = this.pendingHighlight;
			this.hasPendingHighlight = false;
			this.pendingHighlight = null;
			if (!this.view.dom.isConnected) {
				return;
			}
			this.view.dispatch({
				effects: setInlineMatchHighlight.of(pending),
			});
		}, 0);
	}

	private cancelPendingHighlight(): void {
		if (this.highlightTimer !== null) {
			window.clearTimeout(this.highlightTimer);
			this.highlightTimer = null;
		}
		this.hasPendingHighlight = false;
		this.pendingHighlight = null;
	}
}

export function createInlinePanelExtension(plugin: PanelPlugin) {
	const inlineState = StateField.define<boolean>({
		create: () => false,
		update(value, tr) {
			for (const effect of tr.effects) {
				if (effect.is(setInlinePanelOpen)) {
					return effect.value;
				}
			}
			return value;
		},
	});

	const constructor = (view: EditorView): Panel =>
		new InlineFindReplacePanel(view, plugin);

	return [
		inlineState,
		matchHighlightField,
		showPanel.from(inlineState, (open) => (open ? constructor : null)),
	];
}
