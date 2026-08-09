import { describe, expect, it } from "vitest";

import { createHass } from "@hmip/test-utils";

import { fetchConfigEntryOptions } from "./helpers";

const CONFIG_ENTRIES = "config_entries/get";

describe("fetchConfigEntryOptions", () => {
  it("asks only for the integration's own entries", async () => {
    const hass = createHass({ ws: { [CONFIG_ENTRIES]: [] } });

    await fetchConfigEntryOptions(hass);

    expect(hass.lastSent(CONFIG_ENTRIES)).toEqual({
      type: CONFIG_ENTRIES,
      domain: "homematicip_local",
    });
  });

  it("maps the entries to select options", async () => {
    const hass = createHass({
      ws: {
        [CONFIG_ENTRIES]: [
          { entry_id: "entry-1", title: "CCU Home", domain: "homematicip_local" },
          { entry_id: "entry-2", title: "CCU Cabin", domain: "homematicip_local" },
        ],
      },
    });

    expect(await fetchConfigEntryOptions(hass)).toEqual([
      { value: "entry-1", label: "CCU Home" },
      { value: "entry-2", label: "CCU Cabin" },
    ]);
  });

  it("returns an empty list when no entry is configured", async () => {
    const hass = createHass({ ws: { [CONFIG_ENTRIES]: [] } });

    expect(await fetchConfigEntryOptions(hass)).toEqual([]);
  });

  it("degrades to an empty list instead of breaking the card when the call fails", async () => {
    const hass = createHass();
    hass.failWith(CONFIG_ENTRIES, new Error("unauthorized"));

    expect(await fetchConfigEntryOptions(hass)).toEqual([]);
  });
});
