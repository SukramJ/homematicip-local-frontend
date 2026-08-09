import { describe, expect, it } from "vitest";

import { formatString, getTranslations } from "./localization";

describe("getTranslations", () => {
  it("returns the English catalogue", () => {
    expect(getTranslations("en").ui.schedule).toBe("Schedule");
  });

  it("returns the German catalogue", () => {
    expect(getTranslations("de").ui.schedule).toBe("Zeitplan");
  });

  it("normalizes a regional language tag to its base language", () => {
    expect(getTranslations("de-DE").ui.schedule).toBe("Zeitplan");
    expect(getTranslations("en-US").ui.schedule).toBe("Schedule");
  });

  it("normalizes the case Home Assistant may send", () => {
    expect(getTranslations("DE-de").ui.schedule).toBe("Zeitplan");
  });

  it("falls back to English for a language it does not carry", () => {
    expect(getTranslations("fr").ui.schedule).toBe("Schedule");
  });

  it("covers every weekday in both catalogues", () => {
    for (const language of ["en", "de"]) {
      const { weekdays } = getTranslations(language);
      expect(Object.keys(weekdays.short)).toHaveLength(7);
      expect(Object.keys(weekdays.long)).toHaveLength(7);
      expect(Object.values(weekdays.long).every(Boolean)).toBe(true);
    }
  });
});

describe("formatString", () => {
  it("substitutes a named placeholder", () => {
    expect(formatString("Entity {entity} not found", { entity: "climate.living_room" })).toBe(
      "Entity climate.living_room not found",
    );
  });

  it("substitutes several placeholders", () => {
    expect(formatString("{a} then {b}", { a: "first", b: "second" })).toBe("first then second");
  });

  it("leaves a placeholder without a value in place", () => {
    expect(formatString("Entity {entity} not found", {})).toBe("Entity {entity} not found");
  });

  it("ignores values that the template does not reference", () => {
    expect(formatString("no placeholders", { entity: "climate.x" })).toBe("no placeholders");
  });
});
