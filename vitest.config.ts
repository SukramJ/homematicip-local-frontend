/**
 * Vitest configuration for every package that imports Lit.
 *
 * `schedule-core` keeps its Jest suite: it is pure logic, imports no Lit, and
 * ts-jest' CommonJS transform handles it. Lit 3 ships ESM only, which Jest can
 * load solely through `--experimental-vm-modules`; Vitest is ESM-native, so the
 * Lit packages run here instead.
 *
 * Workspace packages resolve to their *sources*, not to `dist/`, so tests always
 * run against the current code and never require a build first.
 */
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const from = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

/** One Vitest project per package, sharing the root config via `extends`. */
const project = (name: string) => ({
  // `as const`: a widened `boolean` would not match Vitest's `string | true`.
  extends: true as const,
  test: {
    name,
    include: [`packages/${name}/src/**/*.test.ts`],
  },
});

export default defineConfig({
  resolve: {
    alias: {
      "@hmip/panel-api": from("./packages/panel-api/src/index.ts"),
      "@hmip/schedule-core": from("./packages/schedule-core/src/index.ts"),
      "@hmip/schedule-ui": from("./packages/schedule-ui/src/index.ts"),
      "@hmip/climate-schedule-card": from("./packages/climate-schedule-card/src/card.ts"),
      "@hmip/schedule-card": from("./packages/schedule-card/src/card.ts"),
      "@hmip/test-utils": from("./test-utils/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [from("./test-utils/setup.ts")],
    restoreMocks: true,
    projects: [
      project("panel-api"),
      project("schedule-ui"),
      project("config-panel"),
      project("climate-schedule-card"),
      project("schedule-card"),
      project("status-card"),
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["packages/*/src/**/*.ts"],
      exclude: [
        // schedule-core is measured by its own Jest coverage run.
        "packages/schedule-core/**",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/index.ts",
        "**/styles.ts",
        "**/styles/**",
      ],
    },
  },
});
