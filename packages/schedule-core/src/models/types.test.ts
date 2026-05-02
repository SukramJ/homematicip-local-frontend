import { WEEKDAYS } from "./common-types";
import type { Weekday } from "./common-types";
import { CONDITION_TYPES, DOMAIN_FIELD_CONFIG, DURATION_UNITS } from "./device-types";

describe("types", () => {
  describe("WEEKDAYS", () => {
    it("should contain all 7 weekdays", () => {
      expect(WEEKDAYS).toHaveLength(7);
      expect(WEEKDAYS).toEqual([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ]);
    });
  });

  describe("Weekday type", () => {
    it("should accept valid weekday values", () => {
      const monday: Weekday = "MONDAY";
      const sunday: Weekday = "SUNDAY";
      expect(monday).toBe("MONDAY");
      expect(sunday).toBe("SUNDAY");
    });
  });

  describe("CONDITION_TYPES", () => {
    it("should contain all 8 condition types", () => {
      expect(CONDITION_TYPES).toHaveLength(8);
      expect(CONDITION_TYPES).toContain("fixed_time");
      expect(CONDITION_TYPES).toContain("astro");
      expect(CONDITION_TYPES).toContain("fixed_if_before_astro");
      expect(CONDITION_TYPES).toContain("astro_if_before_fixed");
      expect(CONDITION_TYPES).toContain("fixed_if_after_astro");
      expect(CONDITION_TYPES).toContain("astro_if_after_fixed");
      expect(CONDITION_TYPES).toContain("earliest");
      expect(CONDITION_TYPES).toContain("latest");
    });
  });

  describe("DOMAIN_FIELD_CONFIG", () => {
    it("should have config for switch domain", () => {
      expect(DOMAIN_FIELD_CONFIG.switch).toEqual({
        levelType: "binary",
        hasLevel2: false,
        hasDuration: true,
        hasRampTime: false,
      });
    });

    it("should have config for light domain", () => {
      expect(DOMAIN_FIELD_CONFIG.light).toEqual({
        levelType: "percentage",
        hasLevel2: false,
        hasDuration: true,
        hasRampTime: true,
      });
    });

    it("should have config for cover domain", () => {
      expect(DOMAIN_FIELD_CONFIG.cover).toEqual({
        levelType: "percentage",
        hasLevel2: true,
        hasDuration: false,
        hasRampTime: false,
      });
    });

    it("should have config for valve domain", () => {
      expect(DOMAIN_FIELD_CONFIG.valve).toEqual({
        levelType: "binary",
        hasLevel2: false,
        hasDuration: true,
        hasRampTime: false,
      });
    });
  });

  describe("DURATION_UNITS", () => {
    it("should contain all 4 duration units", () => {
      expect(DURATION_UNITS).toHaveLength(4);
      expect(DURATION_UNITS).toEqual(["ms", "s", "min", "h"]);
    });
  });
});
