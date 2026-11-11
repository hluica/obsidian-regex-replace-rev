import {
	Plugin,
	PluginSettingTab,
	type App,
	type SettingDefinitionItem,
} from "obsidian";
import { currentStrings } from "./i18n";
import type { MatchMode, SearchDirection, SearchScope } from "./search/types";

export interface SearchUiState {
	mode: MatchMode;
	caseSensitive: boolean;
	wholeWord: boolean;
	dotAll: boolean;
	multiline: boolean;
	unicode: boolean;
	wrap: boolean;
	processEscapes: boolean;
	scope: SearchScope;
	direction: SearchDirection;
}

export interface SearchHistory {
	search: string[];
	replace: string[];
}

export interface PluginSettings {
	[key: string]: unknown;
	defaultMode: MatchMode;
	rememberLastState: boolean;
	prefillFromSelection: boolean;
	rememberHistory: boolean;
	lastSearch: string;
	lastReplace: string;
	lastState: SearchUiState;
	history: SearchHistory;
	settingsVersion: number;
}

export const DEFAULT_UI_STATE: SearchUiState = {
	mode: "exact",
	caseSensitive: false,
	wholeWord: false,
	dotAll: false,
	multiline: false,
	unicode: false,
	wrap: true,
	processEscapes: false,
	scope: "file",
	direction: "forward",
};

const HISTORY_LIMIT = 20;
const MAX_PATTERN_LENGTH = 2000;

export function createDefaultSettings(): PluginSettings {
	return {
		defaultMode: "exact",
		rememberLastState: true,
		prefillFromSelection: true,
		rememberHistory: true,
		lastSearch: "",
		lastReplace: "",
		lastState: { ...DEFAULT_UI_STATE },
		history: { search: [], replace: [] },
		settingsVersion: 1,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function readString(
	value: unknown,
	fallback: string,
	maxLength = MAX_PATTERN_LENGTH,
): string {
	return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

function readMode(value: unknown, fallback: MatchMode): MatchMode {
	return value === "exact" || value === "wildcard" || value === "regex"
		? value
		: fallback;
}

function readScope(value: unknown, fallback: SearchScope): SearchScope {
	return value === "file" || value === "selection" ? value : fallback;
}

function readDirection(
	value: unknown,
	fallback: SearchDirection,
): SearchDirection {
	return value === "forward" || value === "backward" ? value : fallback;
}

function readHistory(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const result: string[] = [];
	for (const item of value) {
		if (typeof item !== "string") {
			continue;
		}
		const trimmed = item.slice(0, MAX_PATTERN_LENGTH);
		if (trimmed.length > 0 && !result.includes(trimmed)) {
			result.push(trimmed);
		}
		if (result.length >= HISTORY_LIMIT) {
			break;
		}
	}
	return result;
}

export function normalizeUiState(
	value: unknown,
	fallback: SearchUiState,
): SearchUiState {
	if (!isRecord(value)) {
		return { ...fallback };
	}
	return {
		mode: readMode(value.mode, fallback.mode),
		caseSensitive: readBoolean(value.caseSensitive, fallback.caseSensitive),
		wholeWord: readBoolean(value.wholeWord, fallback.wholeWord),
		dotAll: readBoolean(value.dotAll, fallback.dotAll),
		multiline: readBoolean(value.multiline, fallback.multiline),
		unicode: readBoolean(value.unicode, fallback.unicode),
		wrap: readBoolean(value.wrap, fallback.wrap),
		processEscapes: readBoolean(
			value.processEscapes,
			fallback.processEscapes,
		),
		scope: readScope(value.scope, fallback.scope),
		direction: readDirection(value.direction, fallback.direction),
	};
}

export function normalizeSettings(raw: unknown): PluginSettings {
	const defaults = createDefaultSettings();
	if (!isRecord(raw)) {
		return defaults;
	}

	const rawHistory = isRecord(raw.history) ? raw.history : {};
	const legacyProcessEscapes = readBoolean(raw.processEscapes, false);
	const lastState = normalizeUiState(raw.lastState, {
		...DEFAULT_UI_STATE,
		processEscapes: legacyProcessEscapes,
	});

	return {
		defaultMode: readMode(raw.defaultMode, defaults.defaultMode),
		rememberLastState: readBoolean(
			raw.rememberLastState,
			defaults.rememberLastState,
		),
		prefillFromSelection: readBoolean(
			raw.prefillFromSelection,
			defaults.prefillFromSelection,
		),
		rememberHistory: readBoolean(
			raw.rememberHistory,
			defaults.rememberHistory,
		),
		lastSearch: readString(raw.lastSearch, defaults.lastSearch),
		lastReplace: readString(raw.lastReplace, defaults.lastReplace),
		lastState,
		history: {
			search: readHistory(rawHistory.search),
			replace: readHistory(rawHistory.replace),
		},
		settingsVersion: 1,
	};
}

export interface SettingsOwner extends Plugin {
	settings: PluginSettings;
	saveSettings: () => Promise<void>;
	clearHistory: () => void;
}

export class FindReplaceSettingTab extends PluginSettingTab {
	plugin: SettingsOwner;

	constructor(app: App, plugin: SettingsOwner) {
		super(app, plugin);
		this.plugin = plugin;
		this.icon = "search";
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const strings = currentStrings();
		const settings = this.plugin.settings;

		return [
			{
				type: "group",
				heading: strings.settingsHeading,
				items: [
					{
						name: strings.settingsRememberState,
						desc: strings.settingsRememberStateDesc,
						control: {
							type: "toggle",
							key: "rememberLastState",
							defaultValue: settings.rememberLastState,
						},
					},
					{
						name: strings.settingsPrefillSelection,
						desc: strings.settingsPrefillSelectionDesc,
						control: {
							type: "toggle",
							key: "prefillFromSelection",
							defaultValue: settings.prefillFromSelection,
						},
					},
					{
						name: strings.settingsRememberHistory,
						desc: strings.settingsRememberHistoryDesc,
						control: {
							type: "toggle",
							key: "rememberHistory",
							defaultValue: settings.rememberHistory,
						},
					},
					{
						name: strings.settingsDefaultMode,
						desc: strings.settingsDefaultModeDesc,
						control: {
							type: "dropdown",
							key: "defaultMode",
							defaultValue: settings.defaultMode,
							options: {
								exact: strings.modeExact,
								wildcard: strings.modeWildcard,
								regex: strings.modeRegex,
							},
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		this.plugin.settings[key] = value;
		if (key === "rememberHistory" && value === false) {
			this.plugin.clearHistory();
		}
		await this.plugin.saveSettings();
	}
}
