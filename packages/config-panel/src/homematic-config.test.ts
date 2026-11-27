import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createHass,
  deviceInfo,
  eventSpy,
  mount,
  optionsOf,
  userPermissions,
  type FakeHass,
  type WsMessage,
} from "@hmip/test-utils";

import "./homematic-config";
import type { HomematicConfigPanel } from "./homematic-config";
import { HmLoomDeviceEditor } from "./views/loom-device-editor";

const ENTRIES = "config_entries/get";
const PERMISSIONS = "homematicip_local/config/get_user_permissions";
const MANIFEST = "homematicip_local/loom/editor/manifest";
const LIST_DEVICES = "homematicip_local/config/list_devices";

class FakeLoomEditor extends HTMLElement {
  transport?: unknown;
  address = "";
  channel?: number;
  sub?: string;
  locale = "";
  dark = false;
  skin = "";
}
customElements.define("loom-device-editor", FakeLoomEditor);

interface Entry {
  id: string;
  backend: string;
  isAdmin?: boolean;
  editor?: boolean;
}

function hassFor(entries: Entry[]): FakeHass {
  const byId = new Map(entries.map((e) => [e.id, e]));
  return createHass({
    ws: {
      [ENTRIES]: entries.map((e) => ({
        entry_id: e.id,
        domain: "homematicip_local",
        state: "loaded",
        title: `Title ${e.id}`,
      })),
      [PERMISSIONS]: (m: WsMessage) =>
        userPermissions({
          backend: byId.get(m.entry_id as string)!.backend,
          is_admin: byId.get(m.entry_id as string)!.isAdmin ?? true,
        }),
      [MANIFEST]: (m: WsMessage) => ({
        available: byId.get(m.entry_id as string)!.editor ?? true,
        module_url: "/homematicip_local/loom-editor/x/h.js",
      }),
      [LIST_DEVICES]: { devices: [deviceInfo({ address: "000ABCDE", name: "Lampe" })] },
    },
  });
}

async function mountPanel(hass: FakeHass): Promise<HomematicConfigPanel> {
  const panel = await mount<HomematicConfigPanel>("homematic-config", {
    hass,
    panel: { config: {} },
  });
  await vi.waitFor(() => expect(hass.sentOf(PERMISSIONS).length).toBeGreaterThan(0));
  await panel.updateComplete;
  await new Promise((r) => setTimeout(r, 0));
  return panel;
}

const pickerValues = (panel: HomematicConfigPanel): string[] => {
  const select = panel.renderRoot.querySelector(".entry-selector ha-select");
  return select ? optionsOf(select).map((o) => o.value) : [];
};

/** Selects a device in the list, as a click on its row does. */
async function selectDevice(panel: HomematicConfigPanel, address: string): Promise<void> {
  const list = await vi.waitFor(() => {
    const el = panel.renderRoot.querySelector("hm-device-list");
    expect(el).not.toBeNull();
    return el!;
  });
  list.dispatchEvent(
    new CustomEvent("device-selected", {
      detail: { device: address, interfaceId: "x-HmIP-RF" },
      bubbles: true,
      composed: true,
    }),
  );
  await panel.updateComplete;
}

async function editorView(panel: HomematicConfigPanel): Promise<HmLoomDeviceEditor> {
  return vi.waitFor(() => {
    const el = panel.renderRoot.querySelector<HmLoomDeviceEditor>("hm-loom-device-editor");
    expect(el).not.toBeNull();
    return el!;
  });
}

let loadModule: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  localStorage.clear();
  loadModule = vi.spyOn(HmLoomDeviceEditor.prototype, "loadModule").mockResolvedValue({});
});

afterEach(() => {
  loadModule.mockRestore();
});

