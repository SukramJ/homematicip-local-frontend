import { LitElement, html, css } from "lit";
import { property } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";

/**
 * The interface name heading a group of device rows.
 *
 * Its own element for the same reason as `hm-device-row`: the virtualized list
 * renders rows inside `ha-list-virtualized`'s shadow root, where the list's styles
 * do not reach. Carrying its own styles lets the header render identically in both
 * the virtualized and the plain list.
 */
@safeCustomElement("hm-interface-header")
export class HmInterfaceHeader extends LitElement {
  @property() public label = "";

  /**
   * Pins the header while its group scrolls past. Only the plain list can do this —
   * the virtualizer scrolls its own container, so its rows cannot stick.
   */
  @property({ type: Boolean, reflect: true }) public sticky = false;

  /** Separates the header from the group above it. Not set on the first one. */
  @property({ type: Boolean, reflect: true }) public spaced = false;

  render() {
    return html`<div class="header">${this.label}</div>`;
  }

  static styles = css`
    :host {
      display: block;
    }

    /* Padding rather than a margin: the virtualizer measures the row box to place it. */
    :host([spaced]) {
      padding-top: 16px;
    }

    :host([sticky]) {
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .header {
      background: var(--primary-background-color, #fff);
      border-start-start-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg, 16px));
      border-start-end-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg, 16px));
      border-bottom: 1px solid var(--divider-color);
      padding: 8px 10px;
      margin-bottom: 4px;
      font-size: 14px;
      font-weight: 500;
      color: var(--secondary-text-color);
      text-transform: uppercase;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "hm-interface-header": HmInterfaceHeader;
  }
}
