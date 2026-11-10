import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	globalIgnores([
		"node_modules",
		"main.js",
		"esbuild.config.mjs",
		"version-bump.mjs",
		"vitest.config.ts",
		".agents/**",
	]),
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.*"],
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ["manifest.json"],
		rules: {
			"obsidianmd/validate-manifest": ["warn", { checkId: true }],
		},
	},
	{
		files: ["src/**/*.ts"],
		rules: {
			"obsidianmd/ui/sentence-case": ["warn", { enforceCamelCaseLower: true }],
		},
	},
]);
