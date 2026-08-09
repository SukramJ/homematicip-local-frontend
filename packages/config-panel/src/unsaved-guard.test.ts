import { afterEach, describe, expect, it } from "vitest";

import { isNavigationClick } from "./unsaved-guard";

/** Build an anchor in the document and the click event that targets it. */
function anchorClick(
  attributes: Record<string, string>,
  eventInit: MouseEventInit = {},
): { anchor: HTMLAnchorElement; event: MouseEvent } {
  const anchor = document.createElement("a");
  for (const [name, value] of Object.entries(attributes)) {
    anchor.setAttribute(name, value);
  }
  document.body.appendChild(anchor);
  // The modifier flags are read-only, so they have to go through the constructor.
  const event = new MouseEvent("click", {
    bubbles: true,
    composed: true,
    cancelable: true,
    ...eventInit,
  });
  // `composedPath()` is only populated while the event is being dispatched.
  let path: EventTarget[] = [];
  anchor.addEventListener("click", (dispatched) => {
    path = dispatched.composedPath();
  });
  anchor.dispatchEvent(event);
  Object.defineProperty(event, "composedPath", { value: () => path });
  return { anchor, event };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isNavigationClick", () => {
  it("returns the in-app path of a plain left click", () => {
    const { event } = anchorClick({ href: "/config/homematic/devices" });

    expect(isNavigationClick(event)).toBe("/config/homematic/devices");
  });

  it("cancels the click so Home Assistant's router skips it", () => {
    const { event } = anchorClick({ href: "/config/homematic/devices" });

    isNavigationClick(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves the click alone when asked not to prevent it", () => {
    const { event } = anchorClick({ href: "/config/homematic/devices" });

    expect(isNavigationClick(event, false)).toBe("/config/homematic/devices");
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    ["a middle click", { button: 1 }],
    ["a meta click", { metaKey: true }],
    ["a ctrl click", { ctrlKey: true }],
    ["a shift click", { shiftKey: true }],
  ])("ignores %s, which opens a new context", (_label, init) => {
    const { event } = anchorClick({ href: "/config/homematic" }, init);

    expect(isNavigationClick(event)).toBeUndefined();
  });

  it("ignores an already handled click", () => {
    const { event } = anchorClick({ href: "/config/homematic" });
    event.preventDefault();

    expect(isNavigationClick(event)).toBeUndefined();
  });

  it("ignores a click that hit no anchor", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    const event = new MouseEvent("click", { bubbles: true, composed: true, cancelable: true });
    let path: EventTarget[] = [];
    button.addEventListener("click", (dispatched) => (path = dispatched.composedPath()));
    button.dispatchEvent(event);
    Object.defineProperty(event, "composedPath", { value: () => path });

    expect(isNavigationClick(event)).toBeUndefined();
  });

  it.each([
    ["a link opening a new tab", { href: "/config", target: "_blank" }],
    ["a download link", { href: "/config/export.json", download: "" }],
    ["an explicitly external link", { href: "/config", rel: "external" }],
    ["a mail link", { href: "mailto:someone@example.org" }],
    ["a link to another origin", { href: "https://example.org/config" }],
  ])("ignores %s", (_label, attributes) => {
    const { event } = anchorClick(attributes);

    expect(isNavigationClick(event)).toBeUndefined();
  });

  it("ignores an anchor without an href", () => {
    const { event } = anchorClick({});

    expect(isNavigationClick(event)).toBeUndefined();
  });
});
