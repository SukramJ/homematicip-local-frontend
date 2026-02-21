/**
 * Safe custom element decorator that prevents duplicate registration errors.
 * Drop-in replacement for Lit's @customElement when the script may be loaded multiple times.
 */
export function safeCustomElement(name: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <T extends new (...args: any[]) => HTMLElement>(clazz: T): T => {
    if (!customElements.get(name)) {
      customElements.define(name, clazz as unknown as CustomElementConstructor);
    }
    return clazz;
  };
}
