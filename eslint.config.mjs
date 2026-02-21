import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/*/src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
  },
  {
    files: ["packages/*/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.js", "**/*.mjs"],
  },
);
