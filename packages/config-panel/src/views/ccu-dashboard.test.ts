import { describe, expect, it } from "vitest";

import { createHass, deepQueryAll, mount, textOf } from "@hmip/test-utils";
import type { SignalQualityDevice } from "@hmip/panel-api";

import "./ccu-dashboard";
import type { HmCcuDashboard } from "./ccu-dashboard";

const signalDevices: SignalQualityDevice[] = [
  {
    address: "PEQ0000001",
    name: "Window Contact",
    model: "HM-Sec-SCo",
    interface_id: "ccu-BidCos-RF",
    is_reachable: true,
    rssi_device: null,
    rssi_peer: -48,
    signal_strength: null,
    low_battery: false,
  },
  {
    address: "VCU0000002",
    name: "Wall Switch",
    model: "HmIP-BSM",
    interface_id: "ccu-HmIP-RF",
    is_reachable: true,
    rssi_device: -65,
    rssi_peer: null,
    signal_strength: -65,
    low_battery: null,
  },
];

/** Mount the dashboard on its signal quality tab with `signalDevices` loaded. */
async function mountSignalTab(): Promise<HmCcuDashboard> {
  const hass = createHass({
    ws: {
      "homematicip_local/ccu/get_system_information": { name: "CCU" },
      "homematicip_local/ccu/get_install_mode_status": {
        hmip: { active: false },
        bidcos: { active: false },
      },
      "homematicip_local/ccu/get_signal_quality": { devices: signalDevices },
      "homematicip_local/ccu/get_firmware_overview": { devices: [] },
      "homematicip_local/ccu/get_inbox_devices": { devices: [] },
      "homematicip_local/ccu/get_service_messages": { messages: [] },
      "homematicip_local/ccu/get_alarm_messages": { alarms: [] },
    },
  });
  return mount<HmCcuDashboard>("hm-ccu-dashboard", {
    hass,
    entryId: "entry-1",
    _subTab: "signal",
  } as Partial<HmCcuDashboard>);
}

/** The cell texts of the row rendered for `name`. */
function rowCells(dashboard: HmCcuDashboard, name: string): string[] {
  const row = deepQueryAll(dashboard, "tbody tr").find(
    (tr) => tr.querySelector(".device-name")?.textContent?.trim() === name,
  );
  expect(row, `row for ${name}`).toBeDefined();
  return [...row!.querySelectorAll("td")].map((td) => textOf(td));
}

describe("hm-ccu-dashboard signal quality", () => {
  it("shows RSSI Device and RSSI Peer in separate columns", async () => {
    const dashboard = await mountSignalTab();

    const headers = deepQueryAll(dashboard, "thead th").map((th) => textOf(th));
    expect(headers.some((h) => h.includes("RSSI Device"))).toBe(true);
    expect(headers.some((h) => h.includes("RSSI Peer"))).toBe(true);

    // BidCos-RF: RSSI_DEVICE invalid, RSSI_PEER valid.
    const bidcos = rowCells(dashboard, "Window Contact");
    expect(bidcos[4]).toBe("—");
    expect(bidcos[5]).toBe("-48");

    // HmIP-RF: only RSSI_DEVICE.
    const hmip = rowCells(dashboard, "Wall Switch");
    expect(hmip[4]).toBe("-65");
    expect(hmip[5]).toBe("—");
  });
});
