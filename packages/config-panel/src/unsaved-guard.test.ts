import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReactiveController, ReactiveControllerHost } from "lit";

import { isNavigationClick, UnsavedGuard } from "./unsaved-guard";

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

  it("ignores a link that points nowhere", () => {
    const { event } = anchorClick({ href: "#" });

    expect(isNavigationClick(event)).toBeUndefined();
  });

  it("leaves a pointless click alone rather than cancelling it", () => {
    const { event } = anchorClick({ href: "#" });

    isNavigationClick(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("still guards a link back to the panel's own path", () => {
    // The panel keeps its state in the URL hash, so Home Assistant's sidebar
    // link to the panel shares its path while dropping the whole view state.
    // That is the case the guard exists for and must not be filtered out.
    window.history.replaceState(null, "", "/homematic-config#view=channel");
    const { event } = anchorClick({ href: "/homematic-config" });

    expect(isNavigationClick(event)).toBe("/homematic-config");
  });
});

/** The bare `ReactiveControllerHost` surface the guard uses. */
class FakeHost implements ReactiveControllerHost {
  readonly controllers: ReactiveController[] = [];

  addController(controller: ReactiveController): void {
    this.controllers.push(controller);
  }

  removeController(): void {}

  requestUpdate(): void {}

  get updateComplete(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

describe("UnsavedGuard", () => {
  /** Arm a guard over a host that reports unsaved changes. */
  function armedGuard(promptDiscard = vi.fn(async () => true)) {
    const guard = new UnsavedGuard(new FakeHost(), {
      isDirty: () => true,
      promptDiscard,
    });
    guard.hostUpdate();
    return { guard, promptDiscard };
  }

  /** Click an anchor and let the guard's async handler run. */
  async function clickAnchor(attributes: Record<string, string>): Promise<void> {
    const anchor = document.createElement("a");
    for (const [name, value] of Object.entries(attributes)) {
      anchor.setAttribute(name, value);
    }
    // The breadcrumb cancels the click in its own handler. The guard listens in
    // the capture phase, so it sees the click first — before `defaultPrevented`
    // is set.
    anchor.addEventListener("click", (event) => event.preventDefault());
    document.body.appendChild(anchor);
    anchor.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }),
    );
    await Promise.resolve();
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("prompts before an in-app navigation drops unsaved changes", async () => {
    const { guard, promptDiscard } = armedGuard();

    await clickAnchor({ href: "/lovelace/default_view" });
    guard.hostDisconnected();

    expect(promptDiscard).toHaveBeenCalledTimes(1);
  });

  it("stays silent on a breadcrumb click, which navigates inside the view", async () => {
    const { guard, promptDiscard } = armedGuard();

    await clickAnchor({ href: "#" });
    guard.hostDisconnected();

    expect(promptDiscard).not.toHaveBeenCalled();
  });

  it("stops listening once the host reports no unsaved changes", async () => {
    const promptDiscard = vi.fn(async () => true);
    let dirty = true;
    const guard = new UnsavedGuard(new FakeHost(), {
      isDirty: () => dirty,
      promptDiscard,
    });
    guard.hostUpdate();

    dirty = false;
    guard.hostUpdate();
    await clickAnchor({ href: "/lovelace/default_view" });

    expect(promptDiscard).not.toHaveBeenCalled();
  });

  it("stops listening when the host leaves the DOM", async () => {
    const { guard, promptDiscard } = armedGuard();

    guard.hostDisconnected();
    await clickAnchor({ href: "/lovelace/default_view" });

    expect(promptDiscard).not.toHaveBeenCalled();
  });
});
