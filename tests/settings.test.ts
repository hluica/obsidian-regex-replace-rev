import { describe, expect, it } from "vitest";
import { createDefaultSettings, normalizeSettings } from "../src/settings";

describe("compact panel setting", () => {
	it("defaults to the standard density", () => {
		expect(createDefaultSettings().compactPanel).toBe(false);
	});

	it("keeps an explicit compact preference", () => {
		expect(normalizeSettings({ compactPanel: true }).compactPanel).toBe(true);
		expect(normalizeSettings({ compactPanel: false }).compactPanel).toBe(
			false,
		);
	});

	it("falls back to the standard density for invalid values", () => {
		expect(normalizeSettings({ compactPanel: "yes" }).compactPanel).toBe(
			false,
		);
		expect(normalizeSettings({ compactPanel: null }).compactPanel).toBe(
			false,
		);
	});

	it("does not disturb the other settings", () => {
		const settings = normalizeSettings({
			compactPanel: true,
			defaultMode: "wildcard",
			rememberLastState: false,
		});
		expect(settings.defaultMode).toBe("wildcard");
		expect(settings.rememberLastState).toBe(false);
		expect(settings.compactPanel).toBe(true);
	});
});
