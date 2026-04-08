import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, ServiceMessage, AlarmMessage } from "@hmip/panel-api";
import {
  getServiceMessages,
  getAlarmMessages,
  acknowledgeServiceMessage,
  acknowledgeAlarmMessage,
} from "@hmip/panel-api";
import { cardStyles } from "../styles";
import { getStatusTranslations, type StatusCardTranslations } from "../localization";

export interface MessagesCardConfig {
  entry_id: string;
  title?: string;
  show_service?: boolean;
  show_alarms?: boolean;
  max_messages?: number;
  show_timestamp?: boolean;
  compact?: boolean;
  poll_interval?: number;
}

@customElement("homematicip-messages-card")
export class HomematicipMessagesCard extends LitElement {
  static styles = cardStyles;

  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private _config?: MessagesCardConfig;
  @state() private _serviceMessages: ServiceMessage[] = [];
  @state() private _alarmMessages: AlarmMessage[] = [];
  @state() private _loading = true;
  @state() private _error = "";

  private _pollTimer?: ReturnType<typeof setTimeout>;
  private _t!: StatusCardTranslations;

  setConfig(config: MessagesCardConfig): void {
    if (!config.entry_id) {
      throw new Error("entry_id is required");
    }
    this._config = {
      show_service: true,
      show_alarms: true,
      max_messages: 10,
      show_timestamp: true,
      compact: false,
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

  private _startPolling(): void {
    this._stopPolling();
    const interval = (this._config?.poll_interval ?? 30) * 1000;
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
      const promises: Promise<unknown>[] = [];

      if (this._config.show_service) {
        promises.push(
          getServiceMessages(this.hass, this._config.entry_id).then(
            (msgs) => (this._serviceMessages = msgs),
          ),
        );
      }

      if (this._config.show_alarms) {
        promises.push(
          getAlarmMessages(this.hass, this._config.entry_id).then(
            (alarms) => (this._alarmMessages = alarms),
          ),
        );
      }

      await Promise.all(promises);
      this._error = "";
    } catch (err) {
      this._error = String(err);
    } finally {
      this._loading = false;
    }

    this._startPolling();
  }

  private async _acknowledgeService(msgId: string): Promise<void> {
    if (!this.hass || !this._config) return;
    try {
      await acknowledgeServiceMessage(this.hass, this._config.entry_id, msgId);
      this._serviceMessages = this._serviceMessages.filter((m) => m.msg_id !== msgId);
    } catch {
      // Silently fail, next poll will refresh
    }
  }

  private async _acknowledgeAlarm(alarmId: string): Promise<void> {
    if (!this.hass || !this._config) return;
    try {
      await acknowledgeAlarmMessage(this.hass, this._config.entry_id, alarmId);
      this._alarmMessages = this._alarmMessages.filter((a) => a.alarm_id !== alarmId);
    } catch {
      // Silently fail, next poll will refresh
    }
  }

  protected render() {
    if (!this._config || !this._t) return nothing;

    const title = this._config.title ?? this._t.messages;

    if (this._loading) {
      return html`
        <ha-card>
          <div class="card-header">${title}</div>
          <div class="loading"><ha-circular-progress indeterminate></ha-circular-progress></div>
        </ha-card>
      `;
    }

    if (this._error && this._serviceMessages.length === 0 && this._alarmMessages.length === 0) {
      return html`
        <ha-card>
          <div class="card-header">${title}</div>
          <div class="error-msg">${this._t.error}</div>
        </ha-card>
      `;
    }

    const alarmCount = this._alarmMessages.length;
    const serviceCount = this._serviceMessages.length;

    return html`
      <ha-card>
        <div class="card-header">
          ${title}
          <div class="badges">
            ${alarmCount > 0 ? html`<span class="badge error">${alarmCount}</span>` : nothing}
            ${serviceCount > 0 ? html`<span class="badge warning">${serviceCount}</span>` : nothing}
            ${alarmCount === 0 && serviceCount === 0
              ? html`<span class="badge ok">OK</span>`
              : nothing}
          </div>
        </div>
        <div class="card-content">
          ${this._renderAlarms()} ${this._renderServiceMessages()}
          ${alarmCount === 0 && serviceCount === 0
            ? html`<div class="empty-state">${this._t.noMessages}</div>`
            : nothing}
        </div>
      </ha-card>
    `;
  }

  private _renderAlarms() {
    if (!this._config?.show_alarms || this._alarmMessages.length === 0) return nothing;

    const max = this._config.max_messages ?? 10;
    const alarms = this._alarmMessages.slice(0, max);

    return html`
      <div class="section-title">${this._t.alarms}</div>
      <div class="item-list">
        ${alarms.map(
          (alarm) => html`
            <div class="item-row error">
              <ha-icon class="item-icon" .icon=${"mdi:bell-alert"}></ha-icon>
              <div class="item-content">
                <div class="item-primary">${alarm.device_name || alarm.name}</div>
                <div class="item-secondary">
                  ${alarm.display_name}${alarm.counter > 1 ? ` · ${alarm.counter}x` : ""}${this
                    ._config?.show_timestamp
                    ? ` · ${this._formatTimestamp(alarm.timestamp)}`
                    : ""}
                </div>
              </div>
              <div class="item-action">
                <ha-icon-button
                  .label=${this._t.acknowledge}
                  @click=${() => this._acknowledgeAlarm(alarm.alarm_id)}
                >
                  <ha-icon .icon=${"mdi:check"}></ha-icon>
                </ha-icon-button>
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }

  private _renderServiceMessages() {
    if (!this._config?.show_service || this._serviceMessages.length === 0) return nothing;

    const max = this._config.max_messages ?? 10;
    const messages = this._serviceMessages.slice(0, max);

    return html`
      <div class="section-title">${this._t.serviceMessages}</div>
      <div class="item-list">
        ${messages.map(
          (msg) => html`
            <div class="item-row warning">
              <ha-icon class="item-icon" .icon=${"mdi:alert"}></ha-icon>
              <div class="item-content">
                <div class="item-primary">${msg.device_name || msg.name}</div>
                <div class="item-secondary">
                  ${msg.message_code}${msg.counter > 1 ? ` · ${msg.counter}x` : ""}${this._config
                    ?.show_timestamp
                    ? ` · ${this._formatTimestamp(msg.timestamp)}`
                    : ""}
                </div>
              </div>
              ${msg.quittable
                ? html`
                    <div class="item-action">
                      <ha-icon-button
                        .label=${this._t.acknowledge}
                        @click=${() => this._acknowledgeService(msg.msg_id)}
                      >
                        <ha-icon .icon=${"mdi:check"}></ha-icon>
                      </ha-icon-button>
                    </div>
                  `
                : nothing}
            </div>
          `,
        )}
      </div>
    `;
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
    return document.createElement("homematicip-messages-editor");
  }

  static getStubConfig() {
    return { entry_id: "" };
  }

  getCardSize(): number {
    return 3;
  }
}
