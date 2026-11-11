import { Prec, StateEffect, StateField, type Range } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	keymap,
	showPanel,
	WidgetType,
	type DecorationSet,
	type Panel,
	type ViewUpdate,
} from "@codemirror/view";
import { editorInfoField, MarkdownView } from "obsidian";
import { buildHighlightPlan, buildLineBreakPlan } from "./highlights";
import { FindReplacePanel } from "../ui/FindReplacePanel";
import type { PanelHighlight, PanelPlugin } from "../ui/host";

export const setInlinePanelOpen = StateEffect.define<boolean>();
export const setInlineMatchHighlights =
	StateEffect.define<PanelHighlight | null>();

const inactiveMark = Decoration.mark({ class: "rr-match-highlight" });
const activeMark = Decoration.mark({
	class: "rr-match-highlight rr-match-highlight-active",
});

class ZeroWidthMarker extends WidgetType {
	readonly active: boolean;

	constructor(active: boolean) {
		super();
		this.active = active;
	}

	eq(other: WidgetType): boolean {
		return other instanceof ZeroWidthMarker && other.active === this.active;
	}

	toDOM(view: EditorView): HTMLElement {
		const marker = view.dom.ownerDocument.createElement("span");
		marker.className = this.active
			? "rr-zero-width rr-zero-width-active"
			: "rr-zero-width";
		marker.setAttribute("aria-hidden", "true");
		return marker;
	}
}

class LineBreakMarker extends WidgetType {
	readonly active: boolean;

	constructor(active: boolean) {
		super();
		this.active = active;
	}

	eq(other: WidgetType): boolean {
		return other instanceof LineBreakMarker && other.active === this.active;
	}

	toDOM(view: EditorView): HTMLElement {
		const marker = view.dom.ownerDocument.createElement("span");
		marker.className = this.active
			? "rr-line-break rr-line-break-active"
			: "rr-line-break";
		marker.setAttribute("aria-hidden", "true");
		return marker;
	}
}

function buildDecorationSet(
	request: PanelHighlight,
	docLength: number,
): DecorationSet {
	const plan = buildHighlightPlan(
		request.ranges,
		request.active,
		docLength,
	);
	const lineBreaks = buildLineBreakPlan(
		request.lineBreaks ?? [],
		request.active,
		docLength,
	);
	const ranges: Array<Range<Decoration>> = [];

	for (const mark of plan.marks) {
		ranges.push(
			mark.active
				? activeMark.range(mark.from, mark.to)
				: inactiveMark.range(mark.from, mark.to),
		);
	}
	for (const marker of plan.zeroWidth) {
		ranges.push(
			Decoration.widget({
				widget: new ZeroWidthMarker(marker.active),
				side: 1,
			}).range(marker.pos),
		);
	}
	for (const marker of lineBreaks) {
		ranges.push(
			Decoration.widget({
				widget: new LineBreakMarker(marker.active),
				side: 1,
			}).range(marker.pos),
		);
	}

	return ranges.length === 0 ? Decoration.none : Decoration.set(ranges, true);
}

const matchHighlightField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(value, tr) {
		let next = value.map(tr.changes);
		for (const effect of tr.effects) {
			if (effect.is(setInlineMatchHighlights)) {
				if (effect.value === null) {
					return Decoration.none;
				}
				next = buildDecorationSet(effect.value, tr.state.doc.length);
			}
		}
		return next;
	},
	provide: (field) => EditorView.decorations.from(field),
});

export function closeInlinePanel(view: EditorView): void {
	view.dispatch({
		effects: [
			setInlineMatchHighlights.of(null),
			setInlinePanelOpen.of(false),
		],
	});
}

interface PanelController {
	focus: () => void;
	findNext: () => void;
	findPrevious: () => void;
	close: () => void;
}

const panelControllers = new WeakMap<EditorView, PanelController>();

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

function runPanelCommand(
	view: EditorView,
	action: "next" | "previous" | "close",
): boolean {
	const controller = panelControllers.get(view);
	if (controller === undefined) {
		return false;
	}
	if (action === "next") {
		controller.findNext();
	} else if (action === "previous") {
		controller.findPrevious();
	} else {
		controller.close();
	}
	return true;
}

class InlineFindReplacePanel implements Panel {
	readonly dom: HTMLElement;
	readonly top = false;
	private readonly view: EditorView;
	private readonly panel: FindReplacePanel;
	private readonly closePanel: () => void;
	private highlightTimer: number | null = null;
	private pendingHighlight: PanelHighlight | null = null;
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
			app: plugin.app,
			plugin,
			containerEl: container,
			variant: "inline",
			getEditor,
			getDocumentKey,
			requestClose: this.closePanel,
			highlightMatches: (request) => {
				this.queueHighlight(request);
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
			findNext: () => this.panel.findNext(),
			findPrevious: () => this.panel.findPrevious(),
			close: () => this.closePanel(),
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
		} else if (update.selectionSet) {
			this.panel.handleSelectionChange();
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
	 * panel or while an editor update is in progress. Dispatching there throws
	 * "Calls to EditorView.update are not allowed while an update is in
	 * progress", so coalesce the latest request into a task after the current
	 * update completes.
	 */
	private queueHighlight(value: PanelHighlight | null): void {
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
				effects: setInlineMatchHighlights.of(pending),
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

	const panelKeymap = Prec.high(
		keymap.of([
			{
				key: "F3",
				run: (view) => runPanelCommand(view, "next"),
			},
			{
				key: "Shift-F3",
				run: (view) => runPanelCommand(view, "previous"),
			},
			{
				key: "Escape",
				run: (view) => runPanelCommand(view, "close"),
			},
		]),
	);

	return [
		inlineState,
		matchHighlightField,
		showPanel.from(inlineState, (open) => (open ? constructor : null)),
		panelKeymap,
	];
}
