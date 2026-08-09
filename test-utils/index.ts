/**
 * Shared test helpers for the Vitest suites.
 *
 * Import through the `@hmip/test-utils` alias, which `vitest.config.ts` maps to
 * this file:
 *
 * ```ts
 * import { createHass, mount, textOf } from "@hmip/test-utils";
 * ```
 */
export * from "./dom";
export * from "./fixtures";
export * from "./ha-stubs";
export * from "./hass";
