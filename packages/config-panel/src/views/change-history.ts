import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { getChangeHistory, clearChangeHistory, getFormSchema } from "../api";
import { localize } from "../localize";
import { showConfirmationDialog, showToast } from "../ha-helpers";
import { formatParameterValue } from "../components/form-parameter";
import type { HomeAssistant, HistoryEntry, FormSchema, FormParameter } from "../types";

@safeCustomElement("hm-change-history")
export class HmChangeHistory extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";
  @property() public filterDevice = "";
  @property({ type: Boolean }) public editable = true;

  @state() private _entries: HistoryEntry[] = [];
  @state() private _total = 0;
  @state() private _loading = true;
  @state() private _error = "";
  @state() private _expandedEntries: Set<string> = new Set();

  /** Cached form schemas keyed by "interfaceId|channelAddress|paramsetKey" */
  private _schemaCache = new Map<string, FormSchema | null>();
  private _schemaLoading = new Set<string>();

  updated(changedProps: Map<string, unknown>): void {
    if ((changedProps.has("entryId") || changedProps.has("filterDevice")) && this.entryId) {
      this._fetchHistory();
    }
  }

  private async _fetchHistory(): Promise<void> {
    this._loading = true;
    this._error = "";
    try {
      const result = await getChangeHistory(this.hass, this.entryId, this.filterDevice);
      this._entries = result.entries;
      this._total = result.total;
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

  private _getSchemaCacheKey(entry: HistoryEntry): string {
    return `${entry.interface_id}|${entry.channel_address}|${entry.paramset_key}`;
  }

  private async _ensureSchema(entry: HistoryEntry): Promise<void> {
    const cacheKey = this._getSchemaCacheKey(entry);
    if (this._schemaCache.has(cacheKey) || this._schemaLoading.has(cacheKey)) return;

    this._schemaLoading.add(cacheKey);
    try {
      const schema = await getFormSchema(
        this.hass,
        entry.entry_id,
        entry.interface_id,
        entry.channel_address,
        "",
        entry.paramset_key,
      );
      this._schemaCache.set(cacheKey, schema);
    } catch {
      this._schemaCache.set(cacheKey, null);
    } finally {
      this._schemaLoading.delete(cacheKey);
      this.requestUpdate();
    }
  }

  private _findParam(entry: HistoryEntry, paramId: string): FormParameter | undefined {
    const schema = this._schemaCache.get(this._getSchemaCacheKey(entry));
    if (!schema) return undefined;
    for (const section of schema.sections) {
      const found = section.parameters.find((p) => p.id === paramId);
      if (found) return found;
    }
    return undefined;
  }

  private _formatValue(entry: HistoryEntry, paramId: string, value: unknown): string {
    const param = this._findParam(entry, paramId);
    if (!param) return String(value ?? "");
    return formatParameterValue(this.hass, param, value);
  }

  private _getParamLabel(entry: HistoryEntry, paramId: string): string {
    const param = this._findParam(entry, paramId);
    return param?.label ?? paramId;
  }

  private _toggleEntry(key: string, entry?: HistoryEntry): void {
    const next = new Set(this._expandedEntries);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
      if (entry) this._ensureSchema(entry);
    }
    this._expandedEntries = next;
  }

  private async _handleClear(): Promise<void> {
    const confirmed = await showConfirmationDialog(this, {
      title: this._l("change_history.clear_confirm_title"),
      text: this._l("change_history.clear_confirm_text"),
      confirmText: this._l("change_history.clear"),
      dismissText: this._l("common.cancel"),
      destructive: true,
    });
    if (!confirmed) return;

    try {
      const result = await clearChangeHistory(this.hass, this.entryId);
      if (result.success) {
        showToast(this, {
          message: this._l("change_history.clear_success", { count: result.cleared }),
        });
        this._entries = [];
        this._total = 0;
      }
    } catch {
      showToast(this, { message: this._l("change_history.clear_failed") });
    }
  }

  private _formatTimestamp(ts: string): string {
    try {
      const date = new Date(ts);
      return date.toLocaleString(this.hass.config.language || "en");
    } catch {
      return ts;
    }
  }

  private _getSourceLabel(source: string): string {
    switch (source) {
      case "manual":
        return this._l("change_history.source_manual");
      case "import":
        return this._l("change_history.source_import");
      case "copy":
        return this._l("change_history.source_copy");
      default:
        return source;
    }
  }

  private _getSourceBadgeHint(source: string): string {
    switch (source) {
      case "manual":
        return this._l("change_history.source_manual_hint");
      case "import":
        return this._l("change_history.source_import_hint");
      case "copy":
        return this._l("change_history.source_copy_hint");
      default:
        return "";
    }
  }

  render() {
    return html`
      <ha-icon-button
        class="back-button"
        .path=${"M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"}
        @click=${this._handleBack}
        .label=${this._l("common.back")}
      ></ha-icon-button>

      <div class="history-header-bar">
        <h2>${this._l("change_history.title")}</h2>
      </div>

      ${this._loading
        ? html`<div class="loading">${this._l("common.loading")}</div>`
        : this._error
          ? html`<div class="error">
              ${this._error}
              <br />
              <ha-button outlined @click=${this._fetchHistory}>
                ${this._l("common.retry")}
              </ha-button>
            </div>`
          : this._entries.length === 0
            ? html`<div class="empty-state">
                <ha-icon class="empty-icon" .icon=${"mdi:history"}></ha-icon>
                <div class="empty-message">${this._l("change_history.empty")}</div>
              </div>`
            : this._renderEntries()}
      ${!this._loading && this._entries.length > 0 && this.editable
        ? html`
            <div class="action-bar">
              <ha-button class="destructive" @click=${this._handleClear}>
                ${this._l("change_history.clear")}
              </ha-button>
            </div>
          `
        : nothing}
    `;
  }

  private _renderEntries() {
    return html`
      <div class="history-list">
        ${this._entries.map((entry, index) => {
          const key = `${entry.timestamp}-${index}`;
          const isExpanded = this._expandedEntries.has(key);
          const changeCount = Object.keys(entry.changes).length;

          return html`
            <div class="history-entry">
              <div
                class="history-entry-header"
                role="button"
                tabindex="0"
                aria-expanded=${isExpanded}
                @click=${() => this._toggleEntry(key, entry)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    this._toggleEntry(key, entry);
                  }
                }}
              >
                <div class="history-entry-info">
                  <div class="history-entry-time">${this._formatTimestamp(entry.timestamp)}</div>
                  <div class="history-entry-device">
                    ${entry.device_name} (${entry.device_model}) — ${entry.channel_address}
                  </div>
                  <div class="history-entry-meta">
                    ${this._l("change_history.parameters_changed", { count: changeCount })}
                  </div>
                </div>
                <div class="history-entry-badges">
                  <span class="source-badge" title="${this._getSourceBadgeHint(entry.source)}"
                    >${this._getSourceLabel(entry.source)}</span
                  >
                  <ha-icon
                    class="expand-icon"
                    .icon=${isExpanded ? "mdi:chevron-down" : "mdi:chevron-right"}
                  ></ha-icon>
                </div>
              </div>
              ${isExpanded
                ? html`
                    <div class="history-details">
                      ${Object.entries(entry.changes).map(
                        ([paramId, change]) => html`
                          <div class="change-row">
                            <span class="change-param">${this._getParamLabel(entry, paramId)}</span>
                            <span class="change-values">
                              <span class="change-old"
                                >${this._formatValue(entry, paramId, change.old)}</span
                              >
                              <ha-icon class="change-arrow" .icon=${"mdi:arrow-right"}></ha-icon>
                              <span class="change-new"
                                >${this._formatValue(entry, paramId, change.new)}</span
                              >
                            </span>
                          </div>
                        `,
                      )}
                    </div>
                  `
                : nothing}
            </div>
          `;
        })}
      </div>
    `;
  }

  static styles = [
    sharedStyles,
    css`
      .history-header-bar {
        margin-bottom: 16px;
      }

      .history-header-bar h2 {
        margin: 8px 0;
        font-size: 20px;
        font-weight: 400;
      }

      .history-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .history-entry {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        overflow: hidden;
      }

      .history-entry-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: var(--secondary-background-color, #fafafa);
        cursor: pointer;
      }

      .history-entry-header:hover,
      .history-entry-header:focus-visible {
        background: var(--primary-background-color);
      }

      .history-entry-header:focus-visible {
        outline: 2px solid var(--primary-color, #03a9f4);
        outline-offset: -2px;
      }

      .history-entry-info {
        flex: 1;
        min-width: 0;
      }

      .history-entry-time {
        font-size: 13px;
        color: var(--secondary-text-color);
      }

      .history-entry-device {
        font-size: 14px;
        font-weight: 500;
        margin-top: 2px;
      }

      .history-entry-meta {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-top: 2px;
      }

      .history-entry-badges {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: 12px;
        flex-shrink: 0;
      }

      .source-badge {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 12px;
        background: var(--primary-color, #03a9f4);
        color: #fff;
        text-transform: uppercase;
      }

      .expand-icon {
        --ha-icon-display-size: 18px;
        color: var(--secondary-text-color);
      }

      .history-details {
        padding: 8px 16px 12px;
        border-top: 1px solid var(--divider-color, #e0e0e0);
        animation: slideDown 0.15s ease-out;
      }

      @keyframes slideDown {
        from {
          opacity: 0;
          max-height: 0;
        }
        to {
          opacity: 1;
          max-height: 500px;
        }
      }

      .change-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
        font-size: 13px;
      }

      .change-param {
        font-weight: 500;
        margin-right: 12px;
      }

      .change-values {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .change-old {
        color: var(--error-color, #db4437);
        text-decoration: line-through;
        opacity: 0.8;
        font-size: 12px;
      }

      .change-new {
        color: var(--success-color, #4caf50);
        font-weight: 600;
      }

      .empty-icon {
        --ha-icon-display-size: 48px;
        color: var(--secondary-text-color);
        opacity: 0.5;
        margin-bottom: 12px;
      }

      .empty-message {
        font-size: 16px;
      }

      .destructive {
        --ha-button-color: var(--error-color, #db4437);
      }

      .change-arrow {
        --ha-icon-display-size: 18px;
        color: var(--secondary-text-color);
      }

      @media (max-width: 600px) {
        .history-entry-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }

        .history-entry-badges {
          margin-left: 0;
        }

        .change-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }
      }
    `,
  ];
}
