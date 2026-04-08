import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type {
  HomeAssistant,
  HassEntity,
  SystemHealthData,
  DeviceStatistics,
  IncidentsResult,
} from "@hmip/panel-api";
import { getSystemHealth, getDeviceStatistics, getIncidents } from "@hmip/panel-api";
import { cardStyles } from "../styles";
import { getStatusTranslations, type StatusCardTranslations } from "../localization";

interface RadioLevel {
  name: string;
  dutyCycle: number | null;
  carrierSense: number | null;
}

export interface SystemHealthCardConfig {
  entry_id: string;
  title?: string;
  show_incidents?: boolean;
  max_incidents?: number;
  show_throttle?: boolean;
  poll_interval?: number;
}

const FAST_POLL = 5000;
const SLOW_POLL = 30000;

@customElement("homematicip-system-health-card")
export class HomematicipSystemHealthCard extends LitElement {
  static styles = cardStyles;

  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private _config?: SystemHealthCardConfig;
  @state() private _health?: SystemHealthData;
  @state() private _deviceStats?: DeviceStatistics;
  @state() private _incidents?: IncidentsResult;
  @state() private _entryEntityIds?: Set<string>;
  @state() private _loading = true;
  @state() private _error = "";

  private _pollTimer?: ReturnType<typeof setTimeout>;
  private _t!: StatusCardTranslations;

