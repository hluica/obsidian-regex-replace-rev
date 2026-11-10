import { describe, expect, it } from "vitest";
import { stringsFor } from "../src/i18n/strings";

describe("stringsFor", () => {
	it("returns Chinese for zh variants", () => {
		expect(stringsFor("zh").title).toBe("查找与替换");
		expect(stringsFor("zh-CN").title).toBe("查找与替换");
		expect(stringsFor("zh-TW").title).toBe("查找与替换");
	});

	it("returns English for en and unknown languages", () => {
		expect(stringsFor("en").title).toBe("Find and replace");
		expect(stringsFor("fr").title).toBe("Find and replace");
	});

	it("formats match counts with singular and plural", () => {
		expect(stringsFor("en").count(1)).toBe("1 match");
		expect(stringsFor("en").count(2)).toBe("2 matches");
		expect(stringsFor("en").count(10000, true)).toBe("10000+ matches");
		expect(stringsFor("zh").count(1)).toBe("1 个匹配");
		expect(stringsFor("zh").count(10000, true)).toBe("10000+ 个匹配");
	});

	it("has non-empty primary labels", () => {
		for (const language of ["en", "zh"]) {
			const strings = stringsFor(language);
			expect(strings.title.length).toBeGreaterThan(0);
			expect(strings.actionFind.length).toBeGreaterThan(0);
			expect(strings.actionReplace.length).toBeGreaterThan(0);
			expect(strings.actionReplaceFind.length).toBeGreaterThan(0);
			expect(strings.actionReplaceAll.length).toBeGreaterThan(0);
			expect(strings.emptyFind.length).toBeGreaterThan(0);
		}
	});
});
