import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createHass, eventSpy, mount, textOf, update, type FakeHass } from "@hmip/test-utils";

import "./loom-device-editor";
import { HmLoomDeviceEditor } from "./loom-device-editor";

const MANIFEST = "homematicip_local/loom/editor/manifest";
const REQUEST = "homematicip_local/loom/editor/request";
const MODULE_URL = "/homematicip_local/loom-editor/entry-1/abc.js";

/**
 * Stands in for the daemon's `<loom-device-editor>`: records what the view
 * sets, and what it had set by the moment the element was connected.
 */
class FakeLoomEditor extends HTMLElement {
  static instances: FakeLoomEditor[] = [];
  transport?: { request(req: unknown): Promise<unknown> };
  address = "";
  channel?: number;
  sub?: string;
  locale = "";
  dark = false;
  skin = "";
  connectedWith?: { transport: unknown; address: string; skin: string };

  connectedCallback(): void {
    this.connectedWith = { transport: this.transport, address: this.address, skin: this.skin };
    FakeLoomEditor.instances.push(this);
  }
}
customElements.define("loom-device-editor", FakeLoomEditor);

let loadModule: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  FakeLoomEditor.instances = [];
  loadModule = vi.spyOn(HmLoomDeviceEditor.prototype, "loadModule").mockResolvedValue({});
});

afterEach(() => {
  loadModule.mockRestore();
});

function hassWith(manifest: unknown, options: { darkMode?: boolean; language?: string } = {}) {
  return createHass({
    ws: { [MANIFEST]: manifest, [REQUEST]: { status: 200, body: [] } },
    ...options,
  });
}

async function mountView(
  hass: FakeHass,
  properties: Partial<HmLoomDeviceEditor> = {},
): Promise<HmLoomDeviceEditor> {
  const view = await mount<HmLoomDeviceEditor>("hm-loom-device-editor", {
    hass,
    entryId: "entry-1",
    address: "000ABCDE",
    ...properties,
  });
  await vi.waitFor(() => expect(view.renderRoot.querySelector(".loading")).toBeNull());
  return view;
}

const editorIn = (view: HmLoomDeviceEditor): FakeLoomEditor | null =>
  view.renderRoot.querySelector<FakeLoomEditor>("loom-device-editor");

describe("hm-loom-device-editor", () => {
  it("loads the module the manifest names and mounts the editor with a transport", async () => {
    const hass = hassWith({ available: true, module_url: MODULE_URL });

    const view = await mountView(hass, { channel: 2, sub: "links" });

    expect(loadModule).toHaveBeenCalledWith(MODULE_URL);
    expect(hass.lastSent(MANIFEST).entry_id).toBe("entry-1");
    const editor = editorIn(view)!;
    expect(editor).not.toBeNull();
    // Set before connection: the element starts the editor as soon as it is
    // connected with a transport.
    expect(editor.connectedWith?.transport).toBeDefined();
    expect(editor.connectedWith?.address).toBe("000ABCDE");
    expect(editor.connectedWith?.skin).toBe("ha");
    expect(editor.channel).toBe(2);
    expect(editor.sub).toBe("links");
  });

  it("relays the editor's calls through the entry's request command", async () => {
    const hass = hassWith({ available: true, module_url: MODULE_URL });
    const view = await mountView(hass);

    const response = await editorIn(view)!.transport!.request({
      method: "GET",
      path: "/devices/000ABCDE",
      query: {},
      headers: {},
    });

    expect(response).toEqual({ status: 200, body: [] });
    expect(hass.lastSent(REQUEST)).toMatchObject({
      entry_id: "entry-1",
      method: "GET",
      path: "/devices/000ABCDE",
    });
  });

  it("passes language and dark mode from hass", async () => {
    const view = await mountView(
      hassWith({ available: true, module_url: MODULE_URL }, { language: "de", darkMode: true }),
    );

    const editor = editorIn(view)!;
    expect(editor.locale).toBe("de");
    expect(editor.dark).toBe(true);

    await update(view, {
      hass: hassWith({ available: true, module_url: MODULE_URL }, { language: "en" }),
    });
    expect(editor.locale).toBe("en");
    expect(editor.dark).toBe(false);
  });

  it("keeps one element when the device changes", async () => {
    const view = await mountView(hassWith({ available: true, module_url: MODULE_URL }));
    const editor = editorIn(view);

    await update(view, { address: "000FFFFF", channel: undefined, sub: undefined });

    expect(editorIn(view)).toBe(editor);
    expect(editor!.address).toBe("000FFFFF");
    expect(FakeLoomEditor.instances).toHaveLength(1);
  });

  it("says so when the daemon does not provide the editor", async () => {
    const view = await mountView(hassWith({ available: false, module_url: null }));

    expect(loadModule).not.toHaveBeenCalled();
    expect(editorIn(view)).toBeNull();
    expect(textOf(view.renderRoot)).toContain("does not provide the device editor");
  });

  it("shows the error when the module cannot be loaded", async () => {
    loadModule.mockRejectedValue(new Error("404 stale hash"));

    const view = await mountView(hassWith({ available: true, module_url: MODULE_URL }));

    expect(editorIn(view)).toBeNull();
    expect(textOf(view.renderRoot)).toContain("404 stale hash");
  });

  it("lets the editor's navigation events reach the panel", async () => {
    const view = await mountView(hassWith({ available: true, module_url: MODULE_URL }));
    const seen = eventSpy<{ route: string }>(document.body, "loom-navigate");

    editorIn(view)!.dispatchEvent(
      new CustomEvent("loom-navigate", {
        detail: { route: "#/devices/B" },
        bubbles: true,
        composed: true,
      }),
    );

    expect(seen.map((e) => e.detail.route)).toEqual(["#/devices/B"]);
  });
});