  setConfig(config: SystemHealthCardConfig): void {
    if (!config.entry_id) {
      throw new Error("entry_id is required");
    }
    this._config = {
      show_incidents: false,
      max_incidents: 5,
      show_throttle: false,
      poll_interval: 30,
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

  private _startPolling(interval: number): void {
    this._stopPolling();
    this._pollTimer = setTimeout(() => this._fetchData(), interval);
  }

  private _stopPolling(): void {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = undefined;
    }
  }

  private async _fetchData(): Promise<void> {
    if (!this.hass || !this._config) return;

    try {
      const maxIncidents = this._config.show_incidents ? this._config.max_incidents! : 0;
      const [health, stats, incidents] = await Promise.all([
        getSystemHealth(this.hass, this._config.entry_id),
        getDeviceStatistics(this.hass, this._config.entry_id),
        maxIncidents > 0
          ? getIncidents(this.hass, this._config.entry_id, maxIncidents)
          : Promise.resolve(undefined),
      ]);
      this._health = health;
      this._deviceStats = stats;
      if (incidents) this._incidents = incidents;

      // Load entity registry to map entities to config entry (only once)
      if (!this._entryEntityIds) {
        await this._loadEntryEntityIds();
      }

      this._error = "";
    } catch (err) {
      this._error = String(err);
    } finally {
      this._loading = false;
    }

    const isStable = this._health?.central_state?.toLowerCase() === "running";
    const baseInterval = (this._config.poll_interval ?? 30) * 1000;
    this._startPolling(isStable ? Math.max(baseInterval, SLOW_POLL) : FAST_POLL);
  }

  protected render() {
    if (!this._config || !this._t) return nothing;

    const title = this._config.title ?? this._t.systemHealth;

    if (this._loading) {
      return html`
        <ha-card>
          <div class="card-header">${title}</div>
          <div class="loading"><ha-circular-progress indeterminate></ha-circular-progress></div>
        </ha-card>
      `;
    }

    if (this._error && !this._health) {
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
          <div class="badges">${this._renderStatusBadge()}</div>
        </div>
        <div class="card-content">
          ${this._renderStats()} ${this._renderRadioLevels()} ${this._renderIncidents()}
        </div>
      </ha-card>
    `;
  }

  private _renderStatusBadge() {
    if (!this._health) return nothing;
    const state = this._health.central_state;
    const isRunning = state?.toLowerCase() === "running";
    const score = Math.round(this._health.overall_health_score * 100);
    return html` <span class="badge ${isRunning ? "ok" : "error"}">${score}%</span> `;
  }

  private _renderStats() {
    if (!this._deviceStats) return nothing;
    const s = this._deviceStats;
    return html`
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-value">${s.total_devices}</div>
          <div class="stat-label">${this._t.devices}</div>
        </div>
        <div class="stat-item ${s.unreachable_devices > 0 ? "error" : ""}">
          <div class="stat-value">${s.unreachable_devices}</div>
          <div class="stat-label">${this._t.unreachable}</div>
        </div>
        <div class="stat-item ${s.firmware_updatable_devices > 0 ? "warning" : ""}">
          <div class="stat-value">${s.firmware_updatable_devices}</div>
          <div class="stat-label">${this._t.firmwareUpdates}</div>
        </div>
      </div>
    `;
  }

  private async _loadEntryEntityIds(): Promise<void> {
    if (!this.hass || !this._config) return;
    try {
      const entries = await this.hass.callWS<
        Array<{ entity_id: string; config_entry_id: string; device_id: string }>
      >({
        type: "config/entity_registry/list",
      });
      const entryId = this._config.entry_id;
      this._entryEntityIds = new Set(
        entries.filter((e) => e.config_entry_id === entryId).map((e) => e.entity_id),
      );
    } catch {
      // Fallback: allow all entities (no filtering)
      this._entryEntityIds = undefined;
    }
  }

  private _getRadioLevels(): RadioLevel[] {
    const states = this.hass?.states;
    if (!states) return [];

    const deviceMap = new Map<string, RadioLevel>();

    for (const [entityId, entity] of Object.entries(states)) {
      if (!entityId.startsWith("sensor.")) continue;

      const isDutyCycle = entityId.endsWith("_duty_cycle_level");
      const isCarrierSense = entityId.endsWith("_carrier_sense_level");
      if (!isDutyCycle && !isCarrierSense) continue;

      // Filter by config entry using entity registry data
      if (this._entryEntityIds && !this._entryEntityIds.has(entityId)) continue;

      const attrs = (entity as HassEntity).attributes;
      const name = (attrs?.friendly_name as string) || entityId;
      const deviceKey = entityId.replace(/_(?:duty_cycle|carrier_sense)_level$/, "");
      const deviceName = name
        .replace(/\s*Duty Cycle Level$/i, "")
        .replace(/\s*Carrier Sense Level$/i, "")
        .replace(/\s*DutyCycle Level$/i, "")
        .replace(/\s*CarrierSense Level$/i, "");

      if (!deviceMap.has(deviceKey)) {
        deviceMap.set(deviceKey, { name: deviceName, dutyCycle: null, carrierSense: null });
      }
      const entry = deviceMap.get(deviceKey)!;

      const value = parseFloat((entity as HassEntity).state);
      if (!isNaN(value)) {
        if (isDutyCycle) entry.dutyCycle = value;
        if (isCarrierSense) entry.carrierSense = value;
      }
    }

    return [...deviceMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private _dcClass(value: number | null): string {
    if (value === null) return "";
    if (value >= 80) return "error";
    if (value >= 60) return "warning";
    return "";
  }

  private _csClass(value: number | null): string {
    if (value === null) return "";
    if (value >= 10) return "error";
    return "";
  }

  private _renderRadioLevels() {
    const levels = this._getRadioLevels();
    if (levels.length === 0) return nothing;

    return html`
      <div class="section-title">${this._t.dutyCycle} / ${this._t.carrierSense}</div>
      <div class="item-list">
        ${levels.map(
          (l) => html`
            <div class="item-row">
              <ha-icon class="item-icon" .icon=${"mdi:radio-tower"}></ha-icon>
              <div class="item-content">
                <div class="item-primary">${l.name}</div>
                <div class="item-secondary">
                  ${l.dutyCycle !== null
                    ? html`<span class="${this._dcClass(l.dutyCycle)}">DC: ${l.dutyCycle}%</span>`
                    : nothing}
                  ${l.dutyCycle !== null && l.carrierSense !== null ? " · " : nothing}
                  ${l.carrierSense !== null
                    ? html`<span class="${this._csClass(l.carrierSense)}"
                        >CS: ${l.carrierSense}%</span
                      >`
                    : nothing}
                </div>
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderIncidents() {
    if (!this._config?.show_incidents || !this._incidents) return nothing;
    const items = this._incidents.incidents;
    const total = this._incidents.summary.total_incidents;

    if (total === 0) {
      return html`<div class="empty-state">${this._t.noIncidents}</div>`;
    }

    return html`
      <div class="section-title">
        ${this._t.incidents}
        <span class="badge warning">${total}</span>
      </div>
      <div class="item-list">
        ${items.map(
          (incident) => html`
            <div class="item-row ${this._incidentSeverity(incident)}">
              <ha-icon class="item-icon" .icon=${this._incidentIcon(incident)}></ha-icon>
              <div class="item-content">
                <div class="item-primary">
                  ${(incident as Record<string, unknown>).message ||
                  (incident as Record<string, unknown>).type}
                </div>
                <div class="item-secondary">
                  ${this._formatTimestamp(
                    (incident as Record<string, unknown>).timestamp as string,
                  )}
                </div>
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }

  private _incidentSeverity(incident: Record<string, unknown>): string {
    const severity = String(incident.severity || "info").toLowerCase();
    if (severity === "error" || severity === "critical") return "error";
    if (severity === "warning") return "warning";
    return "";
  }

  private _incidentIcon(incident: Record<string, unknown>): string {
    const severity = String(incident.severity || "info").toLowerCase();
    if (severity === "error" || severity === "critical") return "mdi:alert-circle";
    if (severity === "warning") return "mdi:alert";
    return "mdi:information";
  }

  private _formatTimestamp(ts: string | undefined): string {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleTimeString(this.hass?.config.language || "en", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return ts;
    }
  }

  static getConfigElement() {
    return document.createElement("homematicip-system-health-editor");
  }

  static getStubConfig() {
    return { entry_id: "" };
  }

  getCardSize(): number {
    return 3;
  }
}
