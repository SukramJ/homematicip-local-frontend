import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import {
  listDevices,
  getDeviceIconUrl,
  exportParamset,
  importParamset,
  listScheduleDevices,
  LINKABLE_INTERFACES,
} from "../api";
import { localize } from "../localize";
import { showConfirmationDialog, showToast } from "../ha-helpers";
import type { HomeAssistant, DeviceInfo, ChannelInfo, MaintenanceData } from "../types";

@safeCustomElement("hm-device-detail")
export class HmDeviceDetail extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";
  @property() public interfaceId = "";
  @property() public deviceAddress = "";

  @state() private _device: DeviceInfo | null = null;
  @state() private _hasSchedule = false;
  @state() private _loading = true;
  @state() private _error = "";

  updated(changedProps: Map<string, unknown>): void {
    if (
      (changedProps.has("entryId") || changedProps.has("deviceAddress")) &&
      this.entryId &&
      this.deviceAddress
    ) {
      this._fetchDevice();
    }
  }

  private async _fetchDevice(): Promise<void> {
    this._loading = true;
    this._error = "";
    try {
      const [devices, scheduleDevices] = await Promise.all([
        listDevices(this.hass, this.entryId),
        listScheduleDevices(this.hass, this.entryId).catch(() => []),
      ]);
      this._device = devices.find((d) => d.address === this.deviceAddress) ?? null;
      this._hasSchedule = scheduleDevices.some((sd) => sd.address === this.deviceAddress);
    } catch (err) {
      this._error = String(err);
    } finally {
      this._loading = false;
    }
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private _handleBack(): void {
    this.dispatchEvent(new CustomEvent("back", { bubbles: true, composed: true }));
  }

  private _handleChannelClick(channel: ChannelInfo): void {
    this.dispatchEvent(
      new CustomEvent("channel-selected", {
        detail: {
          channel: channel.address,
          interfaceId: this.interfaceId,
          channelType: channel.channel_type,
          paramsetKey: "MASTER",
          deviceName: this._device?.name || this.deviceAddress,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleShowHistory(): void {
    this.dispatchEvent(
      new CustomEvent("show-history", {
        detail: { device: this.deviceAddress },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleShowLinks(): void {
    this.dispatchEvent(
      new CustomEvent("show-links", {
        detail: {
          device: this.deviceAddress,
          interfaceId: this.interfaceId,
          deviceName: this._device?.name || this.deviceAddress,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleShowSchedules(): void {
    this.dispatchEvent(
      new CustomEvent("show-schedules", {
        detail: {
          device: this.deviceAddress,
          interfaceId: this.interfaceId,
          deviceName: this._device?.name || this.deviceAddress,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async _handleExport(channel: ChannelInfo): Promise<void> {
    try {
      const result = await exportParamset(
        this.hass,
        this.entryId,
        this.interfaceId,
        channel.address,
        "MASTER",
      );
      const blob = new Blob([result.json_data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${channel.address.replace(/:/g, "_")}_MASTER.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(this, { message: this._l("device_detail.export_success") });
    } catch {
      showToast(this, { message: this._l("device_detail.export_failed") });
    }
  }

  private async _handleImport(channel: ChannelInfo): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const jsonData = await file.text();
        const confirmed = await showConfirmationDialog(this, {
          title: this._l("device_detail.import_confirm_title"),
          text: this._l("device_detail.import_confirm_text", { channel: channel.address }),
          confirmText: this._l("device_detail.import"),
          dismissText: this._l("common.cancel"),
        });
        if (!confirmed) return;

        const result = await importParamset(
          this.hass,
          this.entryId,
          this.interfaceId,
          channel.address,
          jsonData,
          "MASTER",
        );
        if (result.success) {
          showToast(this, { message: this._l("device_detail.import_success") });
        } else {
          showToast(this, { message: this._l("device_detail.import_validation_failed") });
        }
      } catch {
        showToast(this, { message: this._l("device_detail.import_failed") });
      }
    };
    input.click();
  }

  private _handleIconError(e: Event): void {
    (e.target as HTMLImageElement).style.display = "none";
  }

  render() {
    if (this._loading) {
      return html`<div class="loading">${this._l("common.loading")}</div>`;
    }
    if (this._error) {
      return html`<div class="error">${this._error}</div>`;
    }
    if (!this._device) {
      return html`<div class="empty-state">${this._l("device_detail.not_found")}</div>`;
    }

    const device = this._device;
    const deviceChannel = device.channels.find((c) => !c.address.includes(":"));
    const ch0 = device.channels.find((c) => c.address.endsWith(":0"));
    const otherChannels = device.channels.filter(
      (c) => c.address.includes(":") && !c.address.endsWith(":0"),
    );

    return html`
      <ha-icon-button
        class="back-button"
        .path=${"M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"}
        @click=${this._handleBack}
        .label=${this._l("common.back")}
      ></ha-icon-button>

      <div class="device-header">
        ${device.device_icon
          ? html`<img
              class="device-icon"
              src=${getDeviceIconUrl(this.entryId, device.device_icon)}
              alt=""
              @error=${this._handleIconError}
            />`
          : nothing}
        <div class="device-header-text">
          <h2>${device.model} — ${device.name}</h2>
          <div class="device-info">
            ${this._l("device_detail.address")}: ${device.address} |
            ${this._l("device_detail.firmware")}: ${device.firmware}
          </div>
        </div>
        <div class="header-actions">
          ${LINKABLE_INTERFACES.has(device.interface)
            ? html`
                <ha-button outlined @click=${this._handleShowLinks}>
                  ${this._l("device_detail.show_links")}
                </ha-button>
              `
            : nothing}
          ${this._hasSchedule
            ? html`
                <ha-button outlined @click=${this._handleShowSchedules}>
                  ${this._l("device_detail.show_schedules")}
                </ha-button>
              `
            : nothing}
          <ha-button outlined @click=${this._handleShowHistory}>
            ${this._l("device_detail.show_history")}
          </ha-button>
        </div>
      </div>

      ${deviceChannel ? this._renderDeviceChannel(deviceChannel) : nothing}
      ${ch0 ? this._renderMaintenanceChannel(ch0, device.maintenance) : nothing}
      ${otherChannels.map((ch) => this._renderChannel(ch))}
    `;
  }

  private _renderDeviceChannel(channel: ChannelInfo) {
    const hasMaster = channel.paramset_keys.includes("MASTER");
    if (!hasMaster) return nothing;

    return html`
      <div class="channel-card device-channel">
        <div class="channel-header">
          ${this._l("device_detail.device_config")}: ${channel.channel_type_label}
        </div>
        <div class="channel-actions">
          <ha-button outlined @click=${() => this._handleChannelClick(channel)}>
            <ha-icon slot="icon" .icon=${"mdi:cog"}></ha-icon>
            ${this._l("device_detail.configure_master")}
          </ha-button>
          <ha-icon-button
            .path=${"M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"}
            @click=${() => this._handleExport(channel)}
            .label=${this._l("device_detail.export")}
          ></ha-icon-button>
          <ha-icon-button
            .path=${"M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z"}
            @click=${() => this._handleImport(channel)}
            .label=${this._l("device_detail.import")}
          ></ha-icon-button>
        </div>
      </div>
    `;
  }

  private _renderMaintenanceChannel(channel: ChannelInfo, maintenance: MaintenanceData) {
    const hasStatus = maintenance && Object.keys(maintenance).length > 0;
    const hasMaster = channel.paramset_keys.includes("MASTER");

    return html`
      <div class="channel-card maintenance">
        <div class="channel-header">
          ${this._l("device_detail.channel")} 0: ${channel.channel_type_label}
        </div>
        ${hasStatus ? this._renderStatusSummary(maintenance) : nothing}
        ${hasMaster
          ? html`
              <div class="channel-actions">
                <ha-button outlined @click=${() => this._handleChannelClick(channel)}>
                  <ha-icon slot="icon" .icon=${"mdi:cog"}></ha-icon>
                  ${this._l("device_detail.configure_master")}
                </ha-button>
                <ha-icon-button
                  .path=${"M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"}
                  @click=${() => this._handleExport(channel)}
                  .label=${this._l("device_detail.export")}
                ></ha-icon-button>
                <ha-icon-button
                  .path=${"M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z"}
                  @click=${() => this._handleImport(channel)}
                  .label=${this._l("device_detail.import")}
                ></ha-icon-button>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderStatusSummary(m: MaintenanceData) {
    const items: { label: string; value: string; icon: string }[] = [];

    if (m.rssi_device !== undefined) {
      items.push({
        label: this._l("device_detail.rssi_device"),
        value: `${m.rssi_device} dBm`,
        icon: "mdi:signal",
      });
    }
    if (m.rssi_peer !== undefined) {
      items.push({
        label: this._l("device_detail.rssi_peer"),
        value: `${m.rssi_peer} dBm`,
        icon: "mdi:signal",
      });
    }
    if (m.dutycycle !== undefined) {
      items.push({
        label: this._l("device_detail.dutycycle"),
        value: String(m.dutycycle),
        icon: "mdi:timer-outline",
      });
    }
    if (m.low_bat !== undefined) {
      items.push({
        label: this._l("device_detail.low_bat"),
        value: m.low_bat ? this._l("device_detail.yes") : this._l("device_detail.no"),
        icon: "mdi:battery-alert",
      });
    }
    if (m.unreach !== undefined) {
      items.push({
        label: this._l("device_detail.unreach"),
        value: m.unreach
          ? this._l("device_detail.unreachable")
          : this._l("device_detail.reachable"),
        icon: m.unreach ? "mdi:close-circle" : "mdi:check-circle",
      });
    }
    if (m.config_pending !== undefined) {
      items.push({
        label: this._l("device_detail.config_pending_label"),
        value: m.config_pending ? this._l("device_detail.yes") : this._l("device_detail.no"),
        icon: "mdi:information-outline",
      });
    }

    if (items.length === 0) return nothing;

    return html`
      <div class="status-grid">
        ${items.map(
          (item) => html`
            <div class="status-item">
              <ha-icon class="status-icon" .icon=${item.icon}></ha-icon>
              <span>${item.label}: ${item.value}</span>
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderChannel(channel: ChannelInfo) {
    const channelNo = channel.address.split(":").pop() ?? "";
    const hasMaster = channel.paramset_keys.includes("MASTER");

    return html`
      <div class="channel-card">
        <div class="channel-header">
          ${this._l("device_detail.channel")} ${channelNo}: ${channel.channel_type_label}
        </div>
        ${hasMaster
          ? html`
              <div class="channel-actions">
                <ha-button outlined @click=${() => this._handleChannelClick(channel)}>
                  <ha-icon slot="icon" .icon=${"mdi:cog"}></ha-icon>
                  ${this._l("device_detail.configure_master")}
                </ha-button>
                <ha-icon-button
                  .path=${"M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"}
                  @click=${() => this._handleExport(channel)}
                  .label=${this._l("device_detail.export")}
                ></ha-icon-button>
                <ha-icon-button
                  .path=${"M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z"}
                  @click=${() => this._handleImport(channel)}
                  .label=${this._l("device_detail.import")}
                ></ha-icon-button>
              </div>
            `
          : html`
              <div class="channel-no-config">${this._l("device_detail.no_master_config")}</div>
            `}
      </div>
    `;
  }

  static styles = [
    sharedStyles,
    css`
      .back-button {
        margin-bottom: 8px;
      }

      .device-header {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .device-icon {
        height: 48px;
        width: 48px;
        object-fit: contain;
        flex-shrink: 0;
      }

      .device-header-text {
        flex: 1;
        min-width: 0;
      }

      .device-header-text h2 {
        margin: 8px 0 4px;
        font-size: 20px;
        font-weight: 400;
      }

      .header-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        flex-wrap: wrap;
      }

      .channel-card {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        margin-bottom: 12px;
        overflow: hidden;
      }

      .channel-card.device-channel {
        border-color: var(--primary-color, #03a9f4);
      }

      .channel-card.maintenance {
        border-color: var(--primary-color, #03a9f4);
      }

      .channel-header {
        font-size: 14px;
        font-weight: 500;
        padding: 12px 16px;
        background: var(--secondary-background-color, #fafafa);
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
      }

      .channel-actions {
        padding: 8px 16px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }

      .channel-no-config {
        padding: 8px 16px;
        color: var(--secondary-text-color);
        font-size: 13px;
      }

      .status-icon {
        --mdc-icon-size: 20px;
        color: var(--secondary-text-color);
      }
    `,
  ];
}
