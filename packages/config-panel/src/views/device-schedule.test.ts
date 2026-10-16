import { describe, expect, it } from "vitest";

import { createHass, deepQuery, mount, optionsOf } from "@hmip/test-utils";

import "./device-schedule";
import type { HmDeviceSchedule } from "./device-schedule";
import type { ClimateScheduleData, ScheduleDeviceInfo } from "../types";

const LIST_SCHEDULE_DEVICES = "homematicip_local/config/list_schedule_devices";
const GET_CLIMATE_SCHEDULE = "homematicip_local/config/get_climate_schedule";

const heatingGroup: ScheduleDeviceInfo = {
  address: "INT0000001",
  name: "Wohnzimmer",
  model: "HmIP-HEATING",
  interface_id: "ccu-HmIP-RF",
  channel_address: "INT0000001:1",
  schedule_type: "climate",
};

function climateSchedule(overrides: Partial<ClimateScheduleData> = {}): ClimateScheduleData {
  return {
    // A weekday key lets the first load use this response without a second call.
    schedule_data: { MONDAY: { base_temperature: 18, periods: [] } },
    available_profiles: ["P1", "P2", "P3"],
    active_profile: "P1",
    device_active_profile_index: 1,
    min_temp: 5,
    max_temp: 30.5,
    step: 0.5,
    ...overrides,
  };
}

async function profileOptions(
  schedule: ClimateScheduleData,
): Promise<{ value: string; label: string }[]> {
  const hass = createHass({
    ws: {
      [LIST_SCHEDULE_DEVICES]: { devices: [heatingGroup] },
      [GET_CLIMATE_SCHEDULE]: schedule,
    },
  });
  const view = await mount<HmDeviceSchedule>("hm-device-schedule", { hass, entryId: "entry-1" });
  const select = deepQuery(view, ".profile-selector ha-select");
  expect(select).not.toBeNull();
  return optionsOf(select!);
}

describe("hm-device-schedule profile selector", () => {
  it("marks the profile named by device_active_profile_index", async () => {
    const options = await profileOptions(climateSchedule({ device_active_profile_index: 2 }));

    expect(options.map((o) => o.label)).toEqual(["P1", "P2 (Active profile)", "P3"]);
  });

  // Issue #114: the backend lists profiles in the order the CCU returns the
  // MASTER paramset keys, which is not guaranteed to be P1, P2, P3.
  it("marks the active profile by name, not by list position", async () => {
    const options = await profileOptions(
      climateSchedule({ available_profiles: ["P2", "P3", "P1"], device_active_profile_index: 1 }),
    );

    const marked = options.filter((o) => o.label.includes("Active profile"));
    expect(marked.map((o) => o.value)).toEqual(["P1"]);
  });

  it("lists the profiles in numeric order whatever order the backend sends", async () => {
    const options = await profileOptions(
      climateSchedule({ available_profiles: ["P2", "P3", "P1"], device_active_profile_index: 1 }),
    );

    expect(options.map((o) => o.value)).toEqual(["P1", "P2", "P3"]);
  });

  it("marks no profile while the device does not report one", async () => {
    const options = await profileOptions(climateSchedule({ device_active_profile_index: null }));

    expect(options.map((o) => o.label)).toEqual(["P1", "P2", "P3"]);
  });
});
