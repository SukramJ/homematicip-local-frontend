import { describe, expect, it } from "vitest";

import { createHass } from "@hmip/test-utils";

import {
  createLoomEditorTransport,
  getLoomEditorManifest,
  loomEditorRequest,
} from "./loom-editor-api";

const MANIFEST = "homematicip_local/loom/editor/manifest";
const REQUEST = "homematicip_local/loom/editor/request";

describe("loom editor relay", () => {
  it("asks the entry's relay for the manifest", async () => {
    const hass = createHass({
      ws: { [MANIFEST]: { available: true, module_url: "/homematicip_local/loom-editor/e/h.js" } },
    });

    const manifest = await getLoomEditorManifest(hass, "entry-1");

    expect(manifest.module_url).toBe("/homematicip_local/loom-editor/e/h.js");
    expect(hass.lastSent(MANIFEST)).toEqual({ type: MANIFEST, entry_id: "entry-1" });
  });

  it("forwards method, path, query, headers and body unchanged", async () => {
    const hass = createHass({ ws: { [REQUEST]: { status: 200, body: { ok: true } } } });

    await loomEditorRequest(hass, "entry-1", {
      method: "PUT",
      path: "/devices/A/paramsets/MASTER",
      query: { channel: "1" },
      headers: { "X-Edit-Token": "t" },
      body: { values: { X: 1 } },
    });

    expect(hass.lastSent(REQUEST)).toEqual({
      type: REQUEST,
      entry_id: "entry-1",
      method: "PUT",
      path: "/devices/A/paramsets/MASTER",
      query: { channel: "1" },
      headers: { "X-Edit-Token": "t" },
      body: { values: { X: 1 } },
    });
  });

  it("sends no body key for a call without a body", async () => {
    const hass = createHass({ ws: { [REQUEST]: { status: 200 } } });

    await loomEditorRequest(hass, "entry-1", {
      method: "GET",
      path: "/devices",
      query: {},
      headers: {},
    });

    expect("body" in hass.lastSent(REQUEST)).toBe(false);
  });

  it("resolves with an error status instead of rejecting", async () => {
    // A 423 (no edit lock) is something the editor shows; rejecting would
    // turn it into "daemon not reached".
    const problem = { type: "about:blank", title: "Locked", status: 423 };
    const hass = createHass({ ws: { [REQUEST]: { status: 423, body: problem } } });

    const response = await loomEditorRequest(hass, "entry-1", {
      method: "PUT",
      path: "/devices/A/paramsets/MASTER",
      query: {},
      headers: {},
      body: {},
    });

    expect(response).toEqual({ status: 423, body: problem });
  });

  it("rejects when the relay refuses the call", async () => {
    const hass = createHass();
    hass.failWith(REQUEST, new Error("route_refused"));

    await expect(
      loomEditorRequest(hass, "entry-1", { method: "GET", path: "/x", query: {}, headers: {} }),
    ).rejects.toThrow("route_refused");
  });

  it("reads the current hass on every call of the transport", async () => {
    const first = createHass({ ws: { [REQUEST]: { status: 200 } } });
    const second = createHass({ ws: { [REQUEST]: { status: 200 } } });
    let current = first;
    const transport = createLoomEditorTransport(() => current, "entry-1");

    await transport.request({ method: "GET", path: "/devices", query: {}, headers: {} });
    current = second;
    await transport.request({ method: "GET", path: "/info", query: {}, headers: {} });

    expect(first.sentOf(REQUEST).map((m) => m.path)).toEqual(["/devices"]);
    expect(second.sentOf(REQUEST).map((m) => m.path)).toEqual(["/info"]);
    expect(second.lastSent(REQUEST).entry_id).toBe("entry-1");
  });
});
