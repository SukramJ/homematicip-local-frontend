import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { listDevices } from "../api";
import { localize } from "../localize";
import type { HomeAssistant, EntryInfo, DeviceInfo, MaintenanceData } from "../types";

@safeCustomElement("hm-device-list")
export class HmDeviceList extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";
  @property({ attribute: false }) public entries: EntryInfo[] = [];

  @state() private _devices: DeviceInfo[] = [];
  @state() private _loading = false;
  @state() private _searchQuery = "";
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
      this._error = String(err);
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

  private get _groupedDevices(): Map<string, DeviceInfo[]> {
    const sorted = [...this._filteredDevices].sort((a, b) => a.name.localeCompare(b.name));
    const groups = new Map<string, DeviceInfo[]>();
    for (const device of sorted) {
      const iface = device.interface_id.split("-").slice(1).join("-") || device.interface_id;
      if (!groups.has(iface)) groups.set(iface, []);
      groups.get(iface)!.push(device);
    }
    return groups;
  }

  private _handleEntryChanged(e: Event): void {
    const select = e.target as HTMLSelectElement;
    this.dispatchEvent(
      new CustomEvent("entry-changed", {
        detail: { entryId: select.value },
        bubbles: true,
        composed: true,
      }),
    );
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

  private _renderMaintenanceIcons(m: MaintenanceData) {
    if (!m || Object.keys(m).length === 0) return nothing;
    return html`
      <div class="device-status">
        ${m.unreach === true
          ? html`<span
              class="status-badge unreachable"
              title="${this._l("device_list.unreachable")}"
              >&#x274C;</span
            >`
          : m.unreach === false
            ? html`<span class="status-badge reachable" title="${this._l("device_list.reachable")}"
                >&#x2705;</span
              >`
            : nothing}
        ${m.low_bat === true
          ? html`<span class="status-badge low-bat" title="${this._l("device_list.low_battery")}"
              >&#x1F50B;</span
            >`
          : nothing}
        ${m.config_pending === true
          ? html`<span
              class="status-badge config-pending"
              title="${this._l("device_list.config_pending")}"
              >&#x23F3;</span
            >`
          : nothing}
      </div>
    `;
  }

  render() {
    return html`
      <div class="panel-header">
        <h1>${this._l("device_list.title")}</h1>
      </div>

      ${this.entries.length > 1
        ? html`
            <div class="entry-selector">
              <label>${this._l("device_list.select_ccu")}</label>
              <select @change=${this._handleEntryChanged}>
                <option value="" ?selected=${!this.entryId}>
                  ${this._l("device_list.select_placeholder")}
                </option>
                ${this.entries.map(
                  (entry) => html`
                    <option value=${entry.entry_id} ?selected=${entry.entry_id === this.entryId}>
                      ${entry.title}
                    </option>
                  `,
                )}
              </select>
            </div>
          `
        : nothing}
      ${this.entryId
        ? html`
            <div class="search-bar">
              <input
                type="text"
                .value=${this._searchQuery}
                @input=${(e: InputEvent) => {
                  this._searchQuery = (e.target as HTMLInputElement).value;
                }}
                placeholder=${this._l("device_list.search_placeholder")}
              />
            </div>
          `
        : nothing}
      ${this._loading
        ? html`<div class="loading"><span>${this._l("common.loading")}</span></div>`
        : this._error
          ? html`<div class="error">${this._error}</div>`
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
                <div class="device-card" @click=${() => this._handleDeviceClick(device)}>
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
                  <div class="device-arrow">▸</div>
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

      .entry-selector {
        margin-bottom: 16px;
      }

      .entry-selector label {
        display: block;
        font-size: 14px;
        color: var(--secondary-text-color);
        margin-bottom: 4px;
      }

      .entry-selector select {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        font-size: 14px;
      }

      .search-bar {
        margin-bottom: 16px;
      }

      .search-bar input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        font-size: 14px;
        box-sizing: border-box;
      }

      .interface-group {
        margin-bottom: 16px;
      }

      .interface-header {
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

      .device-card:hover {
        background-color: var(--secondary-background-color, #f5f5f5);
      }

      .device-main {
        flex: 1;
      }

      .device-name {
        font-size: 14px;
        font-weight: 500;
      }

      .device-model {
        font-size: 13px;
        color: var(--secondary-text-color);
        margin-top: 2px;
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
        font-size: 14px;
        cursor: default;
      }

      .device-arrow {
        color: var(--secondary-text-color);
        font-size: 18px;
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
