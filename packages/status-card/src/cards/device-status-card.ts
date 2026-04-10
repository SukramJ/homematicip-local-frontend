import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, DeviceInfo } from "@hmip/panel-api";
import { listDevices } from "@hmip/panel-api";
import { cardStyles } from "../styles";
import { getStatusTranslations, type StatusCardTranslations } from "../localization";

export type DeviceFilter = "all" | "problems" | "unreachable" | "low_battery" | "config_pending";

export interface DeviceStatusCardConfig {
  entry_id: string;
  title?: string;
  filter?: DeviceFilter;
  show_model?: boolean;
  max_devices?: number;
  poll_interval?: number;
  interface_filter?: string;
}

interface DeviceRow {
  device: DeviceInfo;
  issues: string[];
  severity: "error" | "warning" | "ok";
}

@customElement("homematicip-device-status-card")
export class HomematicipDeviceStatusCard extends LitElement {
  static styles = cardStyles;

  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private _config?: DeviceStatusCardConfig;
  @state() private _devices: DeviceRow[] = [];
  @state() private _totalDevices = 0;
  @state() private _problemCount = 0;
  @state() private _loading = true;
  @state() private _error = "";

  private _pollTimer?: ReturnType<typeof setTimeout>;
  private _t!: StatusCardTranslations;

  setConfig(config: DeviceStatusCardConfig): void {
    this._config = {
      filter: "problems",
      show_model: true,
      max_devices: 10,
      poll_interval: 60,
      ...config,
    };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._fetchData();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopPolling();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has("hass") && this.hass) {
      this._t = getStatusTranslations(this.hass.config.language);
    }
  }

  private _startPolling(): void {
    this._stopPolling();
    const interval = (this._config?.poll_interval ?? 60) * 1000;
    this._pollTimer = setTimeout(() => this._fetchData(), interval);
  }

  private _stopPolling(): void {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = undefined;
    }
  }

  private async _fetchData(): Promise<void> {
    if (!this.hass || !this._config || !this._config.entry_id) return;

    try {
      let devices = await listDevices(this.hass, this._config.entry_id);

      if (this._config.interface_filter) {
        devices = devices.filter((d) => d.interface_id === this._config!.interface_filter);
      }

      this._totalDevices = devices.length;
      this._devices = this._filterDevices(devices);
      this._problemCount = this._devices.filter((d) => d.severity !== "ok").length;
      this._error = "";
    } catch (err) {
      this._error = String(err);
    } finally {
      this._loading = false;
    }

    this._startPolling();
  }

  private _filterDevices(devices: DeviceInfo[]): DeviceRow[] {
    const filter = this._config?.filter ?? "problems";
    const rows: DeviceRow[] = [];

    for (const device of devices) {
      const m = device.maintenance;
      const issues: string[] = [];
      let severity: "error" | "warning" | "ok" = "ok";

      if (m.unreach && (filter === "all" || filter === "problems" || filter === "unreachable")) {
        issues.push(this._t?.notReachable ?? "Not reachable");
        severity = "error";
      }

      if (m.low_bat && (filter === "all" || filter === "problems" || filter === "low_battery")) {
        issues.push(this._t?.lowBattery ?? "Low battery");
        if (severity === "ok") severity = "warning";
      }

      if (
        m.config_pending &&
        (filter === "all" || filter === "problems" || filter === "config_pending")
      ) {
        issues.push(this._t?.configPending ?? "Config pending");
        if (severity === "ok") severity = "warning";
      }

      // For "all" filter: include every device. For other filters: only devices with issues.
      if (filter === "all" || issues.length > 0) {
        rows.push({ device, issues, severity });
      }
    }

    // Sort: errors first, then warnings, then ok, then alphabetically
    const severityOrder: Record<string, number> = { error: 0, warning: 1, ok: 2 };
    rows.sort((a, b) => {
      const s = severityOrder[a.severity] - severityOrder[b.severity];
      if (s !== 0) return s;
      return a.device.name.localeCompare(b.device.name);
    });

    const max = this._config?.max_devices ?? 10;
    return max > 0 ? rows.slice(0, max) : rows;
  }

  protected render() {
    if (!this._config || !this._t) return nothing;

    const title = this._config.title ?? this._t.deviceStatus;

    if (this._loading) {
      return html`
        <ha-card>
          <div class="card-header">${title}</div>
          <div class="loading"><ha-circular-progress indeterminate></ha-circular-progress></div>
        </ha-card>
      `;
    }

    if (this._error && this._totalDevices === 0) {
      return html`
        <ha-card>
          <div class="card-header">${title}</div>
          <div class="error-msg">${this._t.error}</div>
        </ha-card>
      `;
    }

    return html`
      <ha-card>
        <div class="card-header">
          ${title}
          <div class="badges">
            ${this._problemCount > 0
              ? html`<span class="badge error">${this._problemCount} ${this._t.problems}</span>`
              : html`<span class="badge ok">OK</span>`}
          </div>
        </div>
        <div class="card-content">
          ${this._devices.length > 0 ? this._renderDevices() : this._renderAllOk()}
        </div>
      </ha-card>
    `;
  }

  private _deviceIcon(severity: "error" | "warning" | "ok"): string {
    if (severity === "error") return "mdi:close-circle";
    if (severity === "warning") return "mdi:alert";
    return "mdi:check-circle";
  }

  private _renderDevices() {
    const shownCount = this._devices.length;
    const remaining = this._totalDevices - shownCount;
    return html`
      <div class="item-list">
        ${this._devices.map(
          (d) => html`
            <div class="item-row ${d.severity}">
              <ha-icon class="item-icon" .icon=${this._deviceIcon(d.severity)}></ha-icon>
              <div class="item-content">
                <div class="item-primary">${d.device.name}</div>
                <div class="item-secondary">
                  ${this._config?.show_model ? `${d.device.model}` : ""}${d.issues.length > 0
                    ? `${this._config?.show_model ? " · " : ""}${d.issues.join(", ")}`
                    : ""}
                </div>
              </div>
            </div>
          `,
        )}
      </div>
      ${remaining > 0
        ? html`<div class="summary-line">+ ${remaining} ${this._t.devices}</div>`
        : nothing}
    `;
  }

  private _renderAllOk() {
    return html`<div class="empty-state">${this._t.allDevicesOk}</div>`;
  }

  static getConfigElement() {
    return document.createElement("homematicip-device-status-editor");
  }

  static getStubConfig() {
    return { entry_id: "" };
  }

  getCardSize(): number {
    return 3;
  }
}
