import { describe, expect, it } from "vitest";

import { resolveLoomRoute } from "./loom-routes";

describe("resolveLoomRoute", () => {
  it.each([
    ["#/devices", { kind: "device-list" }],
    ["#/devices/", { kind: "device-list" }],
    ["#/devices/000ABCDE", { kind: "device", address: "000ABCDE" }],
    ["#/devices/000ABCDE/channels/3", { kind: "device", address: "000ABCDE", channel: 3 }],
    ["#/devices/000ABCDE?tab=links", { kind: "device", address: "000ABCDE", sub: "links" }],
    [
      "#/devices/000ABCDE/channels/0?tab=schedule",
      { kind: "device", address: "000ABCDE", channel: 0, sub: "schedule" },
    ],
    // Addresses are URI-encoded by the daemon UI (`encodeURIComponent`).
    ["#/devices/CUX%2F01", { kind: "device", address: "CUX/01" }],
  ])("maps the device route %s", (route, expected) => {
    expect(resolveLoomRoute(route)).toEqual(expected);
  });

  it("opens the sender device's links for a link profile page", () => {
    expect(resolveLoomRoute("#/links/DEVA%3A1/PEERA%3A3")).toEqual({
      kind: "device",
      address: "DEVA",
      sub: "links",
      fallbackFrom: "link-profile",
    });
  });

  it.each([
    ["#/links/new?device=DEVB", "DEVB"],
    ["#/links/new?sender=DEVA%3A1", "DEVA"],
    ["#/links/new?receiver=DEVC%3A2", "DEVC"],
  ])("opens the anchored device's links for the link wizard %s", (route, address) => {
    expect(resolveLoomRoute(route)).toEqual({
      kind: "device",
      address,
      sub: "links",
      fallbackFrom: "link-wizard",
    });
  });

  it.each(["#/links/new", "#/links", "#/schedules/x", "#/settings", "", "#/devices/%E0%A4%A"])(
    "reports %s as unsupported",
    (route) => {
      expect(resolveLoomRoute(route)).toEqual({ kind: "unsupported", route });
    },
  );
});
