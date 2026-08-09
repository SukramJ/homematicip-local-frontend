import { describe, expect, it } from "vitest";

import { createHass } from "@hmip/test-utils";

import { localize } from "./localize";

describe("localize", () => {
  it("resolves a dotted key from the English catalogue", () => {
    expect(localize(createHass(), "common.back")).toBe("Back");
  });

  it("resolves the same key in German", () => {
    expect(localize(createHass({ language: "de" }), "common.back")).toBe("Zurück");
  });

  it("falls back to English for a language without a catalogue", () => {
    expect(localize(createHass({ language: "fr" }), "common.back")).toBe("Back");
  });

  it("substitutes placeholders", () => {
    expect(localize(createHass(), "device_links.subtitle", { device: "Living Room Switch" })).toBe(
      "Direct links for Living Room Switch",
    );
  });

  it("substitutes numbers", () => {
    expect(localize(createHass(), "change_history.parameters_changed", { count: 3 })).toBe(
      "3 parameter(s) changed",
    );
  });

  it("leaves placeholders the caller did not supply untouched", () => {
    expect(localize(createHass(), "device_links.subtitle", {})).toBe("Direct links for {device}");
  });

  it("accepts keys carrying the panel prefix the backend sends", () => {
    expect(localize(createHass(), "panel.common.back")).toBe("Back");
  });

  it("returns the key itself when nothing matches, so the gap is visible in the UI", () => {
    expect(localize(createHass(), "common.no_such_key")).toBe("common.no_such_key");
  });

  it("treats a missing language as English", () => {
    const hass = createHass();
    // The panel runs against Home Assistant versions that may omit the field.
    (hass.config as { language?: string }).language = undefined;

    expect(localize(hass, "common.back")).toBe("Back");
  });
});
