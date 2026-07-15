import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { listDevices } from "../api";
import { localize } from "../localize";
import "../components/device-row";
import "../components/interface-header";
import type { HomeAssistant, DeviceInfo } from "../types";

/**
 * Below this many devices the plain (non-virtualized) list is used: virtualizing
 * needs a fixed-height scroll container, which costs the sticky interface headers
 * and the page-level scrolling, and buys nothing at small device counts.
 */
const VIRTUALIZE_THRESHOLD = 100;

type DeviceListRow =
  | { id: string; type: "header"; label: string; interactive: false }
  | { id: string; type: "device"; device: DeviceInfo; interactive: true };

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

  /** Groups and devices flattened into one row list for the virtualizer. */
  private get _rows(): DeviceListRow[] {
    const rows: DeviceListRow[] = [];
    for (const [interfaceId, devices] of this._groupedDevices) {
      rows.push({
        id: `header:${interfaceId}`,
        type: "header",
        label: interfaceId,
        interactive: false,
      });
      for (const device of devices) {
        rows.push({
          id: `device:${device.interface_id}:${device.address}`,
          type: "device",
          device,
          interactive: true,
        });
      }
    }
    return rows;
  }

  /**
   * `ha-list-virtualized` only exists from HA 2026.7 on. Falling back to the plain
   * list keeps the panel working on older versions instead of rendering an unknown
   * element (which would leave the list silently empty).
   */
  private get _canVirtualize(): boolean {
    return (
      customElements.get("ha-list-virtualized") !== undefined &&
      this._filteredDevices.length > VIRTUALIZE_THRESHOLD
    );
  }

  render() {
    return html`
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
              : this._canVirtualize
                ? this._renderVirtualizedDevices()
                : this._renderDeviceGroups()}
    `;
  }

  private _rowRenderer = (row: DeviceListRow, index: number): TemplateResult => {
    if (row.type === "header") {
      return html`<hm-interface-header
        .label=${row.label}
        ?spaced=${index > 0}
      ></hm-interface-header>`;
    }
    return html`<hm-device-row
      .hass=${this.hass}
      .entryId=${this.entryId}
      .device=${row.device}
    ></hm-device-row>`;
  };

  private _renderVirtualizedDevices() {
    return html`
      <ha-card class="device-list-card">
        <ha-list-virtualized
          class="device-rows"
          .rows=${this._rows}
          .rowRenderer=${this._rowRenderer}
        ></ha-list-virtualized>
      </ha-card>
    `;
  }

  private _renderDeviceGroups() {
    return html`
      ${Array.from(this._groupedDevices.entries()).map(
        ([interfaceId, devices]) => html`
          <ha-card class="interface-group">
            <hm-interface-header sticky .label=${interfaceId}></hm-interface-header>
            ${devices.map(
              (device) => html`
                <hm-device-row
                  .hass=${this.hass}
                  .entryId=${this.entryId}
                  .device=${device}
                ></hm-device-row>
              `,
            )}
          </ha-card>
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

      /* Rounds off the hover fill and the divider of the last row, which would
         otherwise paint over the card's bottom corners. The card itself cannot clip:
         that would make it a scroll container and break the sticky header. */
      .interface-group hm-device-row:last-child {
        overflow: hidden;
        border-end-start-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg, 16px));
        border-end-end-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg, 16px));
      }

      /* The virtualizer brings its own scroll container, so this card can clip. */
      .device-list-card {
        overflow: hidden;
      }

      /* The virtualizer needs a bounded height; the page itself no longer scrolls
         the list in this mode. Sized to leave room for the header, search and sort bars. */
      .device-rows {
        display: block;
        height: calc(100vh - 260px);
        min-height: 320px;
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
    `,
  ];
}
