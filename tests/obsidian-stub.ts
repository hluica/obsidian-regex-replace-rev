/**
 * Minimal runtime stand-in for Obsidian's types-only `obsidian` package.
 * Vitest cannot resolve that package's entry point, so tests that import
 * modules with runtime Obsidian imports use this stub.
 */
export class Plugin {}
export class PluginSettingTab {}
export function getLanguage(): string {
	return "en";
}
