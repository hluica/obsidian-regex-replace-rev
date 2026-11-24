import {
	Prec,
	StateEffect,
	StateField,
	type EditorState,
	type Range,
} from "@codemirror/state";
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
import {
	editorInfoField,
	editorLivePreviewField,
	MarkdownView,
	type Editor,
} from "obsidian";
import { buildHighlightPlan, buildLineBreakPlan } from "./highlights";
import {
	clearLivePreviewHighlights,
	LIVE_PREVIEW_HIGHLIGHT_CLASS,
	syncLivePreviewHighlights,
} from "./live-preview";
import { FindReplacePanel } from "../ui/FindReplacePanel";
import type {
	PanelHighlight,
	PanelHighlightRange,
	PanelPlugin,
} from "../ui/host";

export const setInlinePanelOpen = StateEffect.define<boolean>();
export const setInlineMatchHighlights =
	StateEffect.define<PanelHighlight | null>();

/**
 * Obsidian installs createDiv/createSpan on each Window, but the public
 * typings only declare the global and HTMLElement forms. Use the document's
 * own window so nodes in popout editors are created in the right document.
 */
interface DomHelperWindow extends Window {
	createDiv(): HTMLDivElement;
	createSpan(): HTMLSpanElement;
}

function helperWindow(doc: Document): DomHelperWindow {
	return doc.win as DomHelperWindow;
}

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
		const marker = helperWindow(view.dom.ownerDocument).createSpan();
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
		const marker = helperWindow(view.dom.ownerDocument).createSpan();
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
	// Defensive display-level de-duplication: even if a caller ever emits
	// several zero-width matches at one offset, draw a single dot there and
	// let the active state win.
	const zeroWidthAt = new Map<number, boolean>();
	for (const marker of plan.zeroWidth) {
		zeroWidthAt.set(
			marker.pos,
			(zeroWidthAt.get(marker.pos) ?? false) || marker.active,
		);
	}
	for (const [pos, active] of zeroWidthAt) {
		ranges.push(
			Decoration.widget({
				widget: new ZeroWidthMarker(active),
				side: 1,
			}).range(pos),
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
	const editor = view.state.field(editorInfoField, false)?.editor ?? null;
	clearLivePreviewHighlights(editor);
	view.dispatch({
		effects: [
			setInlineMatchHighlights.of(null),
			setInlinePanelOpen.of(false),
		],
	});
}

function isLivePreview(view: EditorView): boolean {
	return view.state.field(editorLivePreviewField, false) === true;
}

/**
 * Obsidian clears every highlight set when the editor view is clicked. Our
 * panel lives inside that view, so its own buttons would wipe the Live
 * Preview reveal. Detect that from the editor state and add the set back.
 */
function hasLivePreviewHighlight(
	state: EditorState,
	range: PanelHighlightRange,
): boolean {
	for (const set of state.facet(EditorView.decorations)) {
		if (typeof set === "function") {
			continue;
		}
		let found = false;
		set.between(range.from, range.to, (_from, _to, value) => {
			const spec = value.spec as unknown;
			const specClass =
				spec !== null && typeof spec === "object"
					? (Reflect.get(spec, "class") as unknown)
					: undefined;
			if (specClass === LIVE_PREVIEW_HIGHLIGHT_CLASS) {
				found = true;
				return false;
			}
			return undefined;
		});
		if (found) {
			return true;
		}
	}
	return false;
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
	private readonly getEditor: () => Editor | null;
	private readonly closePanel: () => void;
	private highlightTimer: number | null = null;
	private pendingHighlight: PanelHighlight | null = null;
	private hasPendingHighlight = false;
	private appliedHighlight: PanelHighlight | null = null;
	private restoreTimer: number | null = null;
	private restoreAttempts = 0;
	private destroyed = false;

	constructor(view: EditorView, plugin: PanelPlugin) {
		this.view = view;
		this.dom = helperWindow(view.dom.ownerDocument).createDiv();
		this.dom.className = "rr-inline-panel";
		if (plugin.settings.compactPanel) {
			this.dom.addClass("rr-inline-panel--dense");
		}
		const frame = this.dom.createDiv({ cls: "rr-inline-frame" });
		const container = frame.createDiv({ cls: "rr-inline-container" });

		this.getEditor = () => {
			const info = view.state.field(editorInfoField, false);
			return info?.editor ?? null;
		};

		this.closePanel = () => {
			this.cancelPendingHighlight();
			closeInlinePanel(view);
			this.getEditor()?.focus();
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
			getEditor: () => this.getEditor(),
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
		const wasLivePreview = update.startState.field(
			editorLivePreviewField,
			false,
		);
		const isLivePreview = update.state.field(editorLivePreviewField, false);
		if (wasLivePreview !== isLivePreview) {
			this.panel.refreshHighlights();
		}
		if (!update.docChanged) {
			this.ensureLivePreviewHighlights(update);
		}
	}

	destroy(): void {
		this.destroyed = true;
		this.cancelPendingHighlight();
		panelControllers.delete(this.view);
		this.clearLivePreviewHighlightsSoon();
		this.panel.destroy();
		this.dom.remove();
	}

	/**
	 * Obsidian's highlight set lives in the editor state, not in this panel.
	 * Remove it once the panel is gone; dispatching from destroy() itself
	 * would happen during a CodeMirror update.
	 */
	private clearLivePreviewHighlightsSoon(): void {
		const editor = this.getEditor();
		const view = this.view;
		window.setTimeout(() => {
			if (!view.dom.isConnected) {
				return;
			}
			clearLivePreviewHighlights(editor);
		}, 0);
	}

	/**
	 * Highlight effects can be requested while CodeMirror is mounting the
	 * panel or while an editor update is in progress. Dispatching there throws
	 * "Calls to EditorView.update are not allowed while an update is in
	 * progress", so coalesce the latest request into a task after the current
	 * update completes.
	 */
	private queueHighlight(
		value: PanelHighlight | null,
		restoring = false,
	): void {
		if (!restoring) {
			this.restoreAttempts = 0;
		}
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
			this.appliedHighlight = pending;
			// Live Preview replaces rendered Markdown with widgets, hiding the
			// raw source of a match such as a callout marker or an emphasis
			// delimiter. Registering the ranges on Obsidian's search-highlight
			// layer makes the editor reveal the original text, so the match
			// highlight below is drawn on the source instead of being hidden.
			syncLivePreviewHighlights(
				this.getEditor(),
				pending === null ? [] : pending.ranges,
				isLivePreview(this.view),
			);
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
		this.cancelRestore();
		this.hasPendingHighlight = false;
		this.pendingHighlight = null;
	}

	private cancelRestore(): void {
		if (this.restoreTimer !== null) {
			window.clearTimeout(this.restoreTimer);
			this.restoreTimer = null;
		}
	}

	/**
	 * Re-add the Live Preview reveal after Obsidian's editor click handler
	 * clears every highlight set. A small delay lets Obsidian's own
	 * setTimeout(0) clear run first. Only a transaction that removed an
	 * existing set schedules a restore, so stale ranges from before the next
	 * refresh are not re-added.
	 */
	private ensureLivePreviewHighlights(update: ViewUpdate): void {
		const applied = this.appliedHighlight;
		if (this.destroyed || applied === null || !isLivePreview(this.view)) {
			return;
		}
		const range = applied.ranges.find((item) => item.to > item.from);
		if (range === undefined) {
			return;
		}
		// Our own sync removes and then adds the set in two transactions; the
		// add cancels the restore that the remove scheduled.
		if (hasLivePreviewHighlight(update.state, range)) {
			this.restoreAttempts = 0;
			this.cancelRestore();
			return;
		}
		if (this.restoreTimer !== null) {
			return;
		}
		if (!hasLivePreviewHighlight(update.startState, range)) {
			return;
		}
		if (this.restoreAttempts >= 5) {
			return;
		}
		this.restoreTimer = window.setTimeout(() => {
			this.restoreTimer = null;
			if (
				this.destroyed ||
				this.hasPendingHighlight ||
				this.appliedHighlight !== applied
			) {
				return;
			}
			this.restoreAttempts += 1;
			this.queueHighlight(applied, true);
		}, 20);
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
