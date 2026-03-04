import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { localize } from "../localize";
import { showConfirmationDialog, showToast } from "../ha-helpers";
import {
  getSystemInformation,
  createBackup,
  getHubData,
  getInstallModeStatus,
  triggerInstallMode,
  getSignalQuality,
  getFirmwareOverview,
  refreshFirmwareData,
} from "../panel-api";
import type { HomeAssistant } from "../types";
import type {
  SystemInformation,
  HubData,
  InstallModeStatus,
  SignalQualityDevice,
  FirmwareOverview,
} from "../panel-api";

@safeCustomElement("hm-ccu-dashboard")
export class HmCcuDashboard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";

  @state() private _sysInfo: SystemInformation | null = null;
  @state() private _hubData: HubData | null = null;
  @state() private _installMode: InstallModeStatus | null = null;
  @state() private _signalDevices: SignalQualityDevice[] | null = null;
  @state() private _firmware: FirmwareOverview | null = null;
  @state() private _loading = true;
  @state() private _error = "";
  @state() private _backupRunning = false;
  @state() private _refreshingFirmware = false;
  @state() private _signalSortColumn: "name" | "rssi_device" | "signal_strength" = "name";
  @state() private _signalSortAsc = true;
  @state() private _firmwareSortColumn: "name" | "firmware" | "firmware_update_state" = "name";
  @state() private _firmwareSortAsc = true;

  updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has("entryId") && this.entryId) {
      this._fetchAll();
    }
  }

  private async _fetchAll(): Promise<void> {
    if (!this.entryId) return;
    this._loading = true;
    this._error = "";
    try {
      const [sysInfo, hubData, installMode, signalDevices, firmware] = await Promise.all([
        getSystemInformation(this.hass, this.entryId),
        getHubData(this.hass, this.entryId),
        getInstallModeStatus(this.hass, this.entryId),
        getSignalQuality(this.hass, this.entryId),
        getFirmwareOverview(this.hass, this.entryId),
      ]);
      this._sysInfo = sysInfo;
      this._hubData = hubData;
      this._installMode = installMode;
      this._signalDevices = signalDevices;
      this._firmware = firmware;
    } catch (err) {
      this._error = String(err);
    } finally {
      this._loading = false;
    }
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private async _handleCreateBackup(): Promise<void> {
    const confirmed = await showConfirmationDialog(this, {
      title: this._l("ccu.create_backup_title"),
      text: this._l("ccu.create_backup_text"),
      confirmText: this._l("ccu.create_backup"),
      dismissText: this._l("common.cancel"),
    });
    if (!confirmed) return;

    this._backupRunning = true;
    try {
      const result = await createBackup(this.hass, this.entryId);
      if (result.success) {
        const sizeMB = (result.size / 1024 / 1024).toFixed(1);
        showToast(this, {
          message: this._l("ccu.backup_success", { filename: result.filename, size: sizeMB }),
        });
      }
    } catch {
      showToast(this, { message: this._l("ccu.backup_failed") });
    } finally {
      this._backupRunning = false;
    }
  }

  private async _handleTriggerInstallMode(iface: "hmip" | "bidcos"): Promise<void> {
    const label = iface === "hmip" ? "HmIP-RF" : "BidCos-RF";
    const confirmed = await showConfirmationDialog(this, {
      title: this._l("ccu.install_mode_title"),
      text: this._l("ccu.install_mode_text", { interface: label }),
      confirmText: this._l("ccu.activate"),
      dismissText: this._l("common.cancel"),
    });
    if (!confirmed) return;

    try {
      await triggerInstallMode(this.hass, this.entryId, iface);
      showToast(this, { message: this._l("ccu.install_mode_activated", { interface: label }) });
      this._installMode = await getInstallModeStatus(this.hass, this.entryId);
    } catch {
      showToast(this, { message: this._l("ccu.action_failed") });
    }
  }

  private async _handleRefreshFirmware(): Promise<void> {
    this._refreshingFirmware = true;
    try {
      await refreshFirmwareData(this.hass, this.entryId);
      showToast(this, { message: this._l("ccu.firmware_refreshed") });
      this._firmware = await getFirmwareOverview(this.hass, this.entryId);
    } catch {
      showToast(this, { message: this._l("ccu.action_failed") });
    } finally {
      this._refreshingFirmware = false;
    }
  }

  render() {
    if (!this.entryId) {
      return html`<div class="empty-state">${this._l("device_list.no_entry_selected")}</div>`;
    }

    if (this._loading) {
      return html`<div class="loading">${this._l("common.loading")}</div>`;
    }

    if (this._error) {
      return html`<div class="error">${this._error}</div>`;
    }

    return html`
      ${this._renderSystemInfoCard()} ${this._renderHubDataCard()} ${this._renderInstallModeCard()}
      ${this._renderSignalQualityCard()} ${this._renderFirmwareCard()} ${this._renderActionsCard()}
    `;
  }

  private _renderSystemInfoCard() {
    if (!this._sysInfo) return nothing;
    const info = this._sysInfo;

    return html`
      <ha-card>
        <div class="card-header">${this._l("ccu.system_information")}</div>
        <div class="card-content">
          <div class="kv-grid">
            <div class="kv-item">
              <span class="kv-label">${this._l("ccu.name")}</span>
              <span class="kv-value">${info.name}</span>
            </div>
            ${info.model
              ? html`
                  <div class="kv-item">
                    <span class="kv-label">${this._l("ccu.model")}</span>
                    <span class="kv-value">${info.model}</span>
                  </div>
                `
              : nothing}
            ${info.version
              ? html`
                  <div class="kv-item">
                    <span class="kv-label">${this._l("ccu.version")}</span>
                    <span class="kv-value">${info.version}</span>
                  </div>
                `
              : nothing}
            ${info.serial
              ? html`
                  <div class="kv-item">
                    <span class="kv-label">${this._l("ccu.serial")}</span>
                    <span class="kv-value">${info.serial}</span>
                  </div>
                `
              : nothing}
            <div class="kv-item">
              <span class="kv-label">${this._l("ccu.hostname")}</span>
              <span class="kv-value">${info.hostname}</span>
            </div>
            ${info.ccu_type
              ? html`
                  <div class="kv-item">
                    <span class="kv-label">${this._l("ccu.ccu_type")}</span>
                    <span class="kv-value">${info.ccu_type}</span>
                  </div>
                `
              : nothing}
            <div class="kv-item">
              <span class="kv-label">${this._l("ccu.interfaces")}</span>
              <span class="kv-value">${info.available_interfaces.join(", ")}</span>
            </div>
            ${info.auth_enabled !== null
              ? html`
                  <div class="kv-item">
                    <span class="kv-label">${this._l("ccu.auth_enabled")}</span>
                    <span class="kv-value"
                      >${info.auth_enabled ? this._l("common.yes") : this._l("common.no")}</span
                    >
                  </div>
                `
              : nothing}
          </div>
          <div class="status-badges">
            ${info.has_system_update
              ? html`<span class="status-badge update-available"
                  >${this._l("ccu.update_available")}</span
                >`
              : nothing}
            ${info.has_backup
              ? html`<span class="status-badge has-backup">${this._l("ccu.backup_exists")}</span>`
              : nothing}
          </div>
        </div>
      </ha-card>
    `;
  }

  private _renderHubDataCard() {
    if (!this._hubData) return nothing;

    return html`
      <ha-card>
        <div class="card-header">${this._l("ccu.hub_messages")}</div>
        <div class="card-content">
          <div class="stat-grid">
            <div class="stat-item ${(this._hubData.service_messages ?? 0) > 0 ? "warning" : ""}">
              <span class="stat-value">${this._hubData.service_messages ?? "—"}</span>
              <span class="stat-label">${this._l("ccu.service_messages")}</span>
            </div>
            <div class="stat-item ${(this._hubData.alarm_messages ?? 0) > 0 ? "error" : ""}">
              <span class="stat-value">${this._hubData.alarm_messages ?? "—"}</span>
              <span class="stat-label">${this._l("ccu.alarm_messages")}</span>
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  private _renderInstallModeCard() {
    if (!this._installMode) return nothing;

    return html`
      <ha-card>
        <div class="card-header">${this._l("ccu.install_mode")}</div>
        <div class="card-content">
          <div class="install-mode-grid">
            <div class="install-mode-item">
              <div class="install-mode-header">
                <span class="install-mode-label">HmIP-RF</span>
                <span class="install-mode-status ${this._installMode.hmip.active ? "active" : ""}">
                  ${this._installMode.hmip.active ? this._l("ccu.active") : this._l("ccu.inactive")}
                </span>
              </div>
              ${this._installMode.hmip.active && this._installMode.hmip.remaining_seconds !== null
                ? html`<span class="install-mode-remaining"
                    >${this._l("ccu.remaining_seconds", {
                      seconds: this._installMode.hmip.remaining_seconds,
                    })}</span
                  >`
                : nothing}
              ${!this._installMode.hmip.active
                ? html`
                    <ha-button @click=${() => this._handleTriggerInstallMode("hmip")}>
                      ${this._l("ccu.activate")}
                    </ha-button>
                  `
                : nothing}
            </div>
            <div class="install-mode-item">
              <div class="install-mode-header">
                <span class="install-mode-label">BidCos-RF</span>
                <span
                  class="install-mode-status ${this._installMode.bidcos.active ? "active" : ""}"
                >
                  ${this._installMode.bidcos.active
                    ? this._l("ccu.active")
                    : this._l("ccu.inactive")}
                </span>
              </div>
              ${this._installMode.bidcos.active &&
              this._installMode.bidcos.remaining_seconds !== null
                ? html`<span class="install-mode-remaining"
                    >${this._l("ccu.remaining_seconds", {
                      seconds: this._installMode.bidcos.remaining_seconds,
                    })}</span
                  >`
                : nothing}
              ${!this._installMode.bidcos.active
                ? html`
                    <ha-button @click=${() => this._handleTriggerInstallMode("bidcos")}>
                      ${this._l("ccu.activate")}
                    </ha-button>
                  `
                : nothing}
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  private _renderSignalQualityCard() {
    if (!this._signalDevices || this._signalDevices.length === 0) return nothing;

    const sorted = [...this._signalDevices].sort((a, b) => {
      const col = this._signalSortColumn;
      let cmp = 0;
      if (col === "name") {
        cmp = a.name.localeCompare(b.name);
      } else {
        const va = a[col] ?? -999;
        const vb = b[col] ?? -999;
        cmp = (va as number) - (vb as number);
      }
      return this._signalSortAsc ? cmp : -cmp;
    });

    return html`
      <ha-card>
        <div class="card-header">${this._l("ccu.signal_quality")}</div>
        <div class="card-content table-wrapper">
          <table>
            <thead>
              <tr>
                <th @click=${() => this._toggleSignalSort("name")}>
                  ${this._l("ccu.device")} ${this._sortIcon("signal", "name")}
                </th>
                <th>${this._l("ccu.model")}</th>
                <th>${this._l("ccu.interface")}</th>
                <th>${this._l("ccu.reachable")}</th>
                <th @click=${() => this._toggleSignalSort("rssi_device")}>
                  RSSI ${this._sortIcon("signal", "rssi_device")}
                </th>
                <th @click=${() => this._toggleSignalSort("signal_strength")}>
                  ${this._l("ccu.signal")} ${this._sortIcon("signal", "signal_strength")}
                </th>
                <th>${this._l("ccu.battery")}</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(
                (dev) => html`
                  <tr class="${dev.is_reachable ? "" : "unreachable-row"}">
                    <td class="device-name">${dev.name}</td>
                    <td>${dev.model}</td>
                    <td>${dev.interface_id}</td>
                    <td>
                      <span class="status-dot ${dev.is_reachable ? "online" : "offline"}"></span>
                    </td>
                    <td>${dev.rssi_device ?? "—"}</td>
                    <td>${dev.signal_strength !== null ? `${dev.signal_strength}%` : "—"}</td>
                    <td>
                      ${dev.low_battery === null
                        ? "—"
                        : dev.low_battery
                          ? html`<span class="warn-text">${this._l("ccu.low")}</span>`
                          : this._l("ccu.ok")}
                    </td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </ha-card>
    `;
  }

  private _renderFirmwareCard() {
    if (!this._firmware) return nothing;

    const sorted = [...this._firmware.devices].sort((a, b) => {
      const col = this._firmwareSortColumn;
      const cmp = String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
      return this._firmwareSortAsc ? cmp : -cmp;
    });

    return html`
      <ha-card>
        <div class="card-header">
          <span>${this._l("ccu.firmware_overview")}</span>
          ${this._firmware.summary.firmware_updatable > 0
            ? html`<span class="badge"
                >${this._firmware.summary.firmware_updatable} ${this._l("ccu.updatable")}</span
              >`
            : nothing}
        </div>
        <div class="card-content table-wrapper">
          <div class="action-bar">
            <ha-button @click=${this._handleRefreshFirmware} .disabled=${this._refreshingFirmware}>
              ${this._refreshingFirmware
                ? this._l("common.loading")
                : this._l("ccu.refresh_firmware")}
            </ha-button>
          </div>
          <table>
            <thead>
              <tr>
                <th @click=${() => this._toggleFirmwareSort("name")}>
                  ${this._l("ccu.device")} ${this._sortIcon("firmware", "name")}
                </th>
                <th>${this._l("ccu.model")}</th>
                <th @click=${() => this._toggleFirmwareSort("firmware")}>
                  ${this._l("ccu.current_fw")} ${this._sortIcon("firmware", "firmware")}
                </th>
                <th>${this._l("ccu.available_fw")}</th>
                <th @click=${() => this._toggleFirmwareSort("firmware_update_state")}>
                  ${this._l("ccu.state")} ${this._sortIcon("firmware", "firmware_update_state")}
                </th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(
                (dev) => html`
                  <tr class="${dev.firmware_updatable ? "updatable-row" : ""}">
                    <td class="device-name">${dev.name}</td>
                    <td>${dev.model}</td>
                    <td>${dev.firmware}</td>
                    <td>${dev.available_firmware ?? "—"}</td>
                    <td>
                      <span class="fw-state ${dev.firmware_updatable ? "updatable" : ""}">
                        ${dev.firmware_update_state}
                      </span>
                    </td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </ha-card>
    `;
  }

  private _renderActionsCard() {
    return html`
      <ha-card>
        <div class="card-header">${this._l("ccu.actions")}</div>
        <div class="card-content">
          <div class="action-buttons">
            <ha-button @click=${this._fetchAll}>${this._l("ccu.refresh")}</ha-button>
            <ha-button @click=${this._handleCreateBackup} .disabled=${this._backupRunning}>
              ${this._backupRunning ? this._l("ccu.backup_running") : this._l("ccu.create_backup")}
            </ha-button>
          </div>
        </div>
      </ha-card>
    `;
  }

  private _toggleSignalSort(col: "name" | "rssi_device" | "signal_strength"): void {
    if (this._signalSortColumn === col) {
      this._signalSortAsc = !this._signalSortAsc;
    } else {
      this._signalSortColumn = col;
      this._signalSortAsc = true;
    }
  }

  private _toggleFirmwareSort(col: "name" | "firmware" | "firmware_update_state"): void {
    if (this._firmwareSortColumn === col) {
      this._firmwareSortAsc = !this._firmwareSortAsc;
    } else {
      this._firmwareSortColumn = col;
      this._firmwareSortAsc = true;
    }
  }

  private _sortIcon(table: "signal" | "firmware", col: string): string {
    const activeCol = table === "signal" ? this._signalSortColumn : this._firmwareSortColumn;
    const asc = table === "signal" ? this._signalSortAsc : this._firmwareSortAsc;
    if (activeCol !== col) return "";
    return asc ? " \u25B2" : " \u25BC";
  }

  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      ha-card {
        border-radius: var(--ha-card-border-radius, 12px);
        background: var(--ha-card-background, var(--card-background-color, #fff));
        box-shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0, 0, 0, 0.1));
        overflow: hidden;
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .badge {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 12px;
        background: var(--primary-color);
        color: #fff;
      }

      .kv-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
      }

      .kv-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .kv-label {
        font-size: 12px;
        color: var(--secondary-text-color);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .kv-value {
        font-size: 16px;
        font-weight: 500;
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 16px;
      }

      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px;
        border-radius: 8px;
        background: var(--secondary-background-color);
      }

      .stat-item.warning {
        background: rgba(var(--rgb-amber, 255, 152, 0), 0.1);
      }

      .stat-item.error {
        background: rgba(var(--rgb-red, 244, 67, 54), 0.1);
      }

      .stat-value {
        font-size: 28px;
        font-weight: 500;
      }

      .stat-label {
        font-size: 12px;
        color: var(--secondary-text-color);
        text-transform: uppercase;
        margin-top: 4px;
      }

      .status-badges {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        flex-wrap: wrap;
      }

      .status-badge {
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: 500;
      }

      .status-badge.update-available {
        background: rgba(var(--rgb-blue, 33, 150, 243), 0.15);
        color: var(--info-color, #2196f3);
      }

      .status-badge.has-backup {
        background: rgba(var(--rgb-green, 76, 175, 80), 0.15);
        color: var(--success-color, #4caf50);
      }

      .install-mode-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
      }

      .install-mode-item {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        border-radius: 8px;
        background: var(--secondary-background-color);
      }

      .install-mode-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .install-mode-label {
        font-weight: 500;
      }

      .install-mode-status {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 8px;
        background: var(--secondary-background-color);
      }

      .install-mode-status.active {
        background: rgba(var(--rgb-green, 76, 175, 80), 0.15);
        color: var(--success-color, #4caf50);
      }

      .install-mode-remaining {
        font-size: 13px;
        color: var(--secondary-text-color);
      }

      .table-wrapper {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      thead th {
        text-align: left;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 500;
        color: var(--secondary-text-color);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 2px solid var(--divider-color);
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
      }

      tbody td {
        padding: 8px 12px;
        border-bottom: 1px solid var(--divider-color);
      }

      tbody tr:last-child td {
        border-bottom: none;
      }

      tbody tr:hover {
        background: var(--secondary-background-color);
      }

      .device-name {
        font-weight: 500;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .unreachable-row {
        opacity: 0.6;
      }

      .updatable-row {
        background: rgba(var(--rgb-blue, 33, 150, 243), 0.05);
      }

      .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .status-dot.online {
        background: var(--success-color, #4caf50);
      }

      .status-dot.offline {
        background: var(--error-color, #db4437);
      }

      .warn-text {
        color: var(--warning-color, #ff9800);
      }

      .fw-state.updatable {
        color: var(--info-color, #2196f3);
        font-weight: 500;
      }

      .action-bar {
        margin-bottom: 12px;
      }

      .action-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      @media (max-width: 600px) {
        .kv-grid {
          grid-template-columns: 1fr 1fr;
        }

        .install-mode-grid {
          grid-template-columns: 1fr;
        }

        table {
          font-size: 12px;
        }

        thead th,
        tbody td {
          padding: 6px 8px;
        }

        .device-name {
          max-width: 120px;
        }
      }
    `,
  ];
}
