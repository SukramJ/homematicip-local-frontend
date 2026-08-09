/**
 * Global test setup, loaded before every Vitest file.
 *
 * jsdom implements neither the observer APIs nor the Web Animations API, both of
 * which Lit components and Home Assistant elements touch while rendering. Each
 * polyfill is installed only when missing, so a future jsdom that ships the real
 * thing wins over the stub.
 */
import { afterEach } from "vitest";

import { cleanupMounted } from "./dom";
import { registerHaStubs } from "./ha-stubs";

class ObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): [] {
    return [];
  }
}

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = ObserverStub as unknown as typeof ResizeObserver;
}

if (!("IntersectionObserver" in globalThis)) {
  globalThis.IntersectionObserver = ObserverStub as unknown as typeof IntersectionObserver;
}

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}

if (!Element.prototype.animate) {
  Element.prototype.animate = function animate(): Animation {
    return {
      cancel: () => {},
      finish: () => {},
      play: () => {},
      pause: () => {},
      finished: Promise.resolve(),
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as Animation;
  };
}

registerHaStubs();

afterEach(() => {
  cleanupMounted();
});
