import { getDeviceAddress } from "./device-address";

describe("device-address", () => {
  describe("getDeviceAddress", () => {
    it("should extract device address from valid format", () => {
      expect(getDeviceAddress("000C9709AEF157:1")).toBe("000C9709AEF157");
      expect(getDeviceAddress("HED56782988:3")).toBe("HED56782988");
    });

    it("should return undefined for invalid formats", () => {
      expect(getDeviceAddress(undefined)).toBeUndefined();
      expect(getDeviceAddress("")).toBeUndefined();
      expect(getDeviceAddress("no-colon")).toBeUndefined();
      expect(getDeviceAddress("a:b:c")).toBeUndefined();
    });
  });
});
