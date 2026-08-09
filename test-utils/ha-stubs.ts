/**
 * Stand-ins for the `ha-*` elements Home Assistant provides at runtime.
 *
 * These elements are never bundled — the cards and the panel expect the
 * frontend to have defined them. Without stubs an `<ha-select>` is an inert
 * `HTMLElement`, so nothing dispatches the events the components listen for.
 *
 * The stubs keep their children in the light DOM, which makes `textOf()`
 * assertions read exactly like the rendered template.
 */

/** Every `ha-*` element used across the packages. */
const HA_TAGS = [
  "ha-alert",
  "ha-button",
  "ha-card",
  "ha-checkbox",
  "ha-circular-progress",
  "ha-dialog",
  "ha-form",
  "ha-icon",
  "ha-icon-button",
  "ha-input",
  "ha-list-virtualized",
  "ha-markdown",
  "ha-menu-button",
  "ha-radio-group",
  "ha-radio-option",
  "ha-select",
  "ha-slider",
  "ha-switch",
] as const;

/** Option list shape of `ha-select` (HA 2026.3.0+). */
export interface HaSelectOption {
  value: string;
  label: string;
}

class HaStub extends HTMLElement {}

/**
 * Define the stubs. Idempotent, so setup files and individual tests can both
 * call it without tripping over a duplicate registration.
 */
export function registerHaStubs(): void {
  for (const tag of HA_TAGS) {
    if (!customElements.get(tag)) {
      customElements.define(tag, class extends HaStub {});
    }
  }
}

/**
 * Pick an option on an `ha-select`, the way the real element does: set `value`,
 * then dispatch `selected` carrying the value in `detail`.
 */
export function selectOption(select: Element, value: string): void {
  (select as HTMLElement & { value: string }).value = value;
  select.dispatchEvent(new CustomEvent("selected", { detail: { value }, bubbles: true }));
}

/** The options currently bound to an `ha-select`. */
export function optionsOf(select: Element): HaSelectOption[] {
  return (select as HTMLElement & { options?: HaSelectOption[] }).options ?? [];
}

/** Toggle an `ha-switch` / `ha-checkbox` and dispatch the `change` it reads. */
export function setChecked(toggle: Element, checked: boolean): void {
  (toggle as HTMLElement & { checked: boolean }).checked = checked;
  toggle.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Type into an `ha-input` / `ha-slider` / plain `<input>` and notify listeners. */
export function setValue(input: Element, value: string | number): void {
  (input as HTMLElement & { value: string | number }).value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
