import { getTranslations, formatString, getDomainLabel } from "./index";
import type { ScheduleTranslations } from "./types";

describe("localization", () => {
  describe("getTranslations", () => {
    it("should return English translations for 'en' language code", () => {
      const t = getTranslations("en");
      expect(t.weekdays.short.monday).toBe("Mo");
      expect(t.weekdays.long.monday).toBe("Monday");
      expect(t.common.schedule).toBe("Schedule");
      expect(t.errors.failedToChangeProfile).toBe("Failed to change profile: {error}");
    });

    it("should return German translations for 'de' language code", () => {
      const t = getTranslations("de");
      expect(t.weekdays.short.monday).toBe("Mo");
      expect(t.weekdays.short.tuesday).toBe("Di");
      expect(t.weekdays.long.monday).toBe("Montag");
      expect(t.weekdays.long.tuesday).toBe("Dienstag");
      expect(t.common.schedule).toBe("Zeitplan");
    });

    it("should normalize language codes with region (e.g., 'en-US' -> 'en')", () => {
      const t = getTranslations("en-US");
      expect(t.common.schedule).toBe("Schedule");
    });

    it("should normalize language codes with region (e.g., 'de-DE' -> 'de')", () => {
      const t = getTranslations("de-DE");
      expect(t.common.schedule).toBe("Zeitplan");
    });

    it("should handle uppercase language codes", () => {
      const t = getTranslations("EN");
      expect(t.common.schedule).toBe("Schedule");
    });

    it("should handle mixed case language codes", () => {
      const t = getTranslations("De");
      expect(t.common.schedule).toBe("Zeitplan");
    });

    it("should fallback to English for unsupported language codes", () => {
      const t = getTranslations("fr");
      expect(t.common.schedule).toBe("Schedule");
    });

    it("should fallback to English for unknown language codes", () => {
      const t = getTranslations("xx-YY");
      expect(t.common.schedule).toBe("Schedule");
    });

    it("should handle empty string and fallback to English", () => {
      const t = getTranslations("");
      expect(t.common.schedule).toBe("Schedule");
    });

    it("should return all required translation sections for English", () => {
      const t = getTranslations("en");

      // Weekdays
      expect(t.weekdays).toBeDefined();
      expect(t.weekdays.short).toBeDefined();
      expect(t.weekdays.long).toBeDefined();
      expect(t.weekdays.short.monday).toBeDefined();
      expect(t.weekdays.short.tuesday).toBeDefined();
      expect(t.weekdays.short.wednesday).toBeDefined();
      expect(t.weekdays.short.thursday).toBeDefined();
      expect(t.weekdays.short.friday).toBeDefined();
      expect(t.weekdays.short.saturday).toBeDefined();
      expect(t.weekdays.short.sunday).toBeDefined();

      // Domains
      expect(t.domains).toBeDefined();
      expect(t.domains.switch).toBeDefined();
      expect(t.domains.light).toBeDefined();
      expect(t.domains.cover).toBeDefined();
      expect(t.domains.valve).toBeDefined();

      // Conditions
      expect(t.conditions).toBeDefined();
      expect(t.conditions.fixed_time).toBeDefined();
      expect(t.conditions.astro).toBeDefined();

      // Common UI strings
      expect(t.common).toBeDefined();
      expect(t.common.schedule).toBeDefined();
      expect(t.common.loading).toBeDefined();
      expect(t.common.cancel).toBeDefined();
      expect(t.common.save).toBeDefined();

      // Errors
      expect(t.errors).toBeDefined();
      expect(t.errors.failedToChangeProfile).toBeDefined();
      expect(t.errors.failedToSaveSchedule).toBeDefined();

      // Warnings
      expect(t.warnings).toBeDefined();
      expect(t.warnings.title).toBeDefined();
      expect(t.warnings.noWarnings).toBeDefined();

      // Validation messages
      expect(t.validationMessages).toBeDefined();
    });

    it("should return all required German translations", () => {
      const t = getTranslations("de");

      expect(t.weekdays.short.monday).toBe("Mo");
      expect(t.weekdays.short.wednesday).toBe("Mi");
      expect(t.weekdays.long.friday).toBe("Freitag");
      expect(t.weekdays.long.saturday).toBe("Samstag");
      expect(t.weekdays.long.sunday).toBe("Sonntag");

      expect(t.common.schedule).toBe("Zeitplan");
      expect(t.common.cancel).toBe("Abbrechen");
      expect(t.common.save).toBe("Speichern");
      expect(t.warnings.title).toBe("Validierungswarnungen");
    });
  });

  describe("formatString", () => {
    it("should replace single placeholder with value", () => {
      expect(formatString("Hello {name}", { name: "World" })).toBe("Hello World");
    });

    it("should replace multiple placeholders with values", () => {
      expect(
        formatString("Hello {name}, you are {age} years old", { name: "Alice", age: "30" }),
      ).toBe("Hello Alice, you are 30 years old");
    });

    it("should replace same placeholder only once", () => {
      expect(formatString("{name} loves {name}", { name: "Bob" })).toBe("Bob loves {name}");
    });

    it("should handle template with no placeholders", () => {
      expect(formatString("No placeholders here", {})).toBe("No placeholders here");
    });

    it("should leave unreplaced placeholders if key not provided", () => {
      expect(formatString("Hello {name}", {})).toBe("Hello {name}");
    });

    it("should handle empty string template", () => {
      expect(formatString("", { name: "Test" })).toBe("");
    });

    it("should handle numeric values", () => {
      expect(formatString("Value: {value}", { value: 123 })).toBe("Value: 123");
    });

    it("should replace error message placeholders", () => {
      expect(
        formatString("Failed to change profile: {error}", { error: "Connection timeout" }),
      ).toBe("Failed to change profile: Connection timeout");
    });

    it("should handle special characters in values", () => {
      expect(formatString("Error: {error}", { error: "Failed with: $pecial ch@rs!" })).toBe(
        "Error: Failed with: $pecial ch@rs!",
      );
    });
  });

  describe("getDomainLabel", () => {
    it("should return English domain labels", () => {
      expect(getDomainLabel("switch", "en")).toBe("Switch");
      expect(getDomainLabel("light", "en")).toBe("Light");
      expect(getDomainLabel("cover", "en")).toBe("Cover");
      expect(getDomainLabel("valve", "en")).toBe("Valve");
    });

    it("should return German domain labels", () => {
      expect(getDomainLabel("switch", "de")).toBe("Schalter");
      expect(getDomainLabel("light", "de")).toBe("Licht");
      expect(getDomainLabel("cover", "de")).toBe("Rollladen");
      expect(getDomainLabel("valve", "de")).toBe("Ventil");
    });

    it("should return empty string for undefined domain", () => {
      expect(getDomainLabel(undefined, "en")).toBe("");
    });
  });

  describe("Translations type structure", () => {
    it("should have correct structure for English translations", () => {
      const t: ScheduleTranslations = getTranslations("en");
      expect(typeof t.weekdays.short.monday).toBe("string");
      expect(typeof t.weekdays.long.monday).toBe("string");
      expect(typeof t.common.schedule).toBe("string");
      expect(typeof t.errors.failedToChangeProfile).toBe("string");
      expect(typeof t.warnings.title).toBe("string");
    });

    it("should have correct structure for German translations", () => {
      const t: ScheduleTranslations = getTranslations("de");
      expect(typeof t.weekdays.short.monday).toBe("string");
      expect(typeof t.weekdays.long.monday).toBe("string");
      expect(typeof t.common.schedule).toBe("string");
      expect(typeof t.errors.failedToChangeProfile).toBe("string");
      expect(typeof t.warnings.title).toBe("string");
    });
  });
});
