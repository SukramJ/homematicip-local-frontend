/**
 * DOM helpers for Lit component tests.
 *
 * Everything mounted through this module is tracked and torn down by the global
 * `afterEach` in `setup.ts`, so tests never leak elements into the next case.
 */
import { render, type TemplateResult } from "lit";

/** Anything Lit-like: it settles its render through `updateComplete`. */
interface UpdatingElement extends HTMLElement {
  updateComplete: Promise<boolean>;
}

const mounted: HTMLElement[] = [];

const hasUpdateComplete = (element: HTMLElement): element is UpdatingElement =>
  "updateComplete" in element;

/** Detach everything mounted since the last cleanup. */
export function cleanupMounted(): void {
  while (mounted.length > 0) {
    mounted.pop()?.remove();
  }
}

/**
 * Wait until the element finished rendering, including updates that a first
 * render scheduled on its children.
 */
export async function settle(element: HTMLElement): Promise<void> {
  if (hasUpdateComplete(element)) {
    await element.updateComplete;
  }
  // A parent's `updateComplete` does not cover children that started updating
  // during that same render, so give the scheduler one more turn.
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (hasUpdateComplete(element)) {
    await element.updateComplete;
  }
}

/**
 * Create a registered custom element, apply properties, attach it and wait for
 * the first render.
 *
 * Throws when the tag is unknown — that almost always means the test forgot the
 * side-effect import that registers the component, and an unregistered element
 * would otherwise render as a silently empty `HTMLElement`.
 */
export async function mount<T extends HTMLElement>(
  tag: string,
  properties: Partial<T> = {},
): Promise<T> {
  if (!customElements.get(tag)) {
    throw new Error(
      `<${tag}> is not registered. Import the module that defines it before mounting.`,
    );
  }
  const element = document.createElement(tag) as T;
  Object.assign(element, properties);
  document.body.appendChild(element);
  mounted.push(element);
  await settle(element);
  return element;
}

/**
 * Apply properties to an already mounted element and wait for the re-render.
 */
export async function update<T extends HTMLElement>(
  element: T,
  properties: Partial<T>,
): Promise<T> {
  Object.assign(element, properties);
  await settle(element);
  return element;
}

/** Render a Lit template into a fresh container and return that container. */
export async function renderTemplate(template: TemplateResult): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  mounted.push(container);
  render(template, container);
  await settle(container);
  return container;
}

/** The shadow root if the element has one, otherwise the element itself. */
const rootOf = (host: Element | DocumentFragment): ParentNode =>
  "shadowRoot" in host && host.shadowRoot ? host.shadowRoot : host;

/** Query inside the host's shadow root (or the host itself for light DOM). */
export function query<E extends Element = Element>(
  host: Element | DocumentFragment,
  selector: string,
): E | null {
  return rootOf(host).querySelector<E>(selector);
}

/** Like `query`, but throws instead of returning null. */
export function queryOrThrow<E extends Element = Element>(
  host: Element | DocumentFragment,
  selector: string,
): E {
  const found = query<E>(host, selector);
  if (!found) {
    throw new Error(`No element matching "${selector}" in <${(host as Element).localName}>.`);
  }
  return found;
}

/** Query all matches inside the host's shadow root (or the host itself). */
export function queryAll<E extends Element = Element>(
  host: Element | DocumentFragment,
  selector: string,
): E[] {
  return Array.from(rootOf(host).querySelectorAll<E>(selector));
}

/** Query across every nested shadow root below the host, depth first. */
export function deepQueryAll<E extends Element = Element>(
  host: Element | DocumentFragment,
  selector: string,
): E[] {
  const found: E[] = [];
  const visit = (node: ParentNode): void => {
    for (const element of Array.from(node.querySelectorAll("*"))) {
      if (element.matches(selector)) {
        found.push(element as E);
      }
      if (element.shadowRoot) {
        visit(element.shadowRoot);
      }
    }
  };
  visit(rootOf(host));
  return found;
}

/** First match across every nested shadow root below the host. */
export function deepQuery<E extends Element = Element>(
  host: Element | DocumentFragment,
  selector: string,
): E | null {
  return deepQueryAll<E>(host, selector)[0] ?? null;
}

/**
 * Collapsed visible text of the host's rendered output.
 *
 * jsdom has no `adoptedStyleSheets`, so Lit falls back to injecting a `<style>`
 * element into the shadow root. Its CSS is part of `textContent` and has to be
 * dropped, or every assertion carries the component's stylesheet.
 */
export function textOf(host: Element | DocumentFragment): string {
  const clone = document.createElement("div");
  for (const child of Array.from(rootOf(host).childNodes)) {
    clone.appendChild(child.cloneNode(true));
  }
  for (const styling of Array.from(clone.querySelectorAll("style, script"))) {
    styling.remove();
  }
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Click an element and wait for the resulting render to settle. */
export async function click(element: Element, host?: HTMLElement): Promise<void> {
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
  await settle(host ?? (element as HTMLElement));
}

/**
 * Record every event of `type` dispatched on `target`.
 *
 * The `schedule-ui` components and the panel views talk to their consumers
 * through CustomEvents, so asserting on the payload is the main way to test
 * them without a live Home Assistant.
 */
export function eventSpy<D = unknown>(target: EventTarget, type: string): CustomEvent<D>[] {
  const events: CustomEvent<D>[] = [];
  target.addEventListener(type, (event) => events.push(event as CustomEvent<D>));
  return events;
}
