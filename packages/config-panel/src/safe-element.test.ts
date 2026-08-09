import { describe, expect, it } from "vitest";

import { safeCustomElement } from "./safe-element";

describe("safeCustomElement", () => {
  it("registers the element under the given tag", () => {
    class First extends HTMLElement {}
    safeCustomElement("hm-safe-register")(First);

    expect(customElements.get("hm-safe-register")).toBe(First);
  });

  it("returns the class so it can be used as a decorator", () => {
    class First extends HTMLElement {}

    expect(safeCustomElement("hm-safe-returns")(First)).toBe(First);
  });

  it("keeps the first registration when the script is loaded twice", () => {
    class First extends HTMLElement {}
    class Second extends HTMLElement {}
    safeCustomElement("hm-safe-duplicate")(First);

    expect(() => safeCustomElement("hm-safe-duplicate")(Second)).not.toThrow();
    expect(customElements.get("hm-safe-duplicate")).toBe(First);
  });

  it("produces a working element", async () => {
    class Greeting extends HTMLElement {
      connectedCallback(): void {
        this.textContent = "hello";
      }
    }
    safeCustomElement("hm-safe-working")(Greeting);

    const element = document.createElement("hm-safe-working");
    document.body.appendChild(element);

    expect(element.textContent).toBe("hello");
    element.remove();
  });
});
