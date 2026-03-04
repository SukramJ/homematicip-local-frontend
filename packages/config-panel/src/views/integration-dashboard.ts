import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { localize } from "../localize";
import { showConfirmationDialog, showToast } from "../ha-helpers";
import {
  getSystemHealth,
  getCommandThrottleStats,
  getIncidents,
  clearIncidents,
  clearCache,
  getDeviceStatistics,
} from "../panel-api";
import type { HomeAssistant } from "../types";
import type {
  SystemHealthData,
  ThrottleStats,
  IncidentsResult,
  DeviceStatistics,
} from "../panel-api";

@safeCustomElement("hm-integration-dashboard")
export class HmIntegrationDashboard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";

  @state() private _health: SystemHealthData | null = null;
  @state() private _throttle: Record<string, ThrottleStats> | null = null;
  @state() private _incidents: IncidentsResult | null = null;
  @state() private _deviceStats: DeviceStatistics | null = null;
  @state() private _loading = true;
  @state() private _error = "";

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
      const [health, throttle, incidents, deviceStats] = await Promise.all([
        getSystemHealth(this.hass, this.entryId),
        getCommandThrottleStats(this.hass, this.entryId),
        getIncidents(this.hass, this.entryId),
        getDeviceStatistics(this.hass, this.entryId),
      ]);
      this._health = health;
      this._throttle = throttle;
      this._incidents = incidents;
      this._deviceStats = deviceStats;
    } catch (err) {
      this._error = String(err);
    } finally {
      this._loading = false;
    }
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private async _handleClearIncidents(): Promise<void> {
    const confirmed = await showConfirmationDialog(this, {
      title: this._l("integration.clear_incidents_title"),
      text: this._l("integration.clear_incidents_text"),
      confirmText: this._l("integration.clear"),
      dismissText: this._l("common.cancel"),
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await clearIncidents(this.hass, this.entryId);
      showToast(this, { message: this._l("integration.incidents_cleared") });
      this._incidents = await getIncidents(this.hass, this.entryId);
    } catch {
      showToast(this, { message: this._l("integration.action_failed") });
    }
  }

  private async _handleClearCache(): Promise<void> {
    const confirmed = await showConfirmationDialog(this, {
      title: this._l("integration.clear_cache_title"),
      text: this._l("integration.clear_cache_text"),
      confirmText: this._l("integration.clear"),
      dismissText: this._l("common.cancel"),
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await clearCache(this.hass, this.entryId);
      showToast(this, { message: this._l("integration.cache_cleared") });
    } catch {
      showToast(this, { message: this._l("integration.action_failed") });
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
      ${this._renderHealthCard()} ${this._renderDeviceStatsCard()} ${this._renderThrottleCard()}
      ${this._renderIncidentsCard()} ${this._renderActionsCard()}
    `;
  }

  private _renderHealthCard() {
    if (!this._health) return nothing;

    return html`
      <ha-card>
        <div class="card-header">${this._l("integration.system_health")}</div>
        <div class="card-content">
          <div class="kv-grid">
            <div class="kv-item">
              <span class="kv-label">${this._l("integration.central_state")}</span>
              <span class="kv-value">${this._health.central_state}</span>
            </div>
            <div class="kv-item">
              <span class="kv-label">${this._l("integration.health_score")}</span>
              <span class="kv-value health-score"
                >${this._formatScore(this._health.overall_health_score)}</span
              >
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  private _renderDeviceStatsCard() {
    if (!this._deviceStats) return nothing;
    const stats = this._deviceStats;

    return html`
      <ha-card>
        <div class="card-header">${this._l("integration.device_statistics")}</div>
        <div class="card-content">
          <div class="stat-grid">
            <div class="stat-item">
              <span class="stat-value">${stats.total_devices}</span>
              <span class="stat-label">${this._l("integration.total_devices")}</span>
            </div>
            <div class="stat-item ${stats.unreachable_devices > 0 ? "warning" : ""}">
              <span class="stat-value">${stats.unreachable_devices}</span>
              <span class="stat-label">${this._l("integration.unreachable")}</span>
            </div>
            <div class="stat-item ${stats.firmware_updatable_devices > 0 ? "info" : ""}">
              <span class="stat-value">${stats.firmware_updatable_devices}</span>
              <span class="stat-label">${this._l("integration.firmware_updatable")}</span>
            </div>
          </div>
          ${Object.keys(stats.by_interface).length > 1
            ? html`
                <div class="interface-breakdown">
                  ${Object.entries(stats.by_interface).map(
                    ([iid, data]) => html`
                      <div class="interface-row">
                        <span class="interface-name">${iid}</span>
                        <span class="interface-stats">
                          ${data.total} ${this._l("integration.total_short")}
                          ${data.unreachable > 0
                            ? html`,
                                <span class="warn-text"
                                  >${data.unreachable}
                                  ${this._l("integration.unreachable_short")}</span
                                >`
                            : nothing}
                        </span>
                      </div>
                    `,
                  )}
                </div>
              `
            : nothing}
        </div>
      </ha-card>
    `;
  }

  private _renderThrottleCard() {
    if (!this._throttle || Object.keys(this._throttle).length === 0) return nothing;

    return html`
      <ha-card>
        <div class="card-header">${this._l("integration.command_throttle")}</div>
        <div class="card-content">
          ${Object.entries(this._throttle).map(
            ([iid, stats]) => html`
              <div class="throttle-section">
                <div class="throttle-interface">${iid}</div>
                <div class="kv-grid">
                  <div class="kv-item">
                    <span class="kv-label">${this._l("integration.enabled")}</span>
                    <span class="kv-value"
                      >${stats.is_enabled ? this._l("common.yes") : this._l("common.no")}</span
                    >
                  </div>
                  <div class="kv-item">
                    <span class="kv-label">${this._l("integration.interval")}</span>
                    <span class="kv-value">${stats.interval}s</span>
                  </div>
                  <div class="kv-item">
                    <span class="kv-label">${this._l("integration.queue_size")}</span>
                    <span class="kv-value">${stats.queue_size}</span>
                  </div>
                  <div class="kv-item">
                    <span class="kv-label">${this._l("integration.throttled")}</span>
                    <span class="kv-value">${stats.throttled_count}</span>
                  </div>
                  <div class="kv-item">
                    <span class="kv-label">${this._l("integration.burst_count")}</span>
                    <span class="kv-value">${stats.burst_count}</span>
                  </div>
                </div>
              </div>
            `,
          )}
        </div>
      </ha-card>
    `;
  }

  private _renderIncidentsCard() {
    if (!this._incidents) return nothing;
    const { incidents, summary } = this._incidents;

    return html`
      <ha-card>
        <div class="card-header">
          <span>${this._l("integration.incidents")}</span>
          <span class="badge">${summary.total_incidents}</span>
        </div>
        <div class="card-content">
          ${incidents.length === 0
            ? html`<div class="empty-state">${this._l("integration.no_incidents")}</div>`
            : html`
                <div class="incident-list">
                  ${incidents.map(
                    (inc) => html`
                      <div class="incident-row severity-${inc["severity"] ?? "info"}">
                        <span class="incident-type">${inc["type"]}</span>
                        <span class="incident-message">${inc["message"]}</span>
                        <span class="incident-time"
                          >${this._formatTimestamp(String(inc["timestamp"] ?? ""))}</span
                        >
                      </div>
                    `,
                  )}
                </div>
              `}
          ${incidents.length > 0
            ? html`
                <div class="action-bar">
                  <ha-button class="destructive" @click=${this._handleClearIncidents}>
                    ${this._l("integration.clear_incidents")}
                  </ha-button>
                </div>
              `
            : nothing}
        </div>
      </ha-card>
    `;
  }

  private _renderActionsCard() {
    return html`
      <ha-card>
        <div class="card-header">${this._l("integration.actions")}</div>
        <div class="card-content">
          <div class="action-buttons">
            <ha-button @click=${this._fetchAll}>${this._l("integration.refresh")}</ha-button>
            <ha-button class="destructive" @click=${this._handleClearCache}>
              ${this._l("integration.clear_cache")}
            </ha-button>
          </div>
        </div>
      </ha-card>
    `;
  }

  private _formatScore(score: number): string {
    return `${Math.round(score)}%`;
  }

  private _formatTimestamp(ts: string): string {
    if (!ts) return "";
    try {
      return new Date(ts).toLocaleString(this.hass.config.language || "en");
    } catch {
      return ts;
    }
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

      .health-score {
        color: var(--success-color, #4caf50);
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
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

      .stat-item.info {
        background: rgba(var(--rgb-blue, 33, 150, 243), 0.1);
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

      .interface-breakdown {
        border-top: 1px solid var(--divider-color);
        padding-top: 12px;
      }

      .interface-row {
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        font-size: 13px;
      }

      .interface-name {
        font-weight: 500;
      }

      .warn-text {
        color: var(--warning-color, #ff9800);
      }

      .throttle-section {
        margin-bottom: 16px;
      }

      .throttle-section:last-child {
        margin-bottom: 0;
      }

      .throttle-interface {
        font-weight: 500;
        font-size: 14px;
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--divider-color);
      }

      .incident-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 400px;
        overflow-y: auto;
      }

      .incident-row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        background: var(--secondary-background-color);
      }

      .incident-row.severity-error {
        border-left: 3px solid var(--error-color, #db4437);
      }

      .incident-row.severity-warning {
        border-left: 3px solid var(--warning-color, #ff9800);
      }

      .incident-row.severity-info {
        border-left: 3px solid var(--info-color, #2196f3);
      }

      .incident-type {
        font-weight: 500;
        white-space: nowrap;
      }

      .incident-message {
        color: var(--secondary-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .incident-time {
        font-size: 11px;
        color: var(--secondary-text-color);
        white-space: nowrap;
      }

      .action-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .destructive {
        --mdc-theme-primary: var(--error-color, #db4437);
      }

      @media (max-width: 600px) {
        .stat-grid {
          grid-template-columns: repeat(3, 1fr);
        }

        .incident-row {
          grid-template-columns: 1fr;
          gap: 4px;
        }

        .kv-grid {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ];
}
