import { getTemperatureColor, getTemperatureGradient, formatTemperature } from "./colors";

describe("color utils", () => {
  describe("getTemperatureColor", () => {
    it("should return correct colors for temperature ranges", () => {
      expect(getTemperatureColor(5)).toBe("#2b9af9");
      expect(getTemperatureColor(10)).toBe("#40c4ff");
      expect(getTemperatureColor(14)).toBe("#26c6da");
      expect(getTemperatureColor(17)).toBe("#66bb6a");
      expect(getTemperatureColor(19)).toBe("#9ccc65");
      expect(getTemperatureColor(21)).toBe("#ffb74d");
      expect(getTemperatureColor(23)).toBe("#ff8100");
      expect(getTemperatureColor(26)).toBe("#f4511e");
    });
  });

  describe("getTemperatureGradient", () => {
    it("should return solid color when no adjacent blocks exist", () => {
      expect(getTemperatureGradient(20, null, null)).toBe("#9ccc65");
      expect(getTemperatureGradient(15, null, null)).toBe("#26c6da");
    });

    it("should create gradient from previous to current when only previous exists", () => {
      const result = getTemperatureGradient(20, 15, null);
      expect(result).toContain("linear-gradient");
      expect(result).toContain("to bottom");
      expect(result).toContain("#26c6da");
      expect(result).toContain("#9ccc65");
    });

    it("should create gradient from current to next when only next exists", () => {
      const result = getTemperatureGradient(20, null, 26);
      expect(result).toContain("linear-gradient");
      expect(result).toContain("to bottom");
      expect(result).toContain("#9ccc65");
      expect(result).toContain("#f4511e");
    });

    it("should create three-color gradient when both adjacent blocks exist", () => {
      const result = getTemperatureGradient(20, 15, 26);
      expect(result).toContain("linear-gradient");
      expect(result).toContain("#26c6da");
      expect(result).toContain("#9ccc65");
      expect(result).toContain("50%");
      expect(result).toContain("#f4511e");
    });

    it("should handle same temperature for all blocks", () => {
      const result = getTemperatureGradient(20, 20, 20);
      expect(result).toContain("linear-gradient");
      expect(result).toContain("#9ccc65");
    });

    it("should handle very low temperature", () => {
      expect(getTemperatureGradient(5, null, null)).toBe("#2b9af9");
    });

    it("should handle very high temperature", () => {
      expect(getTemperatureGradient(30, null, null)).toBe("#f4511e");
    });
  });

  describe("formatTemperature", () => {
    it("should format temperature with default unit", () => {
      expect(formatTemperature(20.5)).toBe("20.5°C");
      expect(formatTemperature(22.3)).toBe("22.3°C");
    });

    it("should format temperature with custom unit", () => {
      expect(formatTemperature(18.0, "°F")).toBe("18.0°F");
    });
  });
});
