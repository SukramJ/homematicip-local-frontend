import { beforeEach, describe, expect, it } from "vitest";

import {
  click,
  createHass,
  deviceInfo,
  deepQuery,
  deepQueryAll,
  eventSpy,
  mount,
  query,
  queryAll,
  setValue,
  textOf,
  update,
  type FakeHass,
} from "@hmip/test-utils";

import "./device-list";
import type { HmDeviceList } from "./device-list";

const LIST_DEVICES = "homematicip_local/config/list_devices";

const devices = [
  deviceInfo({
    address: "VCU0000001",
    name: "Living Room Switch",
    model: "HmIP-BSM",
    interface_id: "ccu-HmIP-RF",
  }),
  deviceInfo({
    address: "VCU0000002",
    name: "Bedroom Thermostat",
    model: "HmIP-eTRV-2",
    interface_id: "ccu-HmIP-RF",
  }),
  deviceInfo({
    address: "MEQ0000003",
    name: "Hallway Dimmer",
    model: "HM-LC-Dim1T-FM",
    interface_id: "ccu-BidCos-RF",
  }),
];

/** Mount the list already wired to a `hass` that answers with `devices`. */
async function mountList(
  responses: Record<string, unknown> = { [LIST_DEVICES]: { devices } },
): Promise<{ list: HmDeviceList; hass: FakeHass }> {
  const hass = createHass({ ws: responses });
  const list = await mount<HmDeviceList>("hm-device-list", { hass, entryId: "entry-1" });
  return { list, hass };
}

/** The device names currently rendered, in render order. */
const renderedNames = (list: HmDeviceList): string[] =>
  deepQueryAll(list, ".device-name").map((element) => element.textContent?.trim() ?? "");

describe("hm-device-list", () => {
  it("loads the devices of the config entry once an entry is set", async () => {
    const { hass } = await mountList();

    expect(hass.lastSent(LIST_DEVICES)).toEqual({ type: LIST_DEVICES, entry_id: "entry-1" });
  });

  it("loads nothing while no entry is selected", async () => {
    const hass = createHass({ ws: { [LIST_DEVICES]: { devices } } });
    const list = await mount<HmDeviceList>("hm-device-list", { hass });

    expect(hass.sentOf(LIST_DEVICES)).toHaveLength(0);
    expect(textOf(list)).toContain("Please select a CCU to view devices.");
  });

  it("groups the devices by interface, dropping the instance prefix", async () => {
    const { list } = await mountList();

    expect(deepQueryAll(list, "hm-interface-header").map((header) => textOf(header))).toEqual([
      "HmIP-RF",
      "BidCos-RF",
    ]);
  });

  it("renders one row per device", async () => {
    const { list } = await mountList();

    expect(renderedNames(list)).toHaveLength(3);
  });

  it("sorts by name ascending by default", async () => {
    const { list } = await mountList();

    expect(renderedNames(list)).toEqual([
      "Bedroom Thermostat",
      "Living Room Switch",
      "Hallway Dimmer",
    ]);
  });

  it("reverses the order when the active sort column is clicked again", async () => {
    const { list } = await mountList();
    const sortByName = queryAll(list, ".sort-button")[0];

    await click(sortByName, list);

    expect(renderedNames(list)).toEqual([
      "Living Room Switch",
      "Bedroom Thermostat",
      "Hallway Dimmer",
    ]);
  });

  it("switches to another column ascending", async () => {
    const { list } = await mountList();
    const sortByAddress = queryAll(list, ".sort-button")[1];

    await click(sortByAddress, list);

    // MEQ0000003 sorts first, so its interface group is emitted first.
    expect(renderedNames(list)).toEqual([
      "Hallway Dimmer",
      "Living Room Switch",
      "Bedroom Thermostat",
    ]);
  });

  describe("search", () => {
    let list: HmDeviceList;

    beforeEach(async () => {
      ({ list } = await mountList());
    });

    it("matches the device name case-insensitively", async () => {
      setValue(query(list, "ha-input")!, "bedroom");
      await update(list, {});

      expect(renderedNames(list)).toEqual(["Bedroom Thermostat"]);
    });

    it("matches the address", async () => {
      setValue(query(list, "ha-input")!, "MEQ");
      await update(list, {});

      expect(renderedNames(list)).toEqual(["Hallway Dimmer"]);
    });

    it("matches the model", async () => {
      setValue(query(list, "ha-input")!, "eTRV");
      await update(list, {});

      expect(renderedNames(list)).toEqual(["Bedroom Thermostat"]);
    });

    it("shows the empty state when nothing matches", async () => {
      setValue(query(list, "ha-input")!, "no-such-device");
      await update(list, {});

      expect(renderedNames(list)).toEqual([]);
      expect(textOf(list)).toContain("No configurable devices found.");
    });
  });

  it("bubbles the device selection out of the row", async () => {
    const { list } = await mountList();
    const selections = eventSpy<{ device: string; interfaceId: string }>(list, "device-selected");

    await click(deepQuery(list, ".device-card")!, list);

    expect(selections).toHaveLength(1);
    expect(selections[0].detail).toEqual({
      device: "VCU0000002",
      interfaceId: "ccu-HmIP-RF",
    });
  });

  it("shows the empty state when the entry has no devices", async () => {
    const { list } = await mountList({ [LIST_DEVICES]: { devices: [] } });

    expect(textOf(list)).toContain("No configurable devices found.");
  });

  describe("when the backend fails", () => {
    it("surfaces the error message", async () => {
      const hass = createHass();
      hass.failWith(LIST_DEVICES, new Error("central not connected"));
      const list = await mount<HmDeviceList>("hm-device-list", { hass, entryId: "entry-1" });

      expect(textOf(list)).toContain("central not connected");
    });

    it("offers a retry that queries again", async () => {
      const hass = createHass();
      hass.failWith(LIST_DEVICES, new Error("central not connected"));
      const list = await mount<HmDeviceList>("hm-device-list", { hass, entryId: "entry-1" });

      hass.respond(LIST_DEVICES, { devices });
      await click(query(list, "ha-button")!, list);

      expect(hass.sentOf(LIST_DEVICES)).toHaveLength(2);
      expect(renderedNames(list)).toHaveLength(3);
    });
  });
});
