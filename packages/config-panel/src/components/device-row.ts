import { LitElement, html, css, nothing } from "lit";
import { property } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { getDeviceIconUrl } from "../api";
import { localize } from "../localize";
import type { HomeAssistant, DeviceInfo, MaintenanceData } from "../types";

/**
 * A single device row in the device list.
 *
 * This is its own element rather than a template in `hm-device-list` because the
 * virtualized list renders rows inside `ha-list-virtualized`'s shadow root, where
 * the list's styles do not reach. Carrying its own styles lets the row render
 * identically in both the virtualized and the plain list.
 *
 * @fires device-selected - `detail: { device: address, interfaceId }`, composed
 * so it also escapes the virtualizer's shadow root.
 */
@safeCustomElement("hm-device-row")
export class HmDeviceRow extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";
  @property({ attribute: false }) public device!: DeviceInfo;

  updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has("hass") && this.hass) {
      this.classList.toggle("dark-theme", this.hass.themes?.darkMode ?? false);
    }
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private _handleClick(): void {
    this.dispatchEvent(
      new CustomEvent("device-selected", {
        detail: {
          device: this.device.address,
          interfaceId: this.device.interface_id,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._handleClick();
    }
  }

  private _handleIconError(e: Event): void {
    (e.target as HTMLImageElement).style.display = "none";
  }

  private _renderMaintenanceIcons(m: MaintenanceData) {
    if (!m || Object.keys(m).length === 0) return nothing;
    return html`
      <div class="device-status">
        ${
          m.unreach === true
            ? html`<ha-icon
                class="status-badge unreachable"
                .icon=${"mdi:close-circle"}
                title="${this._l("device_list.unreachable")}"
                aria-label="${this._l("device_list.unreachable")}"
              ></ha-icon>`
            : m.unreach === false
              ? html`<ha-icon
                  class="status-badge reachable"
                  .icon=${"mdi:check-circle"}
                  title="${this._l("device_list.reachable")}"
                  aria-label="${this._l("device_list.reachable")}"
                ></ha-icon>`
              : nothing
        }
        ${
          m.low_bat === true
            ? html`<ha-icon
                class="status-badge low-bat"
                .icon=${"mdi:battery-alert"}
                title="${this._l("device_list.low_battery")}"
                aria-label="${this._l("device_list.low_battery")}"
              ></ha-icon>`
            : nothing
        }
        ${
          m.config_pending === true
            ? html`<ha-icon
                class="status-badge config-pending"
                .icon=${"mdi:clock-alert-outline"}
                title="${this._l("device_list.config_pending")}"
                aria-label="${this._l("device_list.config_pending")}"
              ></ha-icon>`
            : nothing
        }
      </div>
    `;
  }

  render() {
    const device = this.device;
    if (!device) return nothing;

    return html`
      <div
        class="device-card"
        role="button"
        tabindex="0"
        @click=${this._handleClick}
        @keydown=${this._handleKeydown}
      >
        ${
          device.device_icon
            ? html`<img
                class="device-icon"
                src=${getDeviceIconUrl(this.entryId, device.device_icon)}
                alt=""
                @error=${this._handleIconError}
              />`
            : nothing
        }
        <div class="device-main">
          <div class="device-name">${device.name}</div>
          <div class="device-model">${device.model}</div>
        </div>
        <div class="device-meta">
          <span class="device-address">${device.address}</span>
          <span class="device-channels">
            ${device.channels.length} ${this._l("device_list.channels")}
          </span>
        </div>
        ${this._renderMaintenanceIcons(device.maintenance)}
        <ha-icon class="device-arrow" .icon=${"mdi:chevron-right"}></ha-icon>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }

    .device-card {
      display: flex;
      align-items: center;
      padding: 12px 8px;
      cursor: pointer;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      transition: background-color 0.1s;
    }

    .device-card:hover,
    .device-card:focus-visible {
      background-color: var(--secondary-background-color, #f5f5f5);
    }

    .device-card:focus-visible {
      outline: 2px solid var(--primary-color, #03a9f4);
      outline-offset: -2px;
    }

    .device-icon {
      height: 32px;
      width: 32px;
      object-fit: contain;
      flex-shrink: 0;
      margin-right: 4px;
    }

    :host(.dark-theme) .device-icon {
      filter: invert(1) hue-rotate(180deg);
    }

    .device-main {
      flex: 1;
      min-width: 0;
    }

    .device-name {
      font-size: 14px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .device-model {
      font-size: 13px;
      color: var(--secondary-text-color);
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .device-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      margin-right: 12px;
      font-size: 12px;
      color: var(--secondary-text-color);
    }

    .device-status {
      display: flex;
      gap: 4px;
      align-items: center;
      margin-right: 8px;
    }

    .status-badge {
      --ha-icon-display-size: 18px;
      cursor: default;
    }

    .status-badge.unreachable {
      color: var(--error-color, #db4437);
    }

    .status-badge.reachable {
      color: var(--success-color, #4caf50);
    }

    .status-badge.low-bat {
      color: var(--warning-color, #ff9800);
    }

    .status-badge.config-pending {
      color: var(--warning-color, #ff9800);
    }

    .device-arrow {
      --ha-icon-display-size: 18px;
      color: var(--secondary-text-color);
    }

    @media (max-width: 600px) {
      .device-card {
        flex-wrap: wrap;
      }

      .device-meta {
        flex-direction: row;
        gap: 8px;
        margin-right: 0;
        width: 100%;
        margin-top: 4px;
      }

      .device-arrow {
        display: none;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "hm-device-row": HmDeviceRow;
  }
}
