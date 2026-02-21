import {
  parseWeekdaySchedule,
  parseSimpleWeekdaySchedule,
  timeBlocksToWeekdayData,
  timeBlocksToSimpleWeekdayData,
  convertToBackendFormat,
  calculateBaseTemperature,
  mergeConsecutiveBlocks,
  fillGapsWithBaseTemperature,
  sortBlocksChronologically,
  getScheduleApiVersion,
  getProfileFromPresetMode,
  getActiveProfileFromIndex,
} from "./converters";
import type { TimeBlock, WeekdayData, SimpleWeekdayData } from "../models/climate-types";

describe("converters", () => {
  describe("parseWeekdaySchedule", () => {
    it("should parse weekday schedule into time blocks", () => {
      const data: WeekdayData = {
        "1": { ENDTIME: "06:00", TEMPERATURE: 18 },
        "2": { ENDTIME: "22:00", TEMPERATURE: 21 },
        "3": { ENDTIME: "24:00", TEMPERATURE: 18 },
      };
      const blocks = parseWeekdaySchedule(data);
      expect(blocks).toHaveLength(3);
      expect(blocks[0]).toEqual({
        startTime: "00:00",
        startMinutes: 0,
        endTime: "06:00",
        endMinutes: 360,
        temperature: 18,
        slot: 1,
      });
      expect(blocks[1]).toEqual({
        startTime: "06:00",
        startMinutes: 360,
        endTime: "22:00",
        endMinutes: 1320,
        temperature: 21,
        slot: 2,
      });
      expect(blocks[2]).toEqual({
        startTime: "22:00",
        startMinutes: 1320,
        endTime: "24:00",
        endMinutes: 1440,
        temperature: 18,
        slot: 3,
      });
    });

    it("should handle empty slots correctly", () => {
      const data: WeekdayData = {
        "1": { ENDTIME: "08:00", TEMPERATURE: 20 },
        "2": { ENDTIME: "24:00", TEMPERATURE: 18 },
        "3": { ENDTIME: "24:00", TEMPERATURE: 16 },
      };
      const blocks = parseWeekdaySchedule(data);
      expect(blocks).toHaveLength(2);
    });

    it("should skip malformed slots gracefully", () => {
      const data: WeekdayData = {
        "1": { ENDTIME: "08:00", TEMPERATURE: 20 },
        "2": null as unknown as { ENDTIME: string; TEMPERATURE: number },
        "3": { ENDTIME: "24:00", TEMPERATURE: 18 },
      };
      const blocks = parseWeekdaySchedule(data);
      expect(blocks).toHaveLength(2);
    });
  });

  describe("timeBlocksToWeekdayData", () => {
    it("should convert time blocks to weekday data format", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "00:00",
          startMinutes: 0,
          endTime: "06:00",
          endMinutes: 360,
          temperature: 18,
          slot: 1,
        },
        {
          startTime: "06:00",
          startMinutes: 360,
          endTime: "22:00",
          endMinutes: 1320,
          temperature: 21,
          slot: 2,
        },
        {
          startTime: "22:00",
          startMinutes: 1320,
          endTime: "24:00",
          endMinutes: 1440,
          temperature: 18,
          slot: 3,
        },
      ];
      const weekdayData = timeBlocksToWeekdayData(blocks);
      expect(Object.keys(weekdayData)).toHaveLength(3);
      expect(weekdayData["1"]).toEqual({ ENDTIME: "06:00", TEMPERATURE: 18 });
      expect(weekdayData["2"]).toEqual({ ENDTIME: "22:00", TEMPERATURE: 21 });
      expect(weekdayData["3"]).toEqual({ ENDTIME: "24:00", TEMPERATURE: 18 });
    });

    it("should sort blocks by endMinutes in ascending order", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "06:00",
          startMinutes: 360,
          endTime: "22:00",
          endMinutes: 1320,
          temperature: 21,
          slot: 1,
        },
        {
          startTime: "22:00",
          startMinutes: 1320,
          endTime: "24:00",
          endMinutes: 1440,
          temperature: 18,
          slot: 2,
        },
        {
          startTime: "00:00",
          startMinutes: 0,
          endTime: "06:00",
          endMinutes: 360,
          temperature: 18,
          slot: 3,
        },
      ];
      const weekdayData = timeBlocksToWeekdayData(blocks);
      expect(weekdayData["1"]).toEqual({ ENDTIME: "06:00", TEMPERATURE: 18 });
      expect(weekdayData["2"]).toEqual({ ENDTIME: "22:00", TEMPERATURE: 21 });
      expect(weekdayData["3"]).toEqual({ ENDTIME: "24:00", TEMPERATURE: 18 });
    });

    it("should force last block to end at 24:00", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "00:00",
          startMinutes: 0,
          endTime: "06:00",
          endMinutes: 360,
          temperature: 18,
          slot: 1,
        },
        {
          startTime: "06:00",
          startMinutes: 360,
          endTime: "22:00",
          endMinutes: 1320,
          temperature: 21,
          slot: 2,
        },
      ];
      const weekdayData = timeBlocksToWeekdayData(blocks);
      expect(weekdayData["2"]).toEqual({ ENDTIME: "24:00", TEMPERATURE: 21 });
    });
  });

  describe("convertToBackendFormat", () => {
    it("should convert string keys to integer keys", () => {
      const data: WeekdayData = {
        "1": { ENDTIME: "06:00", TEMPERATURE: 18 },
        "2": { ENDTIME: "22:00", TEMPERATURE: 21 },
        "3": { ENDTIME: "24:00", TEMPERATURE: 18 },
      };
      const backendData = convertToBackendFormat(data);
      expect(backendData[1]).toEqual({ ENDTIME: "06:00", TEMPERATURE: 18 });
      expect(backendData[2]).toEqual({ ENDTIME: "22:00", TEMPERATURE: 21 });
      expect(backendData[3]).toEqual({ ENDTIME: "24:00", TEMPERATURE: 18 });
      expect(Object.keys(backendData).length).toBe(3);
    });

    it("should preserve ENDTIME and TEMPERATURE values", () => {
      const data: WeekdayData = {
        "1": { ENDTIME: "09:30", TEMPERATURE: 22.5 },
        "2": { ENDTIME: "17:45", TEMPERATURE: 19.0 },
        "3": { ENDTIME: "24:00", TEMPERATURE: 16.5 },
      };
      const backendData = convertToBackendFormat(data);
      expect(backendData[1].ENDTIME).toBe("09:30");
      expect(backendData[1].TEMPERATURE).toBe(22.5);
    });
  });

  describe("parseSimpleWeekdaySchedule", () => {
    it("should parse simple weekday schedule into time blocks", () => {
      const data: SimpleWeekdayData = {
        base_temperature: 20.0,
        periods: [
          { starttime: "06:00", endtime: "08:00", temperature: 22.0 },
          { starttime: "18:00", endtime: "22:00", temperature: 21.5 },
        ],
      };
      const { blocks, baseTemperature } = parseSimpleWeekdaySchedule(data);
      expect(baseTemperature).toBe(20.0);
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        startTime: "06:00",
        startMinutes: 360,
        endTime: "08:00",
        endMinutes: 480,
        temperature: 22.0,
        slot: 1,
      });
    });

    it("should handle empty periods array", () => {
      const data: SimpleWeekdayData = { base_temperature: 19.5, periods: [] };
      const { blocks, baseTemperature } = parseSimpleWeekdaySchedule(data);
      expect(baseTemperature).toBe(19.5);
      expect(blocks).toHaveLength(0);
    });

    it("should sort periods by start time", () => {
      const data: SimpleWeekdayData = {
        base_temperature: 20.0,
        periods: [
          { starttime: "18:00", endtime: "22:00", temperature: 21.5 },
          { starttime: "06:00", endtime: "08:00", temperature: 22.0 },
        ],
      };
      const { blocks } = parseSimpleWeekdaySchedule(data);
      expect(blocks[0].startTime).toBe("06:00");
      expect(blocks[1].startTime).toBe("18:00");
    });
  });

  describe("timeBlocksToSimpleWeekdayData", () => {
    it("should convert time blocks to simple weekday data", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "06:00",
          startMinutes: 360,
          endTime: "08:00",
          endMinutes: 480,
          temperature: 22.0,
          slot: 1,
        },
        {
          startTime: "18:00",
          startMinutes: 1080,
          endTime: "22:00",
          endMinutes: 1320,
          temperature: 21.5,
          slot: 2,
        },
      ];
      const result = timeBlocksToSimpleWeekdayData(blocks, 20.0);
      expect(result.base_temperature).toBe(20.0);
      expect(result.periods).toHaveLength(2);
      expect(result.periods[0]).toEqual({
        starttime: "06:00",
        endtime: "08:00",
        temperature: 22.0,
      });
      expect(result.periods[1]).toEqual({
        starttime: "18:00",
        endtime: "22:00",
        temperature: 21.5,
      });
    });

    it("should handle empty blocks", () => {
      const result = timeBlocksToSimpleWeekdayData([], 20.0);
      expect(result.base_temperature).toBe(20.0);
      expect(result.periods).toHaveLength(0);
    });
  });

  describe("calculateBaseTemperature", () => {
    it("should return default temperature for empty blocks", () => {
      expect(calculateBaseTemperature([])).toBe(20.0);
    });

    it("should return temperature with most duration", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "06:00",
          startMinutes: 360,
          endTime: "08:00",
          endMinutes: 480,
          temperature: 22.0,
          slot: 1,
        },
        {
          startTime: "08:00",
          startMinutes: 480,
          endTime: "18:00",
          endMinutes: 1080,
          temperature: 20.0,
          slot: 2,
        },
        {
          startTime: "18:00",
          startMinutes: 1080,
          endTime: "22:00",
          endMinutes: 1320,
          temperature: 22.0,
          slot: 3,
        },
      ];
      // 22.0°C = 2h + 4h = 6h, 20.0°C = 10h → base = 20.0
      expect(calculateBaseTemperature(blocks)).toBe(20.0);
    });
  });

  describe("mergeConsecutiveBlocks", () => {
    it("should merge consecutive blocks with same temperature", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "06:00",
          startMinutes: 360,
          endTime: "08:00",
          endMinutes: 480,
          temperature: 22.0,
          slot: 1,
        },
        {
          startTime: "08:00",
          startMinutes: 480,
          endTime: "10:00",
          endMinutes: 600,
          temperature: 22.0,
          slot: 2,
        },
        {
          startTime: "10:00",
          startMinutes: 600,
          endTime: "18:00",
          endMinutes: 1080,
          temperature: 20.0,
          slot: 3,
        },
      ];
      const merged = mergeConsecutiveBlocks(blocks);
      expect(merged).toHaveLength(2);
      expect(merged[0].startTime).toBe("06:00");
      expect(merged[0].endTime).toBe("10:00");
      expect(merged[0].temperature).toBe(22.0);
    });

    it("should not merge blocks with different temperatures", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "06:00",
          startMinutes: 360,
          endTime: "08:00",
          endMinutes: 480,
          temperature: 22.0,
          slot: 1,
        },
        {
          startTime: "08:00",
          startMinutes: 480,
          endTime: "10:00",
          endMinutes: 600,
          temperature: 20.0,
          slot: 2,
        },
      ];
      expect(mergeConsecutiveBlocks(blocks)).toHaveLength(2);
    });
  });

  describe("sortBlocksChronologically", () => {
    it("should sort blocks by startMinutes", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "18:00",
          startMinutes: 1080,
          endTime: "22:00",
          endMinutes: 1320,
          temperature: 22.0,
          slot: 2,
        },
        {
          startTime: "06:00",
          startMinutes: 360,
          endTime: "08:00",
          endMinutes: 480,
          temperature: 20.0,
          slot: 1,
        },
      ];
      const sorted = sortBlocksChronologically(blocks);
      expect(sorted[0].startTime).toBe("06:00");
      expect(sorted[1].startTime).toBe("18:00");
    });
  });

  describe("fillGapsWithBaseTemperature", () => {
    it("should fill gaps with base temperature", () => {
      const blocks: TimeBlock[] = [
        {
          startTime: "06:00",
          startMinutes: 360,
          endTime: "08:00",
          endMinutes: 480,
          temperature: 22.0,
          slot: 1,
        },
        {
          startTime: "18:00",
          startMinutes: 1080,
          endTime: "22:00",
          endMinutes: 1320,
          temperature: 21.5,
          slot: 2,
        },
      ];
      const filled = fillGapsWithBaseTemperature(blocks, 20.0);
      // Should have: 00:00-06:00 (base), 06:00-08:00, 08:00-18:00 (base), 18:00-22:00, 22:00-24:00 (base)
      expect(filled).toHaveLength(5);
      expect(filled[0].temperature).toBe(20.0);
      expect(filled[0].startTime).toBe("00:00");
      expect(filled[0].endTime).toBe("06:00");
    });

    it("should handle empty blocks", () => {
      const filled = fillGapsWithBaseTemperature([], 20.0);
      expect(filled).toHaveLength(1);
      expect(filled[0].temperature).toBe(20.0);
      expect(filled[0].startTime).toBe("00:00");
      expect(filled[0].endTime).toBe("24:00");
    });
  });

  describe("getScheduleApiVersion", () => {
    it("should return v2 for v2.0 string", () => {
      expect(getScheduleApiVersion("v2.0")).toBe("v2");
    });

    it("should return v1 for any other string", () => {
      expect(getScheduleApiVersion("v1.0")).toBe("v1");
      expect(getScheduleApiVersion(undefined)).toBe("v1");
      expect(getScheduleApiVersion("")).toBe("v1");
    });
  });

  describe("getProfileFromPresetMode", () => {
    it("should extract profile from week_program format", () => {
      expect(getProfileFromPresetMode("week_program_1")).toBe("P1");
      expect(getProfileFromPresetMode("week_program_2")).toBe("P2");
    });

    it("should extract profile from week_profile format", () => {
      expect(getProfileFromPresetMode("week_profile_1")).toBe("P1");
    });

    it("should return undefined for non-matching preset modes", () => {
      expect(getProfileFromPresetMode("manual")).toBeUndefined();
      expect(getProfileFromPresetMode(undefined)).toBeUndefined();
    });
  });

  describe("getActiveProfileFromIndex", () => {
    it("should convert 1-based index to profile string", () => {
      expect(getActiveProfileFromIndex(1)).toBe("P1");
      expect(getActiveProfileFromIndex(2)).toBe("P2");
      expect(getActiveProfileFromIndex(3)).toBe("P3");
    });

    it("should return undefined for null/undefined", () => {
      expect(getActiveProfileFromIndex(null)).toBeUndefined();
      expect(getActiveProfileFromIndex(undefined)).toBeUndefined();
    });
  });
});
