import {
  validateTimeBlocks,
  validateWeekdayData,
  validateSimpleWeekdayData,
  validateProfileData,
  validateSimpleProfileData,
  validateEntry,
} from "./validation";
import type { ClimateValidationMessage, ClimateValidationMessageKey } from "./validation";
import type { TimeBlock, WeekdayData, SimpleWeekdayData } from "../models/climate-types";
import type { SimpleScheduleEntry } from "../models/device-types";

const findMessage = (
  messages: ClimateValidationMessage[],
  key: ClimateValidationMessageKey,
): ClimateValidationMessage | undefined => messages.find((m) => m.key === key);

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
    ...overrides,
  };
}

describe("validation", () => {
  describe("validateTimeBlocks", () => {
    it("should return no warnings for valid blocks", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "00:00",
          startMinutes: 0,
          endTime: "08:00",
          endMinutes: 480,
          temperature: 18.0,
          slot: 1,
        },
        {
          startTime: "08:00",
          startMinutes: 480,
          endTime: "22:00",
          endMinutes: 1320,
          temperature: 21.0,
          slot: 2,
        },
        {
          startTime: "22:00",
          startMinutes: 1320,
          endTime: "24:00",
          endMinutes: 1440,
          temperature: 18.0,
          slot: 3,
        },
      ];
      expect(validateTimeBlocks(blocks)).toHaveLength(0);
    });

    it("should warn when block has backwards time", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "12:00",
          startMinutes: 720,
          endTime: "10:00",
          endMinutes: 600,
          temperature: 20.0,
          slot: 1,
        },
      ];
      const warnings = validateTimeBlocks(blocks);
      expect(findMessage(warnings, "blockEndBeforeStart")?.params?.block).toBe("1");
    });

    it("should warn when block has zero duration", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "08:00",
          startMinutes: 480,
          endTime: "08:00",
          endMinutes: 480,
          temperature: 20.0,
          slot: 1,
        },
        {
          startTime: "08:00",
          startMinutes: 480,
          endTime: "24:00",
          endMinutes: 1440,
          temperature: 21.0,
          slot: 2,
        },
      ];
      const warnings = validateTimeBlocks(blocks);
      expect(findMessage(warnings, "blockZeroDuration")?.params?.block).toBe("1");
    });

    it("should warn when temperature is out of range", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "00:00",
          startMinutes: 0,
          endTime: "12:00",
          endMinutes: 720,
          temperature: 3.0,
          slot: 1,
        },
        {
          startTime: "12:00",
          startMinutes: 720,
          endTime: "24:00",
          endMinutes: 1440,
          temperature: 35.0,
          slot: 2,
        },
      ];
      const warnings = validateTimeBlocks(blocks);
      expect(warnings.filter((w) => w.key === "temperatureOutOfRange")).toHaveLength(2);
    });

    it("should allow empty blocks array", () => {
      expect(validateTimeBlocks([])).toHaveLength(0);
    });

    it("should warn when time values are invalid", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "00:00",
          startMinutes: -10,
          endTime: "12:00",
          endMinutes: 720,
          temperature: 20.0,
          slot: 1,
        },
        {
          startTime: "12:00",
          startMinutes: 720,
          endTime: "25:00",
          endMinutes: 1500,
          temperature: 20.0,
          slot: 2,
        },
      ];
      const warnings = validateTimeBlocks(blocks);
      expect(findMessage(warnings, "invalidStartTime")?.params?.block).toBe("1");
      expect(findMessage(warnings, "invalidEndTime")?.params?.block).toBe("2");
    });

    it("should use custom min/max temperature range", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "00:00",
          startMinutes: 0,
          endTime: "12:00",
          endMinutes: 720,
          temperature: 12.0,
          slot: 1,
        },
        {
          startTime: "12:00",
          startMinutes: 720,
          endTime: "24:00",
          endMinutes: 1440,
          temperature: 25.0,
          slot: 2,
        },
      ];
      expect(validateTimeBlocks(blocks, 10, 28)).toHaveLength(0);
    });

    it("should warn when temperature is below custom min", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "00:00",
          startMinutes: 0,
          endTime: "24:00",
          endMinutes: 1440,
          temperature: 8.0,
          slot: 1,
        },
      ];
      const warnings = validateTimeBlocks(blocks, 10, 28);
      expect(findMessage(warnings, "temperatureOutOfRange")).toBeDefined();
    });

    it("should accept temperature at custom boundaries", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "00:00",
          startMinutes: 0,
          endTime: "24:00",
          endMinutes: 1440,
          temperature: 10.0,
          slot: 1,
        },
      ];
      expect(
        findMessage(validateTimeBlocks(blocks, 10, 28), "temperatureOutOfRange"),
      ).toBeUndefined();

      const blocks2: TimeBlock[] = [
        {
          startTime: "00:00",
          startMinutes: 0,
          endTime: "24:00",
          endMinutes: 1440,
          temperature: 28.0,
          slot: 1,
        },
      ];
      expect(
        findMessage(validateTimeBlocks(blocks2, 10, 28), "temperatureOutOfRange"),
      ).toBeUndefined();
    });
  });

  describe("validateWeekdayData", () => {
    it("should validate correct weekday data", () => {
      const data: WeekdayData = {
        "1": { ENDTIME: "06:00", TEMPERATURE: 18 },
        "2": { ENDTIME: "22:00", TEMPERATURE: 21 },
        "3": { ENDTIME: "24:00", TEMPERATURE: 18 },
      };
      expect(validateWeekdayData(data)).toBeNull();
    });

    it("should accept single slot data", () => {
      expect(validateWeekdayData({ "1": { ENDTIME: "24:00", TEMPERATURE: 18 } })).toBeNull();
    });

    it("should reject backwards time", () => {
      const data: WeekdayData = {
        "1": { ENDTIME: "12:00", TEMPERATURE: 18 },
        "2": { ENDTIME: "08:00", TEMPERATURE: 21 },
        "3": { ENDTIME: "24:00", TEMPERATURE: 18 },
      };
      const error = validateWeekdayData(data);
      expect(error?.key).toBe("slotTimeBackwards");
    });

    it("should reject when last slot does not end at 24:00", () => {
      const data: WeekdayData = {
        "1": { ENDTIME: "06:00", TEMPERATURE: 18 },
        "2": { ENDTIME: "23:00", TEMPERATURE: 18 },
      };
      expect(validateWeekdayData(data)?.key).toBe("lastSlotMustEnd");
    });

    it("should reject slot with missing ENDTIME", () => {
      const data: WeekdayData = {
        "1": { ENDTIME: "06:00", TEMPERATURE: 18 },
        "2": { ENDTIME: "", TEMPERATURE: 21 },
        "3": { ENDTIME: "24:00", TEMPERATURE: 18 },
      };
      const error = validateWeekdayData(data);
      expect(error?.key).toBe("slotMissingValues");
    });

    it("should reject slot with time exceeding 24:00", () => {
      const data: WeekdayData = {
        "1": { ENDTIME: "06:00", TEMPERATURE: 18 },
        "2": { ENDTIME: "25:00", TEMPERATURE: 21 },
        "3": { ENDTIME: "24:00", TEMPERATURE: 18 },
      };
      expect(validateWeekdayData(data)?.key).toBe("slotTimeExceedsDay");
    });
  });

  describe("validateProfileData", () => {
    const makeWeekday = () => ({
      "1": { ENDTIME: "24:00", TEMPERATURE: 20 },
    });

    const makeFullProfile = () => ({
      MONDAY: makeWeekday(),
      TUESDAY: makeWeekday(),
      WEDNESDAY: makeWeekday(),
      THURSDAY: makeWeekday(),
      FRIDAY: makeWeekday(),
      SATURDAY: makeWeekday(),
      SUNDAY: makeWeekday(),
    });

    it("should validate correct profile data", () => {
      expect(validateProfileData(makeFullProfile())).toBeNull();
    });

    it("should reject non-object data", () => {
      expect(validateProfileData(null)?.key).toBe("scheduleMustBeObject");
      expect(validateProfileData(undefined)?.key).toBe("scheduleMustBeObject");
      expect(validateProfileData("string")?.key).toBe("scheduleMustBeObject");
      expect(validateProfileData(123)?.key).toBe("scheduleMustBeObject");
    });

    it("should reject missing weekdays", () => {
      const error = validateProfileData({ MONDAY: makeWeekday() });
      expect(error?.key).toBe("missingWeekday");
    });

    it("should reject invalid weekday data structure", () => {
      const profile = makeFullProfile();
      (profile as Record<string, unknown>).MONDAY = "invalid";
      const error = validateProfileData(profile);
      expect(error?.key).toBe("invalidWeekdayData");
    });
  });

  describe("validateSimpleWeekdayData", () => {
    it("should validate correct simple weekday data", () => {
      const data: SimpleWeekdayData = {
        base_temperature: 20.0,
        periods: [
          { starttime: "06:00", endtime: "08:00", temperature: 22.0 },
          { starttime: "18:00", endtime: "22:00", temperature: 21.0 },
        ],
      };
      expect(validateSimpleWeekdayData(data)).toBeNull();
    });

    it("should validate empty periods", () => {
      const data: SimpleWeekdayData = { base_temperature: 20.0, periods: [] };
      expect(validateSimpleWeekdayData(data)).toBeNull();
    });
  });

  describe("validateSimpleProfileData", () => {
    const makeSimpleWeekday = (): SimpleWeekdayData => ({
      base_temperature: 20.0,
      periods: [{ starttime: "06:00", endtime: "22:00", temperature: 21.0 }],
    });

    const makeFullSimpleProfile = () => ({
      MONDAY: makeSimpleWeekday(),
      TUESDAY: makeSimpleWeekday(),
      WEDNESDAY: makeSimpleWeekday(),
      THURSDAY: makeSimpleWeekday(),
      FRIDAY: makeSimpleWeekday(),
      SATURDAY: makeSimpleWeekday(),
      SUNDAY: makeSimpleWeekday(),
    });

    it("should validate correct simple profile data", () => {
      expect(validateSimpleProfileData(makeFullSimpleProfile())).toBeNull();
    });

    it("should reject non-object data", () => {
      expect(validateSimpleProfileData(null)?.key).toBe("scheduleMustBeObject");
      expect(validateSimpleProfileData(undefined)?.key).toBe("scheduleMustBeObject");
    });

    it("should reject missing weekdays", () => {
      const error = validateSimpleProfileData({ MONDAY: makeSimpleWeekday() });
      expect(error?.key).toBe("missingWeekday");
    });
  });

  describe("validateEntry", () => {
    it("should validate correct entry", () => {
      expect(validateEntry(makeEntry(), "switch")).toHaveLength(0);
    });

    it("should detect invalid time", () => {
      const errors = validateEntry(makeEntry({ time: "25:00" }));
      expect(errors.some((e) => e.field === "time")).toBe(true);
    });

    it("should detect missing weekdays", () => {
      const errors = validateEntry(makeEntry({ weekdays: [] }));
      expect(errors.some((e) => e.field === "weekdays")).toBe(true);
    });

    it("should allow empty target channels", () => {
      const errors = validateEntry(makeEntry({ target_channels: [] }));
      expect(errors.some((e) => e.field === "target_channels")).toBe(false);
    });

    it("should detect invalid switch level", () => {
      const errors = validateEntry(makeEntry({ level: 0.5 }), "switch");
      expect(errors.some((e) => e.field === "level")).toBe(true);
    });

    it("should accept valid switch levels (0 and 1)", () => {
      expect(validateEntry(makeEntry({ level: 0 }), "switch")).toHaveLength(0);
      expect(validateEntry(makeEntry({ level: 1 }), "switch")).toHaveLength(0);
    });

    it("should detect level out of range for percentage domains", () => {
      const errors = validateEntry(makeEntry({ level: 1.5 }), "light");
      expect(errors.some((e) => e.field === "level")).toBe(true);
    });

    it("should detect invalid cover level_2", () => {
      const errors = validateEntry(makeEntry({ level: 0.5, level_2: 1.5 }), "cover");
      expect(errors.some((e) => e.field === "level_2")).toBe(true);
    });

    it("should detect invalid astro offset", () => {
      const errors = validateEntry(
        makeEntry({ condition: "astro", astro_type: "sunrise", astro_offset_minutes: 800 }),
      );
      expect(errors.some((e) => e.field === "astro_offset_minutes")).toBe(true);
    });

    it("should not validate astro offset for fixed_time", () => {
      const errors = validateEntry(
        makeEntry({ condition: "fixed_time", astro_offset_minutes: 800 }),
      );
      expect(errors.some((e) => e.field === "astro_offset_minutes")).toBe(false);
    });

    it("should detect invalid duration format", () => {
      const errors = validateEntry(makeEntry({ duration: "invalid" }));
      expect(errors.some((e) => e.field === "duration")).toBe(true);
    });

    it("should accept null duration", () => {
      const errors = validateEntry(makeEntry({ duration: null }));
      expect(errors.some((e) => e.field === "duration")).toBe(false);
    });

    it("should detect invalid ramp_time format", () => {
      const errors = validateEntry(makeEntry({ ramp_time: "invalid" }));
      expect(errors.some((e) => e.field === "ramp_time")).toBe(true);
    });
  });
});
