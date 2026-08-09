import { describe, expect, it } from "vitest";

import { click, eventSpy, mount, queryAll, queryOrThrow, textOf } from "@hmip/test-utils";

import "./breadcrumb";
import type { BreadcrumbItem, HmBreadcrumb } from "./breadcrumb";

const trail: BreadcrumbItem[] = [
  { label: "Devices", view: "devices" },
  { label: "Living Room Switch", view: "device", detail: { device: "VCU0000001" } },
  { label: "Channel 1" },
];

describe("hm-breadcrumb", () => {
  it("renders nothing while there is no trail to go back through", async () => {
    const element = await mount<HmBreadcrumb>("hm-breadcrumb", { items: [trail[0]] });

    expect(queryAll(element, "nav")).toHaveLength(0);
  });

  it("links every ancestor and marks the last item as the current page", async () => {
    const element = await mount<HmBreadcrumb>("hm-breadcrumb", { items: trail });

    expect(queryAll(element, "a.link").map((link) => link.textContent?.trim())).toEqual([
      "Devices",
      "Living Room Switch",
    ]);

    const current = queryOrThrow(element, ".current");
    expect(current.textContent?.trim()).toBe("Channel 1");
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  it("separates the entries", async () => {
    const element = await mount<HmBreadcrumb>("hm-breadcrumb", { items: trail });

    expect(queryAll(element, ".separator")).toHaveLength(2);
    expect(textOf(element)).toBe("Devices › Living Room Switch › Channel 1");
  });

  it("merges the item detail into the navigation event", async () => {
    const element = await mount<HmBreadcrumb>("hm-breadcrumb", { items: trail });
    const navigations = eventSpy<{ view: string; device?: string }>(element, "breadcrumb-navigate");

    await click(queryAll(element, "a.link")[1], element);

    expect(navigations).toHaveLength(1);
    expect(navigations[0].detail).toEqual({ view: "device", device: "VCU0000001" });
  });

  it("stays put when the clicked item has no target view", async () => {
    const element = await mount<HmBreadcrumb>("hm-breadcrumb", {
      items: [{ label: "Devices" }, { label: "Channel 1" }],
    });
    const navigations = eventSpy(element, "breadcrumb-navigate");

    await click(queryOrThrow(element, "a.link"), element);

    expect(navigations).toHaveLength(0);
  });
});
