import {
  isEntryActive,
  scheduleToUIEntries,
  createEmptyEntry,
  isAstroCondition,
  parseDuration,
  buildDuration,
  formatDurationDisplay,
  isValidDuration,
  formatLevel,
  formatAstroTime,
  formatConditionSummary,
  formatConditionDisplay,
  entryToBackend,
  scheduleToBackend,
  isValidScheduleEntity,
} from "./device-helpers";
import type { ConditionSummaryLabels } from "./device-helpers";
import type {
  SimpleScheduleEntry,
  SimpleSchedule,
  DeviceScheduleEntityAttributes,
} from "../models/device-types";

function makeEntry(overrides?: Partial<SimpleScheduleEntry>): SimpleScheduleEntry {
  return {
    weekdays: ["MONDAY"],
    time: "12:00",
    condition: "fixed_time",
    astro_type: null,
    astro_offset_minutes: 0,
    target_channels: ["1_1"],
    level: 1,
    level_2: null,
    duration: null,
    ramp_time: null,
    lock_mode: null,
    lock_action: null,
    permission: null,
    ...overrides,
  };
}

describe("device-helpers", () => {
  describe("isEntryActive", () => {
    it("should return true for active entries", () => {
      expect(isEntryActive(makeEntry())).toBe(true);
    });

    it("should return false for entries without weekdays", () => {
      expect(isEntryActive(makeEntry({ weekdays: [] }))).toBe(false);
    });

    it("should return false for entries without target channels", () => {
      expect(isEntryActive(makeEntry({ target_channels: [] }))).toBe(false);
    });
  });

  describe("scheduleToUIEntries", () => {
    it("should convert schedule to sorted UI entries", () => {
      const schedule: SimpleSchedule = {
        "2": makeEntry({ time: "18:00", level: 0 }),
        "1": makeEntry({ time: "06:30", level: 1 }),
      };

      const entries = scheduleToUIEntries(schedule);

      expect(entries).toHaveLength(2);
      expect(entries[0].groupNo).toBe("1");
      expect(entries[0].time).toBe("06:30");
      expect(entries[1].groupNo).toBe("2");
      expect(entries[1].time).toBe("18:00");
    });

    it("should mark active entries", () => {
      const schedule: SimpleSchedule = {
        "1": makeEntry(),
        "2": makeEntry({ weekdays: [] }),
      };

      const entries = scheduleToUIEntries(schedule);
      expect(entries[0].isActive).toBe(true);
      expect(entries[1].isActive).toBe(false);
    });
  });

  describe("createEmptyEntry", () => {
    it("should create base empty entry", () => {
      const entry = createEmptyEntry();
      expect(entry.weekdays).toEqual([]);
      expect(entry.time).toBe("00:00");
      expect(entry.condition).toBe("fixed_time");
      expect(entry.astro_type).toBeNull();
      expect(entry.astro_offset_minutes).toBe(0);
      expect(entry.target_channels).toEqual([]);
      expect(entry.level).toBe(0);
      expect(entry.level_2).toBeNull();
      expect(entry.duration).toBeNull();
      expect(entry.ramp_time).toBeNull();
    });

    it("should create cover entry with level_2", () => {
      const entry = createEmptyEntry("cover");
      expect(entry.level_2).toBe(0);
    });

    it("should create switch entry without level_2", () => {
      expect(createEmptyEntry("switch").level_2).toBeNull();
    });

    it("should create light entry without level_2", () => {
      expect(createEmptyEntry("light").level_2).toBeNull();
    });

    it("should create valve entry without level_2", () => {
      expect(createEmptyEntry("valve").level_2).toBeNull();
    });
  });

  describe("isAstroCondition", () => {
    it("should return false for fixed_time", () => {
      expect(isAstroCondition("fixed_time")).toBe(false);
    });

    it("should return true for all other conditions", () => {
      expect(isAstroCondition("astro")).toBe(true);
      expect(isAstroCondition("fixed_if_before_astro")).toBe(true);
      expect(isAstroCondition("astro_if_before_fixed")).toBe(true);
      expect(isAstroCondition("fixed_if_after_astro")).toBe(true);
      expect(isAstroCondition("astro_if_after_fixed")).toBe(true);
      expect(isAstroCondition("earliest")).toBe(true);
      expect(isAstroCondition("latest")).toBe(true);
    });
  });

  describe("parseDuration", () => {
    it("should parse milliseconds", () => {
      expect(parseDuration("500ms")).toEqual({ value: 500, unit: "ms" });
    });

    it("should parse seconds", () => {
      expect(parseDuration("10s")).toEqual({ value: 10, unit: "s" });
    });

    it("should parse minutes", () => {
      expect(parseDuration("5min")).toEqual({ value: 5, unit: "min" });
    });

    it("should parse hours", () => {
      expect(parseDuration("4h")).toEqual({ value: 4, unit: "h" });
    });

    it("should parse decimal values", () => {
      expect(parseDuration("2.5h")).toEqual({ value: 2.5, unit: "h" });
    });

    it("should return null for invalid format", () => {
      expect(parseDuration("invalid")).toBeNull();
      expect(parseDuration("")).toBeNull();
      expect(parseDuration("5x")).toBeNull();
    });
  });

  describe("buildDuration", () => {
    it("should build duration strings", () => {
      expect(buildDuration(500, "ms")).toBe("500ms");
      expect(buildDuration(10, "s")).toBe("10s");
      expect(buildDuration(5, "min")).toBe("5min");
      expect(buildDuration(4, "h")).toBe("4h");
    });
  });

  describe("formatDurationDisplay", () => {
    it("should return dash for null", () => {
      expect(formatDurationDisplay(null)).toBe("-");
    });

    it("should format valid durations", () => {
      expect(formatDurationDisplay("500ms")).toBe("500ms");
      expect(formatDurationDisplay("10s")).toBe("10s");
      expect(formatDurationDisplay("5min")).toBe("5min");
      expect(formatDurationDisplay("4h")).toBe("4h");
    });

    it("should return raw string for invalid format", () => {
      expect(formatDurationDisplay("invalid")).toBe("invalid");
    });
  });

  describe("isValidDuration", () => {
    it("should validate correct durations", () => {
      expect(isValidDuration("500ms")).toBe(true);
      expect(isValidDuration("10s")).toBe(true);
      expect(isValidDuration("5min")).toBe(true);
      expect(isValidDuration("4h")).toBe(true);
      expect(isValidDuration("2.5h")).toBe(true);
    });

    it("should reject invalid durations", () => {
      expect(isValidDuration("invalid")).toBe(false);
      expect(isValidDuration("5x")).toBe(false);
      expect(isValidDuration("")).toBe(false);
    });

    it("should accept the maximum factor of 30 per unit", () => {
      expect(isValidDuration("30s")).toBe(true);
      expect(isValidDuration("30min")).toBe(true);
      expect(isValidDuration("30h")).toBe(true);
      expect(isValidDuration("3000ms")).toBe(true);
    });

    it("should reject values exceeding the CCU max factor of 30", () => {
      expect(isValidDuration("31s")).toBe(false);
      expect(isValidDuration("40min")).toBe(false);
      expect(isValidDuration("31h")).toBe(false);
      expect(isValidDuration("3100ms")).toBe(false);
    });
  });

  describe("formatLevel", () => {
    it("should format switch level as On/Off", () => {
      expect(formatLevel(0, "switch")).toBe("Off");
      expect(formatLevel(1, "switch")).toBe("On");
    });

    it("should format light level as percentage", () => {
      expect(formatLevel(0, "light")).toBe("0%");
      expect(formatLevel(0.5, "light")).toBe("50%");
      expect(formatLevel(1, "light")).toBe("100%");
    });

    it("should format cover level as percentage", () => {
      expect(formatLevel(0, "cover")).toBe("0%");
      expect(formatLevel(0.5, "cover")).toBe("50%");
      expect(formatLevel(1, "cover")).toBe("100%");
    });

    it("should format valve level as On/Off", () => {
      expect(formatLevel(0, "valve")).toBe("Off");
      expect(formatLevel(1, "valve")).toBe("On");
    });

    it("should format level as percentage when no domain provided", () => {
      expect(formatLevel(0)).toBe("0%");
      expect(formatLevel(0.5)).toBe("50%");
      expect(formatLevel(1)).toBe("100%");
    });

    it("should use localized binary labels when provided", () => {
      expect(formatLevel(0, "switch", { on: "Ein", off: "Aus" })).toBe("Aus");
      expect(formatLevel(1, "switch", { on: "Ein", off: "Aus" })).toBe("Ein");
    });

    it("should ignore binary labels for non-binary domains", () => {
      expect(formatLevel(0.5, "light", { on: "Ein", off: "Aus" })).toBe("50%");
    });
  });

  describe("formatAstroTime", () => {
    it("should format sunrise/sunset without offset", () => {
      expect(formatAstroTime("sunrise", 0)).toBe("Sunrise");
      expect(formatAstroTime("sunset", 0)).toBe("Sunset");
    });

    it("should format with positive offset", () => {
      expect(formatAstroTime("sunrise", 30)).toBe("Sunrise +30m");
    });

    it("should format with negative offset", () => {
      expect(formatAstroTime("sunset", -45)).toBe("Sunset -45m");
    });
  });

  describe("formatConditionSummary", () => {
    const labels: ConditionSummaryLabels = {
      sunrise: "Sunrise",
      sunset: "Sunset",
      or: "or",
      ifBefore: "if before",
      ifAfter: "if after",
    };

    const deLabels: ConditionSummaryLabels = {
      sunrise: "Sonnenaufgang",
      sunset: "Sonnenuntergang",
      or: "oder",
      ifBefore: "wenn vor",
      ifAfter: "wenn nach",
    };

    it("should show just time for fixed_time", () => {
      const entry = {
        time: "17:30",
        condition: "fixed_time" as const,
        astro_type: null,
        astro_offset_minutes: 0,
      };
      expect(formatConditionSummary(entry, "Fixed Time", labels)).toBe("17:30");
    });

    it("should show astro label for astro condition", () => {
      const entry = {
        time: "00:00",
        condition: "astro" as const,
        astro_type: "sunrise" as const,
        astro_offset_minutes: 20,
      };
      expect(formatConditionSummary(entry, "Astro", labels)).toBe("Sunrise +20min");
    });

    it("should show astro without offset", () => {
      const entry = {
        time: "00:00",
        condition: "astro" as const,
        astro_type: "sunset" as const,
        astro_offset_minutes: 0,
      };
      expect(formatConditionSummary(entry, "Astro", labels)).toBe("Sunset");
    });

    it("should show astro with negative offset", () => {
      const entry = {
        time: "00:00",
        condition: "astro" as const,
        astro_type: "sunrise" as const,
        astro_offset_minutes: -20,
      };
      expect(formatConditionSummary(entry, "Astro", labels)).toBe("Sunrise -20min");
    });

    it("should format earliest condition", () => {
      const entry = {
        time: "06:30",
        condition: "earliest" as const,
        astro_type: "sunrise" as const,
        astro_offset_minutes: -20,
      };
      expect(formatConditionSummary(entry, "Earliest", labels)).toBe(
        "Earliest: Sunrise -20min or 06:30",
      );
    });

    it("should format latest condition", () => {
      const entry = {
        time: "08:00",
        condition: "latest" as const,
        astro_type: "sunset" as const,
        astro_offset_minutes: 30,
      };
      expect(formatConditionSummary(entry, "Latest", labels)).toBe(
        "Latest: Sunset +30min or 08:00",
      );
    });

    it("should format fixed_if_before_astro", () => {
      const entry = {
        time: "06:30",
        condition: "fixed_if_before_astro" as const,
        astro_type: "sunrise" as const,
        astro_offset_minutes: 0,
      };
      expect(formatConditionSummary(entry, "Fixed if before Astro", labels)).toBe(
        "06:30 if before Sunrise",
      );
    });

    it("should format astro_if_before_fixed", () => {
      const entry = {
        time: "06:30",
        condition: "astro_if_before_fixed" as const,
        astro_type: "sunrise" as const,
        astro_offset_minutes: 10,
      };
      expect(formatConditionSummary(entry, "Astro if before Fixed", labels)).toBe(
        "Sunrise +10min if before 06:30",
      );
    });

    it("should format fixed_if_after_astro", () => {
      const entry = {
        time: "16:00",
        condition: "fixed_if_after_astro" as const,
        astro_type: "sunset" as const,
        astro_offset_minutes: 10,
      };
      expect(formatConditionSummary(entry, "Fixed if after Astro", labels)).toBe(
        "16:00 if after Sunset +10min",
      );
    });

    it("should format astro_if_after_fixed", () => {
      const entry = {
        time: "16:00",
        condition: "astro_if_after_fixed" as const,
        astro_type: "sunset" as const,
        astro_offset_minutes: 10,
      };
      expect(formatConditionSummary(entry, "Astro if after Fixed", labels)).toBe(
        "Sunset +10min if after 16:00",
      );
    });

    it("should work with German labels", () => {
      const entry = {
        time: "06:30",
        condition: "earliest" as const,
        astro_type: "sunrise" as const,
        astro_offset_minutes: -20,
      };
      expect(formatConditionSummary(entry, "Frühester", deLabels)).toBe(
        "Frühester: Sonnenaufgang -20min oder 06:30",
      );
    });

    it("should work with German labels for combined conditions", () => {
      const entry = {
        time: "16:00",
        condition: "fixed_if_before_astro" as const,
        astro_type: "sunset" as const,
        astro_offset_minutes: 10,
      };
      expect(formatConditionSummary(entry, "Fest wenn vor Astro", deLabels)).toBe(
        "16:00 wenn vor Sonnenuntergang +10min",
      );
    });
  });

  describe("formatConditionDisplay", () => {
    const labels: ConditionSummaryLabels = {
      sunrise: "Sunrise",
      sunset: "Sunset",
      or: "or",
      ifBefore: "if before",
      ifAfter: "if after",
    };

    it("should split fixed_time into label and time", () => {
      const entry = {
        time: "17:30",
        condition: "fixed_time" as const,
        astro_type: null,
        astro_offset_minutes: 0,
      };
      expect(formatConditionDisplay(entry, "Fixed Time", labels)).toEqual({
        label: "Fixed Time",
        details: "17:30",
      });
    });

    it("should split astro into label and astro details", () => {
      const entry = {
        time: "00:00",
        condition: "astro" as const,
        astro_type: "sunrise" as const,
        astro_offset_minutes: 20,
      };
      expect(formatConditionDisplay(entry, "Astro", labels)).toEqual({
        label: "Astro",
        details: "Sunrise +20min",
      });
    });

    it("should format earliest with astro / time", () => {
      const entry = {
        time: "06:30",
        condition: "earliest" as const,
        astro_type: "sunrise" as const,
        astro_offset_minutes: -20,
      };
      expect(formatConditionDisplay(entry, "Earliest", labels)).toEqual({
        label: "Earliest",
        details: "Sunrise -20min / 06:30",
      });
    });

    it("should format latest with astro / time", () => {
      const entry = {
        time: "08:00",
        condition: "latest" as const,
        astro_type: "sunset" as const,
        astro_offset_minutes: 30,
      };
      expect(formatConditionDisplay(entry, "Latest", labels)).toEqual({
        label: "Latest",
        details: "Sunset +30min / 08:00",
      });
    });

    it("should format fixed_if_before_astro with time / astro", () => {
      const entry = {
        time: "06:30",
        condition: "fixed_if_before_astro" as const,
        astro_type: "sunrise" as const,
        astro_offset_minutes: 0,
      };
      expect(formatConditionDisplay(entry, "Fixed if before Astro", labels)).toEqual({
        label: "Fixed if before Astro",
        details: "06:30 / Sunrise",
      });
    });

    it("should format astro_if_before_fixed with astro / time", () => {
      const entry = {
        time: "06:30",
        condition: "astro_if_before_fixed" as const,
        astro_type: "sunrise" as const,
        astro_offset_minutes: 10,
      };
      expect(formatConditionDisplay(entry, "Astro if before Fixed", labels)).toEqual({
        label: "Astro if before Fixed",
        details: "Sunrise +10min / 06:30",
      });
    });

    it("should format fixed_if_after_astro with time / astro", () => {
      const entry = {
        time: "16:00",
        condition: "fixed_if_after_astro" as const,
        astro_type: "sunset" as const,
        astro_offset_minutes: 10,
      };
      expect(formatConditionDisplay(entry, "Fixed if after Astro", labels)).toEqual({
        label: "Fixed if after Astro",
        details: "16:00 / Sunset +10min",
      });
    });

    it("should format astro_if_after_fixed with astro / time", () => {
      const entry = {
        time: "16:00",
        condition: "astro_if_after_fixed" as const,
        astro_type: "sunset" as const,
        astro_offset_minutes: 10,
      };
      expect(formatConditionDisplay(entry, "Astro if after Fixed", labels)).toEqual({
        label: "Astro if after Fixed",
        details: "Sunset +10min / 16:00",
      });
    });

    it("should work with German labels", () => {
      const deLabels: ConditionSummaryLabels = {
        sunrise: "Sonnenaufgang",
        sunset: "Sonnenuntergang",
        or: "oder",
        ifBefore: "wenn vor",
        ifAfter: "wenn nach",
      };
      const entry = {
        time: "16:00",
        condition: "fixed_if_before_astro" as const,
        astro_type: "sunset" as const,
        astro_offset_minutes: 10,
      };
      expect(formatConditionDisplay(entry, "Fest wenn vor Astro", deLabels)).toEqual({
        label: "Fest wenn vor Astro",
        details: "16:00 / Sonnenuntergang +10min",
      });
    });
  });

  describe("entryToBackend", () => {
    it("should include only required fields for a minimal entry", () => {
      const result = entryToBackend(makeEntry());
      expect(result).toEqual({
        weekdays: ["MONDAY"],
        time: "12:00",
        target_channels: ["1_1"],
        level: 1,
      });
    });

    it("should not include condition when fixed_time (default)", () => {
      const result = entryToBackend(makeEntry({ condition: "fixed_time" }));
      expect(result).not.toHaveProperty("condition");
    });

    it("should include condition when not fixed_time", () => {
      const result = entryToBackend(makeEntry({ condition: "astro", astro_type: "sunrise" }));
      expect(result.condition).toBe("astro");
    });

    it("should not include astro_type when null", () => {
      const result = entryToBackend(makeEntry({ astro_type: null }));
      expect(result).not.toHaveProperty("astro_type");
    });

    it("should include astro_type when set", () => {
      const result = entryToBackend(makeEntry({ condition: "astro", astro_type: "sunset" }));
      expect(result.astro_type).toBe("sunset");
    });

    it("should not include astro_offset_minutes when 0", () => {
      const result = entryToBackend(makeEntry({ astro_offset_minutes: 0 }));
      expect(result).not.toHaveProperty("astro_offset_minutes");
    });

    it("should include astro_offset_minutes when non-zero", () => {
      const result = entryToBackend(
        makeEntry({ condition: "astro", astro_type: "sunrise", astro_offset_minutes: 30 }),
      );
      expect(result.astro_offset_minutes).toBe(30);
    });

    it("should include negative astro_offset_minutes", () => {
      const result = entryToBackend(
        makeEntry({ condition: "astro", astro_type: "sunset", astro_offset_minutes: -45 }),
      );
      expect(result.astro_offset_minutes).toBe(-45);
    });

    it("should not include level_2 when null", () => {
      const result = entryToBackend(makeEntry({ level_2: null }));
      expect(result).not.toHaveProperty("level_2");
    });

    it("should include level_2 when set", () => {
      const result = entryToBackend(makeEntry({ level: 0.5, level_2: 0.8 }));
      expect(result.level_2).toBe(0.8);
    });

    it("should include level_2 when 0", () => {
      const result = entryToBackend(makeEntry({ level_2: 0 }));
      expect(result.level_2).toBe(0);
    });

    it("should not include duration when null", () => {
      const result = entryToBackend(makeEntry({ duration: null }));
      expect(result).not.toHaveProperty("duration");
    });

    it("should include duration when set", () => {
      const result = entryToBackend(makeEntry({ duration: "5min" }));
      expect(result.duration).toBe("5min");
    });

    it("should not include ramp_time when null", () => {
      const result = entryToBackend(makeEntry({ ramp_time: null }));
      expect(result).not.toHaveProperty("ramp_time");
    });

    it("should include ramp_time when set", () => {
      const result = entryToBackend(makeEntry({ ramp_time: "10s" }));
      expect(result.ramp_time).toBe("10s");
    });

    it("should include all optional fields when all are set", () => {
      const result = entryToBackend(
        makeEntry({
          condition: "earliest",
          astro_type: "sunrise",
          astro_offset_minutes: -60,
          level: 0.5,
          level_2: 0.3,
          duration: "4h",
          ramp_time: "500ms",
        }),
      );
      expect(result).toEqual({
        weekdays: ["MONDAY"],
        time: "12:00",
        target_channels: ["1_1"],
        level: 0.5,
        condition: "earliest",
        astro_type: "sunrise",
        astro_offset_minutes: -60,
        level_2: 0.3,
        duration: "4h",
        ramp_time: "500ms",
      });
    });
  });

  describe("scheduleToBackend", () => {
    it("should convert all entries", () => {
      const schedule: SimpleSchedule = {
        "1": makeEntry({ time: "06:00", level: 1 }),
        "2": makeEntry({ time: "22:00", level: 0, duration: "1min" }),
      };

      const result = scheduleToBackend(schedule);

      expect(Object.keys(result)).toEqual(["1", "2"]);
      expect(result["1"]).toEqual({
        weekdays: ["MONDAY"],
        time: "06:00",
        target_channels: ["1_1"],
        level: 1,
      });
      expect(result["2"]).toEqual({
        weekdays: ["MONDAY"],
        time: "22:00",
        target_channels: ["1_1"],
        level: 0,
        duration: "1min",
      });
    });

    it("should handle empty schedule", () => {
      expect(scheduleToBackend({})).toEqual({});
    });

    it("should strip null values from all entries", () => {
      const schedule: SimpleSchedule = {
        "1": makeEntry(),
        "2": makeEntry(),
      };

      const result = scheduleToBackend(schedule);

      for (const entry of Object.values(result)) {
        expect(entry).not.toHaveProperty("astro_type");
        expect(entry).not.toHaveProperty("level_2");
        expect(entry).not.toHaveProperty("duration");
        expect(entry).not.toHaveProperty("ramp_time");
      }
    });
  });

  describe("isValidScheduleEntity", () => {
    it("should return true for valid schedule entity", () => {
      const attrs: DeviceScheduleEntityAttributes = {
        schedule_type: "default",
      };
      expect(isValidScheduleEntity(attrs)).toBe(true);
    });

    it("should return true regardless of api version", () => {
      const attrs: DeviceScheduleEntityAttributes = {
        schedule_type: "default",
        schedule_api_version: "v2.0",
      };
      expect(isValidScheduleEntity(attrs)).toBe(true);
    });

    it("should return false when schedule_type is not default", () => {
      const attrs: DeviceScheduleEntityAttributes = {
        schedule_type: "climate",
      };
      expect(isValidScheduleEntity(attrs)).toBe(false);
    });

    it("should return false when schedule_type is missing", () => {
      const attrs: DeviceScheduleEntityAttributes = {};
      expect(isValidScheduleEntity(attrs)).toBe(false);
    });
  });
});
