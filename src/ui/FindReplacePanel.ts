import {
	ButtonComponent,
	ConfirmationModal,
	DropdownComponent,
	Menu,
	TextComponent,
	ToggleComponent,
	setIcon,
	setTooltip,
	type Editor,
	type EditorChange,
} from "obsidian";
import { currentStrings, type Strings } from "../i18n";
import { collectLineBreakPositions } from "../editor/highlights";
import type { SearchUiState } from "../settings";
import {
	findMatchFrom,
	scanMatches,
} from "../search/match";
import { compilePattern } from "../search/pattern";
import {
	fullRegion,
	limitToDirection,
	type DirectionalRegion,
	type TextRegion,
} from "../search/region";
import { expandReplacement, processEscapes } from "../search/replace";
import type {
	CompiledPattern,
	MatchMode,
	MatchRange,
	SearchDirection,
	SearchOptions,
	SearchScope,
} from "../search/types";
import {
	ACTION_MATCH_LIMIT,
	DISPLAY_MATCH_LIMIT,
	MAX_HIGHLIGHT_RANGES,
	shouldConfirmReplaceAll,
} from "../search/limits";
import type { PanelHost } from "./host";

type OptionKey =
	| "caseSensitive"
	| "wholeWord"
	| "dotAll"
	| "multiline"
	| "unicode"
	| "wrap"
	| "processEscapes";

interface PanelMatch extends MatchRange {
	absoluteStart: number;
	absoluteEnd: number;
}

interface SearchContext {
	editor: Editor;
	compiled: CompiledPattern;
	searchText: string;
	offsetBase: number;
	matches: PanelMatch[];
	truncated: boolean;
}

interface ScopeRange {
	start: number;
	end: number;
}

interface SelectionInfo {
	from: number;
	to: number;
	current: PanelMatch | null;
}

let panelSequence = 0;

