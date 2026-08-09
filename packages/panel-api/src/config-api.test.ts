import { describe, expect, it } from "vitest";

import { createHass, deviceInfo, formSchema, userPermissions } from "@hmip/test-utils";

import {
  getDeviceIconUrl,
  getFormSchema,
  getParamset,
  getUserPermissions,
  listDevices,
  putParamset,
} from "./config-api";

describe("getDeviceIconUrl", () => {
  it("points at the integration's icon endpoint of the entry", () => {
    expect(getDeviceIconUrl("entry-1", "hmip-bsm.png")).toBe(
      "/api/homematicip_local/entry-1/device_icon/hmip-bsm.png",
    );
  });
});

describe("listDevices", () => {
  it("sends the entry id and unwraps the device list", async () => {
    const device = deviceInfo();
    const hass = createHass({
      ws: { "homematicip_local/config/list_devices": { devices: [device] } },
    });

    expect(await listDevices(hass, "entry-1")).toEqual([device]);
    expect(hass.lastSent("homematicip_local/config/list_devices")).toEqual({
      type: "homematicip_local/config/list_devices",
      entry_id: "entry-1",
    });
  });

  it("propagates a backend failure instead of swallowing it", async () => {
    const hass = createHass();
    hass.failWith("homematicip_local/config/list_devices", new Error("central not connected"));

    await expect(listDevices(hass, "entry-1")).rejects.toThrow("central not connected");
  });
});

describe("getFormSchema", () => {
  it("defaults to the MASTER paramset and an unset channel type", async () => {
    const hass = createHass({
      ws: { "homematicip_local/config/get_form_schema": formSchema() },
    });

    await getFormSchema(hass, "entry-1", "ccu-HmIP-RF", "VCU0000001:1");

    expect(hass.lastSent("homematicip_local/config/get_form_schema")).toMatchObject({
      entry_id: "entry-1",
      interface_id: "ccu-HmIP-RF",
      channel_address: "VCU0000001:1",
      channel_type: "",
      paramset_key: "MASTER",
    });
  });

  it("passes an explicit paramset key through", async () => {
    const hass = createHass({
      ws: { "homematicip_local/config/get_form_schema": formSchema() },
    });

    await getFormSchema(hass, "entry-1", "ccu-HmIP-RF", "VCU0000001:1", "SWITCH", "VALUES");

    expect(hass.lastSent("homematicip_local/config/get_form_schema")).toMatchObject({
      channel_type: "SWITCH",
      paramset_key: "VALUES",
    });
  });
});

describe("getParamset", () => {
  it("unwraps the values object", async () => {
    const hass = createHass({
      ws: { "homematicip_local/config/get_paramset": { values: { GLOBAL_BUTTON_LOCK: true } } },
    });

    expect(await getParamset(hass, "entry-1", "ccu-HmIP-RF", "VCU0000001:1")).toEqual({
      GLOBAL_BUTTON_LOCK: true,
    });
  });
});

describe("putParamset", () => {
  it("validates by default", async () => {
    const hass = createHass({
      ws: {
        "homematicip_local/config/put_paramset": {
          success: true,
          validated: true,
          validation_errors: {},
        },
      },
    });

    const result = await putParamset(hass, "entry-1", "ccu-HmIP-RF", "VCU0000001:1", {
      GLOBAL_BUTTON_LOCK: true,
    });

    expect(result.success).toBe(true);
    expect(hass.lastSent("homematicip_local/config/put_paramset")).toMatchObject({
      paramset_key: "MASTER",
      validate: true,
      values: { GLOBAL_BUTTON_LOCK: true },
    });
  });

  it("can write without validating", async () => {
    const hass = createHass({
      ws: {
        "homematicip_local/config/put_paramset": {
          success: true,
          validated: false,
          validation_errors: {},
        },
      },
    });

    await putParamset(hass, "entry-1", "ccu-HmIP-RF", "VCU0000001:1", {}, "VALUES", false);

    expect(hass.lastSent("homematicip_local/config/put_paramset")).toMatchObject({
      paramset_key: "VALUES",
      validate: false,
    });
  });
});

describe("getUserPermissions", () => {
  it("returns the backend the entry runs on", async () => {
    const hass = createHass({
      ws: {
        "homematicip_local/config/get_user_permissions": userPermissions({
          backend: "openccu-loom",
          is_admin: false,
        }),
      },
    });

    const permissions = await getUserPermissions(hass, "entry-1");

    expect(permissions.backend).toBe("openccu-loom");
    expect(permissions.is_admin).toBe(false);
  });
});
