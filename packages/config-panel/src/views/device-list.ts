import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { listDevices, getDeviceIconUrl } from "../api";
import { localize } from "../localize";
import type { HomeAssistant, DeviceInfo, MaintenanceData } from "../types";

@safeCustomElement("hm-device-list")
export class HmDeviceList extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";

  @state() private _devices: DeviceInfo[] = [];
  @state() private _loading = false;
  @state() private _searchQuery = "";
  @state() private _sortColumn: "name" | "address" | "model" = "name";
  @state() private _sortAsc = true;
  @state() private _error = "";

  updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has("entryId") && this.entryId) {
      this._fetchDevices();
    }
  }

  private async _fetchDevices(): Promise<void> {
    if (!this.entryId) return;
    this._loading = true;
    this._error = "";
    try {
      this._devices = await listDevices(this.hass, this.entryId);
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
      this._devices = [];
    } finally {
      this._loading = false;
    }
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private get _filteredDevices(): DeviceInfo[] {
    if (!this._searchQuery) return this._devices;
    const q = this._searchQuery.toLowerCase();
    return this._devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q) ||
        d.model.toLowerCase().includes(q),
    );
  }

  private _setSortColumn(column: "name" | "address" | "model"): void {
    if (this._sortColumn === column) {
      this._sortAsc = !this._sortAsc;
    } else {
      this._sortColumn = column;
      this._sortAsc = true;
    }
  }

  private get _groupedDevices(): Map<string, DeviceInfo[]> {
    const dir = this._sortAsc ? 1 : -1;
    const col = this._sortColumn;
    const sorted = [...this._filteredDevices].sort((a, b) => dir * a[col].localeCompare(b[col]));
    const groups = new Map<string, DeviceInfo[]>();
    for (const device of sorted) {
      const iface = device.interface_id.split("-").slice(1).join("-") || device.interface_id;
      if (!groups.has(iface)) groups.set(iface, []);
      groups.get(iface)!.push(device);
    }
    return groups;
  }

  private _handleDeviceClick(device: DeviceInfo): void {
    this.dispatchEvent(
      new CustomEvent("device-selected", {
        detail: {
          device: device.address,
          interfaceId: device.interface_id,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleIconError(e: Event): void {
    (e.target as HTMLImageElement).style.display = "none";
  }

  private _renderMaintenanceIcons(m: MaintenanceData) {
    if (!m || Object.keys(m).length === 0) return nothing;
    return html`
      <div class="device-status">
        ${m.unreach === true
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
            : nothing}
        ${m.low_bat === true
          ? html`<ha-icon
              class="status-badge low-bat"
              .icon=${"mdi:battery-alert"}
              title="${this._l("device_list.low_battery")}"
              aria-label="${this._l("device_list.low_battery")}"
            ></ha-icon>`
          : nothing}
        ${m.config_pending === true
          ? html`<ha-icon
              class="status-badge config-pending"
              .icon=${"mdi:clock-alert-outline"}
              title="${this._l("device_list.config_pending")}"
              aria-label="${this._l("device_list.config_pending")}"
            ></ha-icon>`
          : nothing}
      </div>
    `;
  }

  render() {
    return html`
      <div class="panel-header">
        <h1>${this._l("device_list.title")}</h1>
      </div>

      ${this.entryId
        ? html`
            <div class="search-bar">
              <ha-input
                .value=${this._searchQuery}
                @input=${(e: InputEvent) => {
                  this._searchQuery = (e.target as HTMLInputElement).value;
                }}
                .placeholder=${this._l("device_list.search_placeholder")}
                aria-label=${this._l("device_list.search_placeholder")}
              ></ha-input>
            </div>
            <div class="sort-bar">
              <span class="sort-label">${this._l("device_list.sort_by")}:</span>
              <button
                class="sort-button ${this._sortColumn === "name" ? "active" : ""}"
                @click=${() => this._setSortColumn("name")}
              >
                ${this._l("device_list.sort_name")}
                ${this._sortColumn === "name"
                  ? html`<ha-icon
                      .icon=${this._sortAsc ? "mdi:arrow-up" : "mdi:arrow-down"}
                    ></ha-icon>`
                  : nothing}
              </button>
              <button
                class="sort-button ${this._sortColumn === "address" ? "active" : ""}"
                @click=${() => this._setSortColumn("address")}
              >
                ${this._l("device_list.sort_address")}
                ${this._sortColumn === "address"
                  ? html`<ha-icon
                      .icon=${this._sortAsc ? "mdi:arrow-up" : "mdi:arrow-down"}
                    ></ha-icon>`
                  : nothing}
              </button>
              <button
                class="sort-button ${this._sortColumn === "model" ? "active" : ""}"
                @click=${() => this._setSortColumn("model")}
              >
                ${this._l("device_list.sort_model")}
                ${this._sortColumn === "model"
                  ? html`<ha-icon
                      .icon=${this._sortAsc ? "mdi:arrow-up" : "mdi:arrow-down"}
                    ></ha-icon>`
                  : nothing}
              </button>
            </div>
          `
        : nothing}
      ${this._loading
        ? html`<div class="skeleton-container">
            ${[1, 2, 3, 4, 5].map(() => html`<div class="skeleton-card"></div>`)}
          </div>`
        : this._error
          ? html`<div class="error">
              ${this._error}
              <br />
              <ha-button outlined @click=${this._fetchDevices}>
                ${this._l("common.retry")}
              </ha-button>
            </div>`
          : !this.entryId
            ? html`<div class="empty-state">${this._l("device_list.no_entry_selected")}</div>`
            : this._filteredDevices.length === 0
              ? html`<div class="empty-state">${this._l("device_list.no_devices")}</div>`
              : this._renderDeviceGroups()}
    `;
  }

  private _renderDeviceGroups() {
    return html`
      ${Array.from(this._groupedDevices.entries()).map(
        ([interfaceId, devices]) => html`
          <div class="interface-group">
            <div class="interface-header">${interfaceId}</div>
            ${devices.map(
              (device) => html`
                <div
                  class="device-card"
                  role="button"
                  tabindex="0"
                  @click=${() => this._handleDeviceClick(device)}
                  @keydown=${(e: KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      this._handleDeviceClick(device);
                    }
                  }}
                >
                  ${device.device_icon
                    ? html`<img
                        class="device-icon"
                        src=${getDeviceIconUrl(this.entryId, device.device_icon)}
                        alt=""
                        @error=${this._handleIconError}
                      />`
                    : nothing}
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
              `,
            )}
          </div>
        `,
      )}
    `;
  }

  static styles = [
    sharedStyles,
    css`
      .panel-header h1 {
        margin: 0 0 16px;
        font-size: 24px;
        font-weight: 400;
      }

      .search-bar {
        margin-bottom: 16px;
      }

      .search-bar ha-input {
        display: block;
        width: 100%;
      }

      .sort-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .sort-label {
        font-size: 13px;
        color: var(--secondary-text-color);
      }

      .sort-button {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 12px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 16px;
        background: none;
        color: var(--primary-text-color);
        font-size: 13px;
        cursor: pointer;
        transition:
          background-color 0.1s,
          border-color 0.1s;
      }

      .sort-button:hover {
        background-color: var(--secondary-background-color, #f5f5f5);
      }

      .sort-button.active {
        border-color: var(--primary-color, #03a9f4);
        color: var(--primary-color, #03a9f4);
        font-weight: 500;
      }

      .sort-button ha-icon {
        --ha-icon-display-size: 14px;
      }

      .interface-group {
        margin-bottom: 16px;
      }

      .interface-header {
        position: sticky;
        top: 0;
        z-index: 1;
        background: var(--primary-background-color, #fff);
        font-size: 14px;
        font-weight: 500;
        color: var(--secondary-text-color);
        text-transform: uppercase;
        padding: 8px 0;
        border-bottom: 1px solid var(--divider-color);
        margin-bottom: 4px;
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

      .device-main {
        flex: 1;
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

      .skeleton-container {
        padding: 8px 0;
      }

      .skeleton-card {
        height: 56px;
        border-radius: 4px;
        background: linear-gradient(
          90deg,
          var(--divider-color) 25%,
          var(--secondary-background-color) 50%,
          var(--divider-color) 75%
        );
        background-size: 200% 100%;
        animation: skeleton-pulse 1.5s ease-in-out infinite;
        margin-bottom: 4px;
      }

      @keyframes skeleton-pulse {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
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
    `,
  ];
}