function truncate(text: string, length: number): string {
	return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

export class FindReplacePanel {
	private readonly host: PanelHost;
	private readonly strings: Strings;
	private readonly rootEl: HTMLElement;
	private readonly panelId: number;
	private state: SearchUiState;
	private findText: string;
	private replaceText: string;
	private documentKey: string;
	private scopeRange: ScopeRange | null = null;
	private regionAnchor: number | null = null;
	private suppressRegionUpdate = false;
	private matches: PanelMatch[] = [];
	private lineBreaks: number[] = [];
	private timer: number | null = null;
	private historyMenu: Menu | null = null;
	private historyButton: HTMLButtonElement | null = null;
	private suppressEditorChangeUntil = 0;
	private resizeObserver: ResizeObserver | null = null;
	private compactFrame: number | null = null;
	private compactWidth = -1;
	private activeIndex: number | null = null;
	private matchCount = 0;
	private truncated = false;
	private lastReplacementStart: number | null = null;
	private lastReplacementEnd: number | null = null;

	private findInput!: TextComponent;
	private replaceInput!: TextComponent;
	private modeSelect!: DropdownComponent;
	private scopeSelect!: DropdownComponent;
	private directionSelect!: DropdownComponent;
	private findButton!: ButtonComponent;
	private replaceButton!: ButtonComponent;
	private replaceFindButton!: ButtonComponent;
	private replaceAllButton!: ButtonComponent;
	private countEl!: HTMLElement;
	private positionEl!: HTMLElement;
	private messageEl!: HTMLElement;
	private readonly optionToggles: Partial<Record<OptionKey, ToggleComponent>> =
		{};
	private readonly optionEls: Partial<Record<OptionKey, HTMLElement>> = {};

	constructor(host: PanelHost) {
		this.host = host;
		this.strings = currentStrings();
		this.panelId = (panelSequence += 1);
		this.state = host.plugin.getInitialState();
		this.findText = this.initialFindText();
		this.replaceText = host.plugin.settings.rememberLastState
			? host.plugin.settings.lastReplace
			: "";
		this.documentKey = host.getDocumentKey();
		this.rootEl = host.containerEl.createDiv({
			cls: `rr-panel rr-panel--${host.variant}`,
		});
		this.rootEl.setAttr("role", "region");
		if (this.host.labelledBy !== undefined) {
			this.rootEl.setAttr("aria-labelledby", this.host.labelledBy);
		}
	}

	mount(): void {
		this.build();
		this.syncControls();
		if (this.state.scope === "selection") {
			if (!this.captureScope()) {
				this.resetScopeToFile();
				this.setMessage(this.strings.selectionEmpty, true);
			}
		}
		this.captureRegionAnchor();
		this.refresh();
		if (this.host.variant === "inline") {
			this.updateCompact();
			this.resizeObserver = new ResizeObserver(() => {
				this.scheduleCompactUpdate();
			});
			this.resizeObserver.observe(this.rootEl);
		}
	}

	focusFind(): void {
		this.findInput.inputEl.focus();
		this.findInput.inputEl.select();
	}

	handleEditorChange(): void {
		if (Date.now() >= this.suppressEditorChangeUntil) {
			this.clearMessage();
		}
		this.activeIndex = null;
		this.scheduleRefresh();
	}

	destroy(): void {
		this.clearTimer();
		this.hideHistoryMenu();
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		if (this.compactFrame !== null) {
			this.rootEl.ownerDocument.defaultView?.cancelAnimationFrame(
				this.compactFrame,
			);
			this.compactFrame = null;
		}
		this.persist();
		this.rootEl.remove();
	}

	private initialFindText(): string {
		const settings = this.host.plugin.settings;
		const editor = this.host.getEditor();
		const selection = editor?.getSelection() ?? "";
		if (
			settings.prefillFromSelection &&
			selection.length > 0 &&
			selection.length <= 200 &&
			!selection.includes("\n")
		) {
			return selection;
		}
		return settings.rememberLastState ? settings.lastSearch : "";
	}

	private build(): void {
		if (this.host.variant === "inline") {
			const header = this.rootEl.createDiv({ cls: "rr-panel-header" });
			const title = header.createSpan({
				cls: "rr-panel-title",
				text: this.strings.title,
			});
			title.setAttr("role", "heading");
			title.setAttr("aria-level", "2");
			const titleId = `rr-panel-title-${this.panelId}`;
			title.id = titleId;
			this.rootEl.setAttr("aria-labelledby", titleId);
			const close = header.createEl("button", {
				cls: "rr-panel-close",
				attr: {
					type: "button",
					"aria-label": this.strings.close,
					"data-tooltip-position": "left",
				},
			});
			setIcon(close, "x");
			setTooltip(close, this.strings.close);
			close.addEventListener("click", () => {
				this.host.requestClose();
			});
		}

		const grid = this.rootEl.createDiv({ cls: "rr-grid" });
		const findId = `rr-find-${this.panelId}`;
		const replaceId = `rr-replace-${this.panelId}`;

		grid.createEl("label", {
			cls: "rr-label",
			text: this.strings.findLabel,
			attr: { for: findId },
		});

		const findField = grid.createDiv({ cls: "rr-field" });
		this.findInput = new TextComponent(findField);
		this.findInput.inputEl.id = findId;
		this.findInput.inputEl.addClass("rr-input");
		this.findInput.inputEl.spellcheck = false;
		this.findInput.inputEl.autocomplete = "off";
		this.findInput.setValue(this.findText);
		this.findInput.onChange((value) => {
			this.findText = value;
			this.activeIndex = null;
			this.clearHighlight();
			this.clearMessage();
			this.scheduleRefresh();
		});
		this.attachKeydown(this.findInput.inputEl, "find");

		const findHistory = findField.createEl("button", {
			cls: "rr-history",
			attr: {
				type: "button",
				"aria-label": this.strings.historySearch,
				"aria-haspopup": "menu",
				"aria-expanded": "false",
				"data-tooltip-position": "bottom",
			},
		});
		setIcon(findHistory, "history");
		setTooltip(findHistory, this.strings.tooltipHistorySearch);
		findHistory.addEventListener("click", (event) => {
			event.preventDefault();
			this.openHistoryMenu("search", findHistory);
		});

		const findActions = grid.createDiv({ cls: "rr-actions" });
		this.findButton = this.createButton(
			findActions,
			this.strings.actionFind,
			this.strings.tooltipFind,
			() => {
				this.runFind(false);
			},
		);
		this.replaceFindButton = this.createButton(
			findActions,
			this.strings.actionReplaceFind,
			this.strings.tooltipReplaceFind,
			() => {
				this.runReplaceAndFind();
			},
		);

		grid.createEl("label", {
			cls: "rr-label",
			text: this.strings.replaceLabel,
			attr: { for: replaceId },
		});

		const replaceField = grid.createDiv({ cls: "rr-field" });
		this.replaceInput = new TextComponent(replaceField);
		this.replaceInput.inputEl.id = replaceId;
		this.replaceInput.inputEl.addClass("rr-input");
		this.replaceInput.inputEl.spellcheck = false;
		this.replaceInput.inputEl.autocomplete = "off";
		this.replaceInput.setValue(this.replaceText);
		this.replaceInput.setPlaceholder(this.strings.placeholderReplace);
		this.replaceInput.onChange((value) => {
			this.replaceText = value;
		});
		this.attachKeydown(this.replaceInput.inputEl, "replace");

		const replaceHistory = replaceField.createEl("button", {
			cls: "rr-history",
			attr: {
				type: "button",
				"aria-label": this.strings.historyReplace,
				"aria-haspopup": "menu",
				"aria-expanded": "false",
				"data-tooltip-position": "bottom",
			},
		});
		setIcon(replaceHistory, "history");
		setTooltip(replaceHistory, this.strings.tooltipHistoryReplace);
		replaceHistory.addEventListener("click", (event) => {
			event.preventDefault();
			this.openHistoryMenu("replace", replaceHistory);
		});

		const replaceActions = grid.createDiv({ cls: "rr-actions" });
		this.replaceButton = this.createButton(
			replaceActions,
			this.strings.actionReplace,
			this.strings.tooltipReplace,
			() => {
				this.runReplaceOnce();
			},
		);
		this.replaceAllButton = this.createButton(
			replaceActions,
			this.strings.actionReplaceAll,
			this.strings.tooltipReplaceAll,
			() => {
				this.runReplaceAll();
			},
		);

		grid.createSpan({ cls: "rr-label", text: this.strings.modeLabel });
		const modeRow = grid.createDiv({ cls: "rr-mode-row" });
		this.modeSelect = this.createSelect(
			modeRow,
			"rr-select-mode",
			this.strings.tooltipMode,
			{
				exact: this.strings.modeExact,
				wildcard: this.strings.modeWildcard,
				regex: this.strings.modeRegex,
			},
			(value) => {
				this.state = { ...this.state, mode: value as MatchMode };
				this.activeIndex = null;
				this.syncPlaceholder();
				this.syncOptionVisibility();
				this.clearHighlight();
				this.clearMessage();
				this.refresh();
			},
		);
		const scopeControl = modeRow.createSpan({ cls: "rr-scope-control" });
		this.scopeSelect = this.createSelect(
			scopeControl,
			"rr-select-scope",
			this.strings.tooltipScope,
			{
				file: this.strings.scopeFile,
				selection: this.strings.scopeSelection,
			},
			(value) => {
				this.onScopeChange(value as SearchScope);
			},
		);
		const useSelection = scopeControl.createEl("button", {
			cls: "rr-scope-refresh",
			attr: {
				type: "button",
				"aria-label": this.strings.useSelection,
				"data-tooltip-position": "bottom",
			},
		});
		setIcon(useSelection, "scan");
		setTooltip(useSelection, this.strings.tooltipUseSelection);
		useSelection.addEventListener("click", (event) => {
			event.preventDefault();
			this.useCurrentSelection();
		});
		this.directionSelect = this.createSelect(
			modeRow,
			"rr-select-dir",
			this.strings.tooltipDirection,
			{
				forward: this.strings.directionDown,
				backward: this.strings.directionUp,
			},
			(value) => {
				this.state = {
					...this.state,
					direction: value as SearchDirection,
				};
				this.captureRegionAnchor();
				this.clearMessage();
				this.refresh();
			},
		);
		grid.createSpan({ cls: "rr-spacer" });

		grid.createSpan({ cls: "rr-spacer" });
		const optionsEl = grid.createDiv({ cls: "rr-options" });
		const optionsLabel = optionsEl.createSpan({
			cls: "rr-visually-hidden",
			text: this.strings.optionsGroup,
		});
		optionsLabel.id = `rr-options-label-${this.panelId}`;
		optionsLabel.setAttr("aria-hidden", "true");
		optionsEl.setAttr("role", "group");
		optionsEl.setAttr("aria-labelledby", optionsLabel.id);
		this.createOptionToggle(
			optionsEl,
			"caseSensitive",
			this.strings.optionCaseSensitive,
			this.strings.tooltipCaseSensitive,
		);
		this.createOptionToggle(
			optionsEl,
			"wholeWord",
			this.strings.optionWholeWord,
			this.strings.tooltipWholeWord,
		);
		this.createOptionToggle(
			optionsEl,
			"dotAll",
			this.strings.optionDotAll,
			this.strings.tooltipDotAll,
		);
		this.createOptionToggle(
			optionsEl,
			"multiline",
			this.strings.optionMultiline,
			this.strings.tooltipMultiline,
		);
		this.createOptionToggle(
			optionsEl,
			"unicode",
			this.strings.optionUnicode,
			this.strings.tooltipUnicode,
		);
		this.createOptionToggle(
			optionsEl,
			"wrap",
			this.strings.optionWrap,
			this.strings.tooltipWrap,
		);
		this.createOptionToggle(
			optionsEl,
			"processEscapes",
			this.strings.optionProcessEscapes,
			this.strings.tooltipProcessEscapes,
		);

		grid.createSpan({ cls: "rr-spacer" });
		const statusEl = grid.createDiv({ cls: "rr-status" });
		const statusLeft = statusEl.createDiv({ cls: "rr-status-left" });
		this.countEl = statusLeft.createSpan({ cls: "rr-count" });
		this.positionEl = statusLeft.createSpan({ cls: "rr-position" });
		this.messageEl = statusEl.createSpan({ cls: "rr-message" });
		this.messageEl.setAttr("role", "status");
		this.messageEl.setAttr("aria-live", "polite");
		this.messageEl.setAttr("aria-atomic", "true");
	}

	private attachKeydown(
		input: HTMLInputElement,
		role: "find" | "replace",
	): void {
		input.addEventListener("keydown", (event) => {
			if (event.isComposing) {
				return;
			}
			if (event.key === "F3") {
				event.preventDefault();
				this.runFind(event.shiftKey);
				return;
			}
			if (event.key !== "Enter") {
				return;
			}
			event.preventDefault();
			if (event.metaKey || event.ctrlKey) {
				this.runReplaceAll();
				return;
			}
			if (role === "find") {
				this.runFind(event.shiftKey);
				return;
			}
			if (event.shiftKey) {
				this.runReplaceOnce();
			} else {
				this.runReplaceAndFind();
			}
		});
	}

	private createButton(
		container: HTMLElement,
		text: string,
		tooltip: string,
		onClick: () => void,
	): ButtonComponent {
		const button = new ButtonComponent(container);
		button.setButtonText(text);
		button.buttonEl.addClass("rr-btn");
		setTooltip(button.buttonEl, tooltip);
		button.onClick(() => {
			onClick();
		});
		return button;
	}

	private createSelect(
		container: HTMLElement,
		className: string,
		tooltip: string,
		options: Record<string, string>,
		onChange: (value: string) => void,
	): DropdownComponent {
		const wrapper = container.createSpan({ cls: "rr-select-wrap" });
		const dropdown = new DropdownComponent(wrapper);
		dropdown.addOptions(options);
		dropdown.setValue(Object.keys(options)[0] ?? "");
		dropdown.selectEl.addClass("rr-select", className);
		dropdown.selectEl.setAttr("aria-label", tooltip);
		setTooltip(dropdown.selectEl, tooltip);
		dropdown.onChange((value) => {
			onChange(value);
		});
		return dropdown;
	}

	private createOptionToggle(
		container: HTMLElement,
		key: OptionKey,
		label: string,
		tooltip: string,
	): void {
		const optionEl = container.createDiv({ cls: "rr-option" });
		optionEl.createSpan({ cls: "rr-option-label", text: label });
		const toggle = new ToggleComponent(optionEl);
		toggle.setValue(this.state[key]);
		toggle.setTooltip(tooltip);
		toggle.toggleEl.setAttr("aria-label", label);
		setTooltip(optionEl, tooltip);
		toggle.onChange((value) => {
			this.state = { ...this.state, [key]: value };
			if (key === "wrap") {
				this.captureRegionAnchor();
			}
			this.activeIndex = null;
			this.clearHighlight();
			this.clearMessage();
			this.refresh();
		});
		optionEl.addEventListener("click", (event) => {
			if (toggle.toggleEl.contains(event.target as Node)) {
				return;
			}
			toggle.onClick();
		});
		this.optionToggles[key] = toggle;
		this.optionEls[key] = optionEl;
	}

	private isOptionAvailable(key: OptionKey): boolean {
		if (key === "dotAll") {
			return this.state.mode !== "exact";
		}
		if (key === "multiline" || key === "unicode") {
			return this.state.mode === "regex";
		}
		return true;
	}

	private syncOptionVisibility(): void {
		for (const key of Object.keys(this.optionEls) as OptionKey[]) {
			const el = this.optionEls[key];
			if (el !== undefined) {
				el.hidden = !this.isOptionAvailable(key);
			}
		}
	}

	private syncControls(): void {
		this.findInput.setValue(this.findText);
		this.replaceInput.setValue(this.replaceText);
		this.modeSelect.setValue(this.state.mode);
		this.scopeSelect.setValue(this.state.scope);
		this.directionSelect.setValue(this.state.direction);
		for (const key of Object.keys(this.optionToggles) as OptionKey[]) {
			const toggle = this.optionToggles[key];
			if (toggle !== undefined) {
				toggle.setValue(this.state[key]);
			}
		}
		this.syncPlaceholder();
		this.syncOptionVisibility();
	}

	private syncPlaceholder(): void {
		this.findInput.setPlaceholder(this.placeholderForMode());
	}

	private placeholderForMode(): string {
		switch (this.state.mode) {
			case "exact":
				return this.strings.placeholderExact;
			case "wildcard":
				return this.strings.placeholderWildcard;
			case "regex":
				return this.strings.placeholderRegex;
		}
	}

	private scheduleRefresh(): void {
		this.clearTimer();
		this.timer = window.setTimeout(() => {
			this.timer = null;
			this.refresh();
		}, 180);
	}

	private clearTimer(): void {
		if (this.timer !== null) {
			window.clearTimeout(this.timer);
			this.timer = null;
		}
	}

	private refresh(): void {
		this.clearStaleStateMessage();
		const context = this.buildContext(DISPLAY_MATCH_LIMIT + 1);
		if (context !== null) {
			this.updateUi(context);
			const info = this.getSelectionInfo(context.editor);
			const selectionIndex =
				info.current === null
					? null
					: context.matches.indexOf(info.current);
			this.activeIndex =
				selectionIndex !== null && selectionIndex >= 0
					? selectionIndex
					: null;
			this.syncHighlights(this.activeIndex);
		}
	}

	private clearStaleStateMessage(): void {
		const text = this.messageEl.textContent ?? "";
		if (this.host.getEditor() !== null && text === this.strings.noEditor) {
			this.clearMessage();
		}
		if (this.findText.length > 0 && text === this.strings.emptyFind) {
			this.clearMessage();
		}
	}

	private buildContext(limit: number): SearchContext | null {
		this.checkDocumentChange();
		const editor = this.host.getEditor();
		if (editor === null) {
			this.setNoEditorUi();
			return null;
		}
		if (this.findText.length === 0) {
			this.setEmptyUi();
			return null;
		}

		const options = this.searchOptions();
		const result = compilePattern(this.findText, options);
		if (!result.ok) {
			this.setErrorUi(result.error);
			return null;
		}

		const scoped = this.getSearchText(editor);
		if (scoped === null) {
			return null;
		}
		const region = this.getSearchRegion(editor, scoped);

		const scan =
			region.text.length === 0
				? { matches: [], truncated: false }
				: scanMatches(scoped.text, result.compiled, options, limit, {
						from: region.scanFrom - scoped.offsetBase,
						to: region.scanTo - scoped.offsetBase,
					});
		const matches: PanelMatch[] = scan.matches.map((match) => {
			const absoluteStart = match.start + scoped.offsetBase;
			const absoluteEnd = match.end + scoped.offsetBase;
			return {
				...match,
				start: absoluteStart - region.offsetBase,
				end: absoluteEnd - region.offsetBase,
				absoluteStart,
				absoluteEnd,
			};
		});

		this.matches = matches;
		this.lineBreaks = collectLineBreakPositions(matches);

		return {
			editor,
			compiled: result.compiled,
			searchText: region.text,
			offsetBase: region.offsetBase,
			matches,
			truncated: scan.truncated,
		};
	}

	private searchOptions(): SearchOptions {
		return {
			mode: this.state.mode,
			caseSensitive: this.state.caseSensitive,
			wholeWord: this.state.wholeWord,
			dotAll: this.state.mode !== "exact" && this.state.dotAll,
			multiline: this.state.mode === "regex" && this.state.multiline,
			unicode: this.state.mode === "regex" && this.state.unicode,
		};
	}

	private checkDocumentChange(): void {
		const key = this.host.getDocumentKey();
		if (key === this.documentKey) {
			return;
		}
		this.documentKey = key;
		this.scopeRange = null;
		this.regionAnchor = null;
		this.activeIndex = null;
		if (this.state.scope === "selection") {
			this.state = { ...this.state, scope: "file" };
			this.scopeSelect.setValue("file");
		}
		this.setMessage(this.strings.targetChanged);
	}

	private getSearchText(
		editor: Editor,
	): { text: string; offsetBase: number } | null {
		if (this.state.scope !== "selection") {
			return { text: editor.getValue(), offsetBase: 0 };
		}

		const scope = this.scopeRange;
		if (scope === null) {
			this.resetScopeToFile();
			this.setMessage(this.strings.selectionEmpty, true);
			this.setUnavailableUi();
			return null;
		}

		try {
			const docLength = editor.getValue().length;
			if (scope.start < 0 || scope.end > docLength || scope.start >= scope.end) {
				this.resetScopeToFile();
				this.setMessage(this.strings.selectionEmpty, true);
				this.setUnavailableUi();
				return null;
			}
			const text = editor.getRange(
				editor.offsetToPos(scope.start),
				editor.offsetToPos(scope.end),
			);
			if (text.length === 0) {
				this.resetScopeToFile();
				this.setMessage(this.strings.selectionEmpty, true);
				this.setUnavailableUi();
				return null;
			}
			return { text, offsetBase: scope.start };
		} catch {
			this.resetScopeToFile();
			this.setMessage(this.strings.selectionEmpty, true);
			this.setUnavailableUi();
			return null;
		}
	}

	/**
	 * With wrap off, a file scope is bounded to the one-way span from the
	 * cursor to the document edge. A selection scope always uses the whole
	 * captured selection, regardless of where the cursor sits inside it.
	 * This keeps the live count, highlights, navigation and Replace all
	 * consistent with the visible scope.
	 */
	private getSearchRegion(
		editor: Editor,
		scoped: TextRegion,
	): DirectionalRegion {
		if (this.state.wrap || this.state.scope === "selection") {
			return fullRegion(scoped);
		}
		if (this.regionAnchor === null) {
			this.captureRegionAnchor(editor);
		}
		return limitToDirection(
			scoped,
			this.regionAnchor ?? scoped.offsetBase,
			this.state.direction,
		);
	}

	private usesSelectionBounds(): boolean {
		return !this.state.wrap && this.state.scope === "selection";
	}

	private captureRegionAnchor(editor = this.host.getEditor()): void {
		if (
			this.state.wrap ||
			this.state.scope === "selection" ||
			editor === null
		) {
			this.regionAnchor = null;
			return;
		}
		const info = this.getSelectionInfo(editor);
		this.regionAnchor =
			this.state.direction === "forward" ? info.from : info.to;
	}

	private useCurrentSelection(): void {
		if (this.host.getEditor() === null) {
			this.setMessage(this.strings.noEditor, true);
			return;
		}
		this.activeIndex = null;
		if (!this.captureScope()) {
			this.resetScopeToFile();
			this.setMessage(this.strings.selectionEmpty, true);
			this.refresh();
			return;
		}
		this.state = { ...this.state, scope: "selection" };
		this.scopeSelect.setValue("selection");
		this.captureRegionAnchor();
		this.clearMessage();
		this.setMessage(this.strings.selectionRefreshed);
		this.refresh();
	}

	private onScopeChange(scope: SearchScope): void {
		this.activeIndex = null;
		if (scope === "selection") {
			this.state = { ...this.state, scope: "selection" };
			if (!this.captureScope()) {
				this.resetScopeToFile();
				this.setMessage(this.strings.selectionEmpty, true);
			} else {
				this.clearMessage();
			}
		} else {
			this.state = { ...this.state, scope: "file" };
			this.scopeRange = null;
			this.clearMessage();
		}
		this.captureRegionAnchor();
		this.refresh();
	}

	private captureScope(): boolean {
		const editor = this.host.getEditor();
		if (editor === null) {
			return false;
		}
		const selection = editor.getSelection();
		if (selection.length === 0) {
			return false;
		}
		try {
			const from = editor.posToOffset(editor.getCursor("from"));
			const to = editor.posToOffset(editor.getCursor("to"));
			if (from === to) {
				return false;
			}
			this.scopeRange = {
				start: from,
				end: to,
			};
			return true;
		} catch {
			return false;
		}
	}

	private resetScopeToFile(): void {
		this.scopeRange = null;
		this.regionAnchor = null;
		this.state = { ...this.state, scope: "file" };
		if (this.scopeSelect !== undefined) {
			this.scopeSelect.setValue("file");
		}
	}

	private updateUi(context: SearchContext): void {
		const count = context.matches.length;
		this.matchCount = count;
		this.truncated = context.truncated || count > DISPLAY_MATCH_LIMIT;
		if (count === 0) {
			this.countEl.setText(this.strings.noMatches);
		} else {
			const display = Math.min(count, DISPLAY_MATCH_LIMIT);
			this.countEl.setText(
				this.strings.count(display, this.truncated),
			);
		}
		this.setButtonsDisabled(count === 0);
		this.updatePosition();
	}

	private updatePosition(): void {
		if (this.matchCount === 0) {
			this.positionEl.setText("");
			return;
		}
		const total = this.truncated
			? `${DISPLAY_MATCH_LIMIT}+`
			: String(this.matchCount);
		this.positionEl.setText(
			this.activeIndex === null
				? this.strings.positionNone(total)
				: this.strings.position(this.activeIndex + 1, total),
		);
	}

	private syncHighlights(activeIndex: number | null = this.activeIndex): void {
		if (this.matches.length === 0) {
			this.activeIndex = null;
			this.clearHighlight();
			this.updatePosition();
			return;
		}
		const index =
			activeIndex !== null &&
			activeIndex >= 0 &&
			activeIndex < this.matches.length
				? activeIndex
				: null;
		this.activeIndex = index;
		const ranges = this.matches
			.slice(0, MAX_HIGHLIGHT_RANGES)
			.map((match) => ({
				from: match.absoluteStart,
				to: match.absoluteEnd,
			}));
		const activeMatch =
			index !== null ? this.matches[index] : undefined;
		if (activeMatch !== undefined) {
			const alreadyIncluded = ranges.some(
				(range) =>
					range.from === activeMatch.absoluteStart &&
					range.to === activeMatch.absoluteEnd,
			);
			if (!alreadyIncluded) {
				ranges.push({
					from: activeMatch.absoluteStart,
					to: activeMatch.absoluteEnd,
				});
			}
		}
		this.host.highlightMatches?.({
			ranges,
			active:
				activeMatch === undefined
					? null
					: {
							from: activeMatch.absoluteStart,
							to: activeMatch.absoluteEnd,
						},
			lineBreaks: this.lineBreaks,
		});
		this.updatePosition();
	}

	handleSelectionChange(): void {
		const editor = this.host.getEditor();
		if (editor === null) {
			return;
		}
		if (
			!this.state.wrap &&
			this.state.scope === "file" &&
			!this.suppressRegionUpdate
		) {
			this.captureRegionAnchor(editor);
			// Refresh even when the previous region had zero matches: moving
			// the cursor back into a match must repopulate the count and
			// highlights. The old `matches.length > 0` guard left an empty
			// region stuck until the query changed.
			if (this.findText.length > 0) {
				this.scheduleRefresh();
			}
			return;
		}
		if (this.matches.length === 0) {
			return;
		}
		const info = this.getSelectionInfo(editor);
		const nextIndex =
			info.current === null ? null : this.matches.indexOf(info.current);
		const normalized = nextIndex !== null && nextIndex >= 0 ? nextIndex : null;
		if (normalized === this.activeIndex) {
			return;
		}
		this.activeIndex = normalized;
		this.syncHighlights();
	}

	private clearHighlight(): void {
		this.host.clearHighlight?.();
	}

	private setNoEditorUi(): void {
		this.clearHighlight();
		this.matches = [];
		this.lineBreaks = [];
		this.activeIndex = null;
		this.matchCount = 0;
		this.truncated = false;
		this.countEl.setText("—");
		this.updatePosition();
		this.setButtonsDisabled(true);
		this.setMessage(this.strings.noEditor);
	}

	private setEmptyUi(): void {
		this.clearHighlight();
		this.matches = [];
		this.lineBreaks = [];
		this.activeIndex = null;
		this.matchCount = 0;
		this.truncated = false;
		this.countEl.setText("—");
		this.updatePosition();
		this.setButtonsDisabled(true);
		this.setMessage(this.strings.emptyFind);
	}

	private setErrorUi(message: string): void {
		this.clearHighlight();
		this.matches = [];
		this.lineBreaks = [];
		this.activeIndex = null;
		this.matchCount = 0;
		this.truncated = false;
		this.countEl.setText("—");
		this.updatePosition();
		this.setButtonsDisabled(true);
		this.setMessage(this.strings.invalidRegex(message), true);
	}

	private setUnavailableUi(): void {
		this.clearHighlight();
		this.matches = [];
		this.lineBreaks = [];
		this.activeIndex = null;
		this.matchCount = 0;
		this.truncated = false;
		this.countEl.setText("—");
		this.updatePosition();
		this.setButtonsDisabled(true);
	}

	private scheduleCompactUpdate(): void {
		if (this.compactFrame !== null) {
			return;
		}
		const win = this.rootEl.ownerDocument.defaultView;
		if (win === null) {
			this.updateCompact();
			return;
		}
		this.compactFrame = win.requestAnimationFrame(() => {
			this.compactFrame = null;
			this.updateCompact();
		});
	}

	private updateCompact(): void {
		const width = this.rootEl.clientWidth;
		if (width === this.compactWidth) {
			return;
		}
		this.compactWidth = width;
		this.rootEl.toggleClass(
			"rr-compact",
			width > 0 && width < 620,
		);
		this.rootEl.toggleClass(
			"rr-narrow",
			width > 0 && width < 260,
		);
	}

	private setButtonsDisabled(disabled: boolean): void {
		this.findButton.setDisabled(disabled);
		this.replaceButton.setDisabled(disabled);
		this.replaceFindButton.setDisabled(disabled);
		this.replaceAllButton.setDisabled(disabled);
	}

	private setMessage(text: string, isError = false): void {
		this.messageEl.setText(text);
		this.messageEl.toggleClass("is-error", isError);
	}

	private clearMessage(): void {
		this.setMessage("");
	}

	private getSelectionInfo(editor: Editor): SelectionInfo {
		const selection = editor.listSelections()[0];
		if (selection === undefined) {
			const cursor = editor.posToOffset(editor.getCursor());
			return { from: cursor, to: cursor, current: null };
		}
		const anchor = editor.posToOffset(selection.anchor);
		const head = editor.posToOffset(selection.head);
		const from = Math.min(anchor, head);
		const to = Math.max(anchor, head);
		return {
			from,
			to,
			current:
				this.matches.find(
					(match) =>
						match.absoluteStart === from &&
						match.absoluteEnd === to,
				) ?? null,
		};
	}

	private selectionBoundaryOffset(
		context: SearchContext,
		direction: SearchDirection,
	): number {
		return direction === "forward"
			? context.offsetBase
			: context.offsetBase + context.searchText.length;
	}

	private findTargetMatch(context: SearchContext): PanelMatch | null {
		if (context.matches.length === 0) {
			return null;
		}
		const info = this.getSelectionInfo(context.editor);
		if (info.current !== null) {
			return info.current;
		}
		const direction = this.state.direction;
		const fromAbs = this.usesSelectionBounds()
			? this.selectionBoundaryOffset(context, direction)
			: direction === "forward"
				? info.to
				: info.from;
		const result = findMatchFrom(
			context.matches,
			fromAbs - context.offsetBase,
			direction,
			this.state.wrap,
		);
		return result?.match ?? null;
	}

	findNext(): void {
		this.runFind(false);
	}

	findPrevious(): void {
		this.runFind(true);
	}

	private runFind(reverse: boolean, fromHint: number | null = null): void {
		const context = this.buildContext(ACTION_MATCH_LIMIT);
		if (context === null) {
			return;
		}
		this.updateUi(context);
		if (context.matches.length === 0) {
			this.activeIndex = null;
			this.clearHighlight();
			this.updatePosition();
			this.setMessage(this.strings.noMatches);
			return;
		}

		const direction: SearchDirection = reverse
			? this.state.direction === "forward"
				? "backward"
				: "forward"
			: this.state.direction;
		const info = this.getSelectionInfo(context.editor);
		const current = info.current;

		let fromAbs: number;
		if (current !== null) {
			if (direction === "forward") {
				fromAbs =
					current.absoluteEnd === current.absoluteStart
						? current.absoluteStart + 1
						: current.absoluteEnd;
			} else {
				fromAbs =
					current.absoluteEnd === current.absoluteStart
						? current.absoluteStart - 1
						: current.absoluteStart;
			}
		} else if (fromHint !== null) {
			fromAbs = fromHint;
		} else {
			fromAbs = this.usesSelectionBounds()
				? this.selectionBoundaryOffset(context, direction)
				: direction === "forward"
					? info.to
					: info.from;
		}

		const result = findMatchFrom(
			context.matches,
			fromAbs - context.offsetBase,
			direction,
			this.state.wrap,
		);
		if (result === null) {
			this.setMessage(
				direction === "forward"
					? this.strings.reachedEnd
					: this.strings.reachedStart,
			);
			return;
		}

		this.selectMatch(context.editor, result.match, result.index);
		this.recordSearch();
		this.persist();
		if (context.truncated) {
			this.setMessage(
				this.strings.tooManyMatches(ACTION_MATCH_LIMIT),
				true,
			);
			return;
		}
		if (result.wrapped) {
			this.setMessage(
				direction === "forward"
					? this.strings.wrappedStart
					: this.strings.wrappedEnd,
			);
		} else {
			this.setMessage(
				this.strings.found(result.index + 1, context.matches.length),
			);
		}
	}

	private selectMatch(
		editor: Editor,
		match: PanelMatch,
		index: number,
	): void {
		const from = editor.offsetToPos(match.absoluteStart);
		const to = editor.offsetToPos(match.absoluteEnd);
		this.activeIndex = index;
		this.suppressRegionUpdate = true;
		try {
			editor.setSelection(from, to);
		} finally {
			this.suppressRegionUpdate = false;
		}
		editor.scrollIntoView({ from, to }, true);
		this.syncHighlights(index);
	}

	private runReplaceOnce(): void {
		this.lastReplacementStart = null;
		this.lastReplacementEnd = null;
		const context = this.buildContext(ACTION_MATCH_LIMIT);
		if (context === null) {
			return;
		}
		this.updateUi(context);
		const target = this.findTargetMatch(context);
		if (target === null) {
			this.setMessage(
				this.state.direction === "forward"
					? this.strings.reachedEnd
					: this.strings.reachedStart,
			);
			return;
		}

		if (!this.replaceMatch(context, target)) {
			return;
		}
		this.recordReplacement();
		this.persist();
		this.activeIndex = null;
		this.clearHighlight();
		this.refresh();
		this.lastReplacementStart = null;
		this.lastReplacementEnd = null;
		this.setMessage(this.strings.replacedOne);
	}

	private runReplaceAndFind(): void {
		this.lastReplacementStart = null;
		this.lastReplacementEnd = null;
		const context = this.buildContext(ACTION_MATCH_LIMIT);
		if (context === null) {
			return;
		}
		this.updateUi(context);
		const target = this.findTargetMatch(context);
		if (target === null) {
			this.setMessage(
				this.state.direction === "forward"
					? this.strings.reachedEnd
					: this.strings.reachedStart,
			);
			return;
		}
		if (!this.replaceMatch(context, target)) {
			return;
		}
		const hint =
			this.state.direction === "forward"
				? this.lastReplacementEnd
				: this.lastReplacementStart;
		this.lastReplacementStart = null;
		this.lastReplacementEnd = null;
		this.recordReplacement();
		this.persist();
		this.activeIndex = null;
		this.clearHighlight();
		this.refresh();
		this.runFind(false, hint);
	}

	private replaceMatch(context: SearchContext, match: PanelMatch): boolean {
		try {
			const replacement = this.expandFor(context, match);
			const from = context.editor.offsetToPos(match.absoluteStart);
			const to = context.editor.offsetToPos(match.absoluteEnd);
			const caret = context.editor.offsetToPos(
				match.absoluteStart + replacement.length,
			);
			this.suppressEditorChangeUntil = Date.now() + 200;
			this.suppressRegionUpdate = true;
			try {
				context.editor.transaction({
					changes: [{ from, to, text: replacement }],
					selection: { from: caret, to: caret },
				});
			} finally {
				this.suppressRegionUpdate = false;
			}
			this.updateRegionAfterReplace(
				match.absoluteEnd,
				replacement.length - (match.absoluteEnd - match.absoluteStart),
			);
			this.updateScopeAfterReplace(
				match.absoluteStart,
				match.absoluteEnd,
				replacement.length,
			);
			this.lastReplacementStart = match.absoluteStart;
			this.lastReplacementEnd =
				match.absoluteStart + replacement.length;
			return true;
		} catch {
			this.setMessage(this.strings.failed, true);
			return false;
		}
	}

	private runReplaceAll(skipConfirmation = false): void {
		const context = this.buildContext(ACTION_MATCH_LIMIT);
		if (context === null) {
			return;
		}
		this.updateUi(context);
		if (context.matches.length === 0) {
			this.activeIndex = null;
			this.clearHighlight();
			this.updatePosition();
			this.setMessage(this.strings.noMatches);
			return;
		}
		if (context.truncated) {
			this.setMessage(
				this.strings.tooManyMatches(ACTION_MATCH_LIMIT),
				true,
			);
			return;
		}
		if (
			!skipConfirmation &&
			shouldConfirmReplaceAll(context.matches.length)
		) {
			this.confirmReplaceAll(context.matches.length);
			return;
		}
		this.performReplaceAll(context);
	}

	private confirmReplaceAll(count: number): void {
		const modal = new ConfirmationModal(this.host.app);
		modal.titleEl.setText(this.strings.confirmReplaceAllTitle);
		modal.contentEl.createEl("p", {
			text: this.strings.confirmReplaceAllBody(count),
		});
		modal.addButton((button) => {
			button
				.setButtonText(this.strings.actionReplaceAll)
				.setDestructive()
				.setCta()
				.onClick(() => {
					this.runReplaceAll(true);
				});
		});
		modal.addButton((button) => {
			button
				.setButtonText(this.strings.confirmCancel)
				.setCancel()
				.setInitialFocus();
		});
		modal.open();
	}

	private performReplaceAll(context: SearchContext): void {
		this.activeIndex = null;
		try {
			const prepared = this.state.processEscapes
				? processEscapes(this.replaceText)
				: this.replaceText;
			const changes: EditorChange[] = [];
			let delta = 0;
			let lastCaret = 0;

			for (const match of context.matches) {
				const replacement = expandReplacement(
					prepared,
					match,
					context.searchText,
					context.compiled.replacementIsLiteral,
				);
				const from = context.editor.offsetToPos(match.absoluteStart);
				const to = context.editor.offsetToPos(match.absoluteEnd);
				changes.push({ from, to, text: replacement });
				lastCaret = match.absoluteStart + delta + replacement.length;
				delta +=
					replacement.length -
					(match.absoluteEnd - match.absoluteStart);
			}

			const caret = context.editor.offsetToPos(lastCaret);
			this.suppressEditorChangeUntil = Date.now() + 200;
			this.suppressRegionUpdate = true;
			try {
				context.editor.transaction({
					changes,
					selection: { from: caret, to: caret },
				});
			} finally {
				this.suppressRegionUpdate = false;
			}
			this.updateRegionAfterReplaceAll(delta);
			this.updateScopeAfterReplaceAll(delta);
			this.recordReplacement();
			this.persist();
			this.refresh();
			this.setMessage(this.strings.replacedMany(context.matches.length));
		} catch {
			this.setMessage(this.strings.failed, true);
		}
	}

	private expandFor(context: SearchContext, match: PanelMatch): string {
		const prepared = this.state.processEscapes
			? processEscapes(this.replaceText)
			: this.replaceText;
		return expandReplacement(
			prepared,
			match,
			context.searchText,
			context.compiled.replacementIsLiteral,
		);
	}

	private updateScopeAfterReplace(
		start: number,
		end: number,
		replacementLength: number,
	): void {
		const scope = this.scopeRange;
		if (scope === null || start < scope.start || end > scope.end) {
			return;
		}
		const nextEnd = scope.end + replacementLength - (end - start);
		if (nextEnd <= scope.start) {
			this.resetScopeToFile();
			return;
		}
		this.scopeRange = { ...scope, end: nextEnd };
	}

	private updateRegionAfterReplace(end: number, delta: number): void {
		const anchor = this.regionAnchor;
		if (anchor === null || delta === 0) {
			return;
		}
		const beforeAnchor =
			this.state.direction === "forward"
				? end < anchor
				: end <= anchor;
		if (beforeAnchor) {
			this.regionAnchor = Math.max(0, anchor + delta);
		}
	}

	private updateRegionAfterReplaceAll(delta: number): void {
		const anchor = this.regionAnchor;
		if (
			anchor === null ||
			delta === 0 ||
			this.state.direction !== "backward"
		) {
			return;
		}
		this.regionAnchor = Math.max(0, anchor + delta);
	}

	private updateScopeAfterReplaceAll(delta: number): void {
		const scope = this.scopeRange;
		if (scope === null) {
			return;
		}
		const nextEnd = scope.end + delta;
		if (nextEnd <= scope.start) {
			this.resetScopeToFile();
			return;
		}
		this.scopeRange = { ...scope, end: nextEnd };
	}

	private recordSearch(): void {
		this.host.plugin.recordHistory("search", this.findText);
	}

	private recordReplacement(): void {
		this.host.plugin.recordHistory("search", this.findText);
		if (this.replaceText.length > 0) {
			this.host.plugin.recordHistory("replace", this.replaceText);
		}
	}

	private persist(): void {
		this.host.plugin.savePanelSession(
			this.state,
			this.findText,
			this.replaceText,
		);
		this.host.plugin.scheduleSaveSettings();
	}

	private openHistoryMenu(
		kind: "search" | "replace",
		button: HTMLButtonElement,
	): void {
		this.hideHistoryMenu();
		const menu = new Menu();
		this.historyButton = button;
		button.setAttr("aria-expanded", "true");
		const history =
			kind === "search"
				? this.host.plugin.settings.history.search
				: this.host.plugin.settings.history.replace;

		if (history.length === 0) {
			menu.addItem((item) => {
				item.setTitle(this.strings.historyEmpty).setDisabled(true);
			});
		} else {
			for (const value of history) {
				menu.addItem((item) => {
					item.setTitle(truncate(value, 60)).onClick(() => {
						this.applyHistory(kind, value);
					});
				});
			}
		}

		menu.addSeparator();
		menu.addItem((item) => {
			item
				.setTitle(this.strings.historyClear)
				.setIcon("trash")
				.onClick(() => {
					this.clearHistory();
				});
		});

		const rect = button.getBoundingClientRect();
		menu.showAtPosition(
			{ x: rect.left, y: rect.bottom + 4 },
			button.ownerDocument,
		);
		this.historyMenu = menu;
		menu.onHide(() => {
			if (this.historyMenu === menu) {
				this.historyMenu = null;
			}
			button.setAttr("aria-expanded", "false");
			if (this.historyButton === button) {
				this.historyButton = null;
			}
		});
	}

	private applyHistory(kind: "search" | "replace", value: string): void {
		this.hideHistoryMenu();
		if (kind === "search") {
			this.findText = value;
			this.findInput.setValue(value);
			this.clearMessage();
			this.refresh();
			this.findInput.inputEl.focus();
		} else {
			this.replaceText = value;
			this.replaceInput.setValue(value);
		}
		this.persist();
	}

	private clearHistory(): void {
		this.hideHistoryMenu();
		this.host.plugin.clearHistory();
		this.host.plugin.scheduleSaveSettings();
		this.setMessage(this.strings.historyCleared);
	}

	private hideHistoryMenu(): void {
		if (this.historyMenu !== null) {
			this.historyMenu.hide();
			this.historyMenu = null;
		}
		this.historyButton?.setAttr("aria-expanded", "false");
		this.historyButton = null;
	}
}