describe("homematic-config on loom entries", () => {
  it("offers a loom entry next to a CCU entry", async () => {
    const panel = await mountPanel(
      hassFor([
        { id: "ccu", backend: "CCU" },
        { id: "loom", backend: "openccu-loom" },
      ]),
    );

    expect(pickerValues(panel)).toEqual(["ccu", "loom"]);
  });

  it("leaves out a loom entry for a non-admin and one whose daemon has no editor", async () => {
    const hass = hassFor([
      { id: "ccu", backend: "CCU", isAdmin: false },
      { id: "loom-user", backend: "openccu-loom", isAdmin: false },
      { id: "loom-old", backend: "openccu-loom", editor: false },
      { id: "loom", backend: "openccu-loom" },
    ]);
    const panel = await mountPanel(hass);

    expect(pickerValues(panel)).toEqual(["ccu", "loom"]);
    // The relay is admin-only: a non-admin's entry is decided without asking it.
    expect(hass.sentOf(MANIFEST).map((m) => m.entry_id)).not.toContain("loom-user");
  });

  it("opens the daemon's editor for a device of a loom entry", async () => {
    const panel = await mountPanel(hassFor([{ id: "loom", backend: "openccu-loom" }]));

    await selectDevice(panel, "000ABCDE");

    const view = await editorView(panel);
    expect(view.entryId).toBe("loom");
    expect(view.address).toBe("000ABCDE");
    expect(panel.renderRoot.querySelector("hm-device-detail")).toBeNull();
    expect(window.location.hash).toContain("view=loom-editor");
  });

  it("keeps the Lit device page for a CCU entry", async () => {
    const panel = await mountPanel(hassFor([{ id: "ccu", backend: "CCU" }]));

    await selectDevice(panel, "000ABCDE");

    await vi.waitFor(() =>
      expect(panel.renderRoot.querySelector("hm-device-detail")).not.toBeNull(),
    );
    expect(panel.renderRoot.querySelector("hm-loom-device-editor")).toBeNull();
  });

  it("follows the editor's link to another device's tab", async () => {
    const panel = await mountPanel(hassFor([{ id: "loom", backend: "openccu-loom" }]));
    await selectDevice(panel, "000ABCDE");
    const view = await editorView(panel);

    view.dispatchEvent(
      new CustomEvent("loom-navigate", {
        detail: { route: "#/devices/000FFFFF/channels/2?tab=schedule" },
        bubbles: true,
        composed: true,
      }),
    );
    await panel.updateComplete;

    expect(view.address).toBe("000FFFFF");
    expect(view.channel).toBe(2);
    expect(view.sub).toBe("schedule");
    expect(window.location.hash).toContain("sub=schedule");
  });

  it("lands a link profile route on the sender's links and says why", async () => {
    const panel = await mountPanel(hassFor([{ id: "loom", backend: "openccu-loom" }]));
    await selectDevice(panel, "000ABCDE");
    const view = await editorView(panel);
    const toasts = eventSpy<{ message: string }>(panel, "hass-notification");

    view.dispatchEvent(
      new CustomEvent("loom-navigate", {
        detail: { route: "#/links/000BBBBB%3A1/000CCCCC%3A2" },
        bubbles: true,
        composed: true,
      }),
    );
    await panel.updateComplete;

    expect(view.address).toBe("000BBBBB");
    expect(view.sub).toBe("links");
    expect(toasts.map((t) => t.detail.message)).toEqual([
      expect.stringContaining("edited in the openccu-loom UI"),
    ]);
  });

  it("goes back to the device list for the editor's devices route", async () => {
    const panel = await mountPanel(hassFor([{ id: "loom", backend: "openccu-loom" }]));
    await selectDevice(panel, "000ABCDE");
    const view = await editorView(panel);

    view.dispatchEvent(
      new CustomEvent("loom-navigate", {
        detail: { route: "#/devices" },
        bubbles: true,
        composed: true,
      }),
    );
    await panel.updateComplete;

    expect(panel.renderRoot.querySelector("hm-device-list")).not.toBeNull();
  });

  it("opens the editor for a Lit device-page link on a loom entry", async () => {
    window.history.replaceState(null, "", "/#view=device-detail&entry=loom&device=000ABCDE");

    const panel = await mountPanel(hassFor([{ id: "loom", backend: "openccu-loom" }]));

    const view = await editorView(panel);
    expect(view.address).toBe("000ABCDE");
  });

  it("restores the editor's channel and sub-page from the URL", async () => {
    window.history.replaceState(
      null,
      "",
      "/#view=loom-editor&entry=loom&device=000ABCDE&channel=3&sub=links",
    );

    const panel = await mountPanel(hassFor([{ id: "loom", backend: "openccu-loom" }]));

    const view = await editorView(panel);
    expect(view.channel).toBe(3);
    expect(view.sub).toBe("links");
  });
});
