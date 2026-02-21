import {
  timeToMinutes,
  minutesToTime,
  roundTimeToQuarter,
  formatTime,
  parseTime,
  isValidTime,
  formatTimeFromParts,
} from "./time";

describe("time utils", () => {
  describe("timeToMinutes", () => {
    it("should convert time string to minutes", () => {
      expect(timeToMinutes("00:00")).toBe(0);
      expect(timeToMinutes("01:00")).toBe(60);
      expect(timeToMinutes("12:30")).toBe(750);
      expect(timeToMinutes("23:59")).toBe(1439);
      expect(timeToMinutes("24:00")).toBe(1440);
    });
  });

  describe("minutesToTime", () => {
    it("should convert minutes to time string", () => {
      expect(minutesToTime(0)).toBe("00:00");
      expect(minutesToTime(60)).toBe("01:00");
      expect(minutesToTime(750)).toBe("12:30");
      expect(minutesToTime(1439)).toBe("23:59");
      expect(minutesToTime(1440)).toBe("24:00");
    });
  });

  describe("formatTime", () => {
    it("should return time unchanged for 24h format", () => {
      expect(formatTime("00:00", "24")).toBe("00:00");
      expect(formatTime("12:30", "24")).toBe("12:30");
      expect(formatTime("23:59", "24")).toBe("23:59");
      expect(formatTime("24:00", "24")).toBe("24:00");
    });

    it("should convert to 12h format correctly", () => {
      expect(formatTime("00:00", "12")).toBe("12:00 AM");
      expect(formatTime("00:30", "12")).toBe("12:30 AM");
      expect(formatTime("01:00", "12")).toBe("1:00 AM");
      expect(formatTime("06:15", "12")).toBe("6:15 AM");
      expect(formatTime("11:59", "12")).toBe("11:59 AM");
      expect(formatTime("12:00", "12")).toBe("12:00 PM");
      expect(formatTime("12:30", "12")).toBe("12:30 PM");
      expect(formatTime("13:00", "12")).toBe("1:00 PM");
      expect(formatTime("18:45", "12")).toBe("6:45 PM");
      expect(formatTime("23:59", "12")).toBe("11:59 PM");
      expect(formatTime("24:00", "12")).toBe("12:00 AM");
    });

    it("should default to 24h format", () => {
      expect(formatTime("14:30")).toBe("14:30");
    });
  });

  describe("roundTimeToQuarter", () => {
    it("should round time to nearest 15 minutes", () => {
      expect(roundTimeToQuarter(0)).toBe(0);
      expect(roundTimeToQuarter(7)).toBe(0);
      expect(roundTimeToQuarter(8)).toBe(15);
      expect(roundTimeToQuarter(22)).toBe(15);
      expect(roundTimeToQuarter(23)).toBe(30);
      expect(roundTimeToQuarter(37)).toBe(30);
      expect(roundTimeToQuarter(38)).toBe(45);
      expect(roundTimeToQuarter(53)).toBe(60);
    });
  });

  describe("parseTime", () => {
    it("should parse valid time strings", () => {
      expect(parseTime("00:00")).toEqual({ hour: 0, minute: 0 });
      expect(parseTime("09:05")).toEqual({ hour: 9, minute: 5 });
      expect(parseTime("12:30")).toEqual({ hour: 12, minute: 30 });
      expect(parseTime("23:59")).toEqual({ hour: 23, minute: 59 });
    });

    it("should throw on invalid time format", () => {
      expect(() => parseTime("invalid")).toThrow("Invalid time format");
      expect(() => parseTime("25:00")).toThrow("Invalid time values");
      expect(() => parseTime("12:60")).toThrow("Invalid time values");
    });
  });

  describe("isValidTime", () => {
    it("should return true for valid times", () => {
      expect(isValidTime("00:00")).toBe(true);
      expect(isValidTime("12:30")).toBe(true);
      expect(isValidTime("23:59")).toBe(true);
    });

    it("should return false for invalid times", () => {
      expect(isValidTime("invalid")).toBe(false);
      expect(isValidTime("25:00")).toBe(false);
      expect(isValidTime("12:60")).toBe(false);
    });
  });

  describe("formatTimeFromParts", () => {
    it("should format hour and minute to time string", () => {
      expect(formatTimeFromParts(0, 0)).toBe("00:00");
      expect(formatTimeFromParts(9, 5)).toBe("09:05");
      expect(formatTimeFromParts(12, 30)).toBe("12:30");
      expect(formatTimeFromParts(23, 59)).toBe("23:59");
    });
  });
});
