import storybook from "eslint-plugin-storybook";
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { globalIgnores } from "eslint/config";
import jsxA11y from "eslint-plugin-jsx-a11y";
import perfectionist from "eslint-plugin-perfectionist";
import reactPlugin from "eslint-plugin-react";
import prettierConfig from "eslint-config-prettier";
import pluginQuery from "@tanstack/eslint-plugin-query";
import { defineConfig } from "eslint/config";
import reactCompiler from "eslint-plugin-react-compiler";

export default defineConfig([
  globalIgnores(["node_modules", "dist", "public", "*.config.{js,mjs,ts}", "!.storybook", "coverage"]),
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  jsxA11y.flatConfigs.strict,
  reactRefresh.configs.vite,
  ...pluginQuery.configs["flat/recommended"],
  storybook.configs["flat/recommended"],
  reactHooks.configs.flat.recommended,
  reactCompiler.configs.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    ...reactPlugin.configs.flat.all,
    ...reactPlugin.configs.flat["jsx-runtime"],
    plugins: {
      perfectionist
    },
    rules: {
      "perfectionist/sort-interfaces": [
        "error",
        {
          newlinesBetween: 0
        }
      ],
      "perfectionist/sort-objects": [
        "error",
        {
          newlinesBetween: 0
        }
      ],
      "perfectionist/sort-jsx-props": [
        "error",
        {
          newlinesBetween: 0
        }
      ],
      "perfectionist/sort-enums": [
        "error",
        {
          newlinesBetween: 0
        }
      ],
      "perfectionist/sort-imports": [
        "error",
        {
          internalPattern: ["^@/(.*)$"],
          groups: [
            "react",
            ["value-builtin", "value-external"],
            "type-internal",
            "value-internal",
            ["type-parent", "type-sibling", "type-index"],
            ["value-parent", "value-sibling", "value-index"],
            "ts-equals-import",
            "unknown"
          ],
          customGroups: [
            {
              groupName: "react",
              elementNamePattern: ["^react$", "^react-.+"]
            }
          ]
        }
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "sort-imports": "off",
      "one-var": "off"
    },
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOption,
      ...jsxA11y.flatConfigs.recommended.languageOptions,
      ecmaVersion: 2020,
      globals: {
        ...globals.browser
      }
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  prettierConfig
]);
