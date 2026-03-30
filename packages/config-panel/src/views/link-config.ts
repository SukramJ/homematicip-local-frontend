import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { getLinkFormSchema, getLinkProfiles, putLinkParamset } from "../api";
import type { FormParameter, ResolvedProfile } from "../api";
import { localize } from "../localize";
import { showConfirmationDialog, showToast } from "../ha-helpers";
import "../components/config-form";
import "../components/form-parameter";
import "../components/form-time-selector";
import type { HomeAssistant, FormSchema } from "../types";

@safeCustomElement("hm-link-config")
export class HmLinkConfig extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";
  @property() public interfaceId = "";
  @property() public senderAddress = "";
  @property() public receiverAddress = "";
  @property() public senderDeviceName = "";
  @property() public senderDeviceModel = "";
  @property() public senderChannelTypeLabel = "";
  @property() public receiverDeviceName = "";
  @property() public receiverDeviceModel = "";
  @property() public receiverChannelTypeLabel = "";

  @state() private _receiverSchema: FormSchema | null = null;
  @state() private _senderSchema: FormSchema | null = null;
  @state() private _receiverPendingChanges: Map<string, unknown> = new Map();
  @state() private _senderPendingChanges: Map<string, unknown> = new Map();
  @state() private _loading = true;
  @state() private _saving = false;
  @state() private _error = "";
  @state() private _validationErrors: Record<string, string> = {};
  @state() private _senderValidationErrors: Record<string, string> = {};
  @state() private _profiles: ResolvedProfile[] | null = null;
  @state() private _activeProfileId = 0;
  @state() private _selectedProfileId = 0;
  @state() private _activeKeypressTab: "short" | "long" = "short";

  updated(changedProps: Map<string, unknown>): void {
    if (
      (changedProps.has("senderAddress") ||
        changedProps.has("receiverAddress") ||
        changedProps.has("entryId")) &&
      this.entryId &&
      this.senderAddress &&
      this.receiverAddress
    ) {
      this._fetchSchemas();
    }
  }

  private async _fetchSchemas(): Promise<void> {
    this._loading = true;
    this._error = "";
    this._receiverPendingChanges = new Map();
    this._senderPendingChanges = new Map();
    this._validationErrors = {};
    this._senderValidationErrors = {};

    try {
      const [receiverSchema, senderSchema, profilesResponse] = await Promise.all([
        getLinkFormSchema(
          this.hass,
          this.entryId,
          this.interfaceId,
          this.senderAddress,
          this.receiverAddress,
        ),
        getLinkFormSchema(
          this.hass,
          this.entryId,
          this.interfaceId,
          this.receiverAddress,
          this.senderAddress,
        ).catch(() => null),
        getLinkProfiles(
          this.hass,
          this.entryId,
          this.interfaceId,
          this.senderAddress,
          this.receiverAddress,
        ),
      ]);
      this._receiverSchema = receiverSchema;
      this._senderSchema = senderSchema;
      this._profiles = profilesResponse?.profiles ?? null;
      this._activeProfileId = profilesResponse?.active_profile_id ?? 0;
      this._selectedProfileId = this._activeProfileId;
    } catch (err) {
      this._error = String(err);
    } finally {
      this._loading = false;
    }
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private get _isDirty(): boolean {
    return this._receiverPendingChanges.size > 0 || this._senderPendingChanges.size > 0;
  }

  private get _filteredReceiverSchema(): FormSchema | null {
    if (!this._receiverSchema || !this._profiles || this._selectedProfileId === 0) {
      return this._receiverSchema;
    }
    const profile = this._profiles.find((p) => p.id === this._selectedProfileId);
    if (!profile) return this._receiverSchema;

    const editableIds = new Set(profile.editable_params);
    const filteredSections = this._receiverSchema.sections
      .map((s) => ({
        ...s,
        parameters: s.parameters.filter((p) => editableIds.has(p.id)),
      }))
      .filter((s) => s.parameters.length > 0);
    return { ...this._receiverSchema, sections: filteredSections };
  }

  private get _groupedReceiverParams(): {
    short: FormParameter[];
    long: FormParameter[];
    common: FormParameter[];
  } | null {
    const schema = this._filteredReceiverSchema;
    if (!schema) return null;

    const allParams = schema.sections.flatMap((s) => s.parameters);
    if (!allParams.some((p) => p.keypress_group)) return null;

    return {
      short: allParams.filter((p) => p.keypress_group === "short"),
      long: allParams.filter((p) => p.keypress_group === "long"),
      common: allParams.filter((p) => p.keypress_group === "common" || !p.keypress_group),
    };
  }

  private _getEffectiveValue(param: FormParameter): unknown {
    if (this._receiverPendingChanges.has(param.id)) {
      return this._receiverPendingChanges.get(param.id);
    }
    return param.current_value;
  }

  private _isModified(param: FormParameter): boolean {
    return this._receiverPendingChanges.has(param.id);
  }

  private _emitReceiverChange(parameterId: string, value: unknown): void {
    const param = this._findParameter(parameterId);
    const currentValue = param?.current_value;
    if (value === currentValue) {
      this._receiverPendingChanges.delete(parameterId);
    } else {
      this._receiverPendingChanges.set(parameterId, value);
    }
    this._receiverPendingChanges = new Map(this._receiverPendingChanges);
  }

  private _handleProfileChange(e: CustomEvent): void {
    e.stopPropagation();
    const newProfileId = parseInt(e.detail.value, 10);
    if (Number.isNaN(newProfileId) || newProfileId === this._selectedProfileId) return;
    this._selectedProfileId = newProfileId;

    if (newProfileId === 0 || !this._profiles) return;

    const profile = this._profiles.find((p) => p.id === newProfileId);
    if (!profile) return;

    const newChanges = new Map<string, unknown>();
    for (const [paramId, value] of Object.entries(profile.fixed_params)) {
      const param = this._findParameter(paramId);
      if (param && param.current_value !== value) newChanges.set(paramId, value);
    }
    for (const [paramId, value] of Object.entries(profile.default_values)) {
      const param = this._findParameter(paramId);
      if (param && param.current_value !== value) newChanges.set(paramId, value);
    }
    this._receiverPendingChanges = newChanges;
  }

  private _handleReceiverValueChanged(e: CustomEvent): void {
    const { parameterId, value, currentValue } = e.detail;
    if (value === currentValue) {
      this._receiverPendingChanges.delete(parameterId);
    } else {
      this._receiverPendingChanges.set(parameterId, value);
    }
    this._receiverPendingChanges = new Map(this._receiverPendingChanges);
  }

  private _handleSenderValueChanged(e: CustomEvent): void {
    const { parameterId, value, currentValue } = e.detail;
    if (value === currentValue) {
      this._senderPendingChanges.delete(parameterId);
    } else {
      this._senderPendingChanges.set(parameterId, value);
    }
    this._senderPendingChanges = new Map(this._senderPendingChanges);
  }

  private _handleDiscard(): void {
    this._receiverPendingChanges = new Map();
    this._senderPendingChanges = new Map();
    this._validationErrors = {};
    this._senderValidationErrors = {};
    this._selectedProfileId = this._activeProfileId;
  }

  private async _handleSave(): Promise<void> {
    if (!this._isDirty || this._saving) return;

    const allChanges = [
      ...this._receiverPendingChanges.entries(),
      ...this._senderPendingChanges.entries(),
    ];
    const changeCount = allChanges.length;
    const changeSummary = allChanges
      .map(([key, value]) => {
        const param = this._findParameter(key);
        const label = param?.label ?? key;
        const oldValue = param?.current_value ?? "?";
        return `${label}: ${oldValue} \u2192 ${value}`;
      })
      .join("\n");

    const confirmed = await showConfirmationDialog(this, {
      title: this._l("link_config.confirm_save_title"),
      text: `${this._l("link_config.confirm_save_text", { count: changeCount })}\n\n${changeSummary}`,
      confirmText: this._l("common.save"),
      dismissText: this._l("common.cancel"),
    });
    if (!confirmed) return;

    this._saving = true;
    this._validationErrors = {};
    this._senderValidationErrors = {};

    try {
      const promises: Promise<unknown>[] = [];

      if (this._receiverPendingChanges.size > 0) {
        promises.push(
          putLinkParamset(
            this.hass,
            this.entryId,
            this.interfaceId,
            this.senderAddress,
            this.receiverAddress,
            Object.fromEntries(this._receiverPendingChanges),
          ),
        );
      }

      if (this._senderPendingChanges.size > 0) {
        promises.push(
          putLinkParamset(
            this.hass,
            this.entryId,
            this.interfaceId,
            this.receiverAddress,
            this.senderAddress,
            Object.fromEntries(this._senderPendingChanges),
          ),
        );
      }

      await Promise.all(promises);
      this._receiverPendingChanges = new Map();
      this._senderPendingChanges = new Map();
      showToast(this, { message: this._l("link_config.save_success") });
      await this._fetchSchemas();
    } catch (err) {
      this._error = String(err);
      showToast(this, { message: this._l("link_config.save_failed") });
    } finally {
      this._saving = false;
    }
  }

  private _findParameter(parameterId: string) {
    for (const schema of [this._receiverSchema, this._senderSchema]) {
      if (!schema) continue;
      for (const section of schema.sections) {
        const found = section.parameters.find((p) => p.id === parameterId);
        if (found) return found;
      }
    }
    return undefined;
  }

  private async _handleBack(): Promise<void> {
    if (this._isDirty) {
      const confirmed = await showConfirmationDialog(this, {
        title: this._l("link_config.unsaved_title"),
        text: this._l("link_config.unsaved_warning"),
        confirmText: this._l("link_config.discard"),
        dismissText: this._l("common.cancel"),
        destructive: true,
      });
      if (!confirmed) return;
    }
    this.dispatchEvent(new CustomEvent("back", { bubbles: true, composed: true }));
  }

  private _hasReceiverParams(): boolean {
    return (this._filteredReceiverSchema?.sections.length ?? 0) > 0;
  }

  private _hasSenderParams(): boolean {
    return (this._senderSchema?.sections.length ?? 0) > 0;
  }

  private _renderProfileSelector() {
    if (!this._profiles) return nothing;

    const selectedProfile = this._profiles.find((p) => p.id === this._selectedProfileId);
    const profileDescription = selectedProfile?.description || "";

    return html`
      <div class="profile-selector">
        <ha-select
          .label=${this._l("link_config.profile")}
          .value=${String(this._selectedProfileId)}
          .options=${this._profiles.map((p) => ({
            value: String(p.id),
            label: p.name,
          }))}
          @selected=${this._handleProfileChange}
          @closed=${(e: Event) => e.stopPropagation()}
        ></ha-select>
        ${profileDescription
          ? html`<p class="profile-description">${profileDescription}</p>`
          : nothing}
      </div>
    `;
  }

  private _renderParamList(params: FormParameter[]) {
    // Group time pairs
    const timePairs = new Map<string, { base?: FormParameter; factor?: FormParameter }>();
    const regularParams: FormParameter[] = [];

    for (const p of params) {
      if (p.time_pair_id && p.id.toUpperCase().endsWith("_TIME_BASE")) {
        const entry = timePairs.get(p.time_pair_id) ?? {};
        entry.base = p;
        timePairs.set(p.time_pair_id, entry);
      } else if (p.time_pair_id && p.id.toUpperCase().endsWith("_TIME_FACTOR")) {
        const entry = timePairs.get(p.time_pair_id) ?? {};
        entry.factor = p;
        timePairs.set(p.time_pair_id, entry);
      } else if (p.hidden_by_default && this._selectedProfileId !== 0) {
        // Hidden in non-expert mode
      } else {
        regularParams.push(p);
      }
    }

    return html`
      ${[...timePairs.entries()].map(([, pair]) =>
        pair.base && pair.factor
          ? html`
              <hm-time-selector
                .hass=${this.hass}
                .baseParam=${pair.base}
                .factorParam=${pair.factor}
                .baseValue=${this._getEffectiveValue(pair.base) as number}
                .factorValue=${this._getEffectiveValue(pair.factor) as number}
                .presets=${pair.base.time_presets ?? []}
                .modified=${this._isModified(pair.base) || this._isModified(pair.factor)}
                @value-changed=${this._handleReceiverValueChanged}
              ></hm-time-selector>
            `
          : nothing,
      )}
      ${regularParams.map((p) =>
        p.display_as_percent && p.has_last_value
          ? this._renderLevelParam(p)
          : html`
              <hm-form-parameter
                .hass=${this.hass}
                .parameter=${p}
                .value=${this._getEffectiveValue(p)}
                .modified=${this._isModified(p)}
                @value-changed=${this._handleReceiverValueChanged}
              ></hm-form-parameter>
            `,
      )}
    `;
  }

  private _renderLevelParam(param: FormParameter) {
    const value = this._getEffectiveValue(param) as number;
    const isLastValue = value > 1.0;
    const percent = isLastValue ? 100 : Math.round(value * 100);

    return html`
      <div class="level-param">
        <div class="parameter-row">
          <div class="parameter-label">
            ${param.label}
            ${this._isModified(param) ? html`<span class="modified-dot"></span>` : nothing}
          </div>
          <div class="parameter-control level-controls">
            <label class="last-value-toggle">
              <ha-checkbox
                .checked=${isLastValue}
                @change=${(e: Event) => {
                  const checked = (e.target as HTMLElement & { checked: boolean }).checked;
                  this._emitReceiverChange(param.id, checked ? 1.005 : 1.0);
                }}
              ></ha-checkbox>
              ${this._l("link_config.last_value")}
            </label>
            ${!isLastValue
              ? html`
                  <div class="slider-group">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      .value=${String(percent)}
                      @input=${(e: Event) => {
                        const pct = Number((e.target as HTMLInputElement).value);
                        this._emitReceiverChange(param.id, pct / 100);
                      }}
                    />
                    <span class="percent-display">${percent}%</span>
                  </div>
                `
              : nothing}
          </div>
        </div>
      </div>
    `;
  }

  private _renderReceiverParams() {
    const grouped = this._groupedReceiverParams;

    if (grouped) {
      const hasShort = grouped.short.length > 0;
      const hasLong = grouped.long.length > 0;
      const showTabs = hasShort && hasLong;

      return html`
        <div class="param-section">
          <h3>${this._l("link_config.receiver_params")}</h3>
          ${showTabs
            ? html`
                <div class="keypress-tabs">
                  <div
                    class="tab ${this._activeKeypressTab === "short" ? "active" : ""}"
                    @click=${() => {
                      this._activeKeypressTab = "short";
                    }}
                  >
                    ${this._l("link_config.short_keypress")}
                  </div>
                  <div
                    class="tab ${this._activeKeypressTab === "long" ? "active" : ""}"
                    @click=${() => {
                      this._activeKeypressTab = "long";
                    }}
                  >
                    ${this._l("link_config.long_keypress")}
                  </div>
                </div>
                <div class="keypress-params">
                  ${this._renderParamList(
                    this._activeKeypressTab === "short" ? grouped.short : grouped.long,
                  )}
                </div>
              `
            : hasShort
              ? this._renderParamList(grouped.short)
              : hasLong
                ? this._renderParamList(grouped.long)
                : nothing}
          ${grouped.common.length > 0
            ? html` <div class="common-params">${this._renderParamList(grouped.common)}</div> `
            : nothing}
        </div>
      `;
    }

    // Fallback: use existing hm-config-form
    return html`
      <div class="param-section">
        <h3>${this._l("link_config.receiver_params")}</h3>
        <hm-config-form
          .hass=${this.hass}
          .schema=${this._filteredReceiverSchema}
          .pendingChanges=${this._receiverPendingChanges}
          .validationErrors=${this._validationErrors}
          @value-changed=${this._handleReceiverValueChanged}
        ></hm-config-form>
      </div>
    `;
  }

  render() {
    if (this._loading) {
      return html`<div class="loading">${this._l("common.loading")}</div>`;
    }
    if (this._error && !this._receiverSchema && !this._senderSchema) {
      return html`<div class="error">${this._error}</div>`;
    }

    return html`
      <ha-icon-button
        class="back-button"
        .path=${"M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"}
        @click=${this._handleBack}
        .label=${this._l("common.back")}
      ></ha-icon-button>

      <div class="config-header">
        <h2>${this._l("link_config.title")}</h2>
        <div class="link-info-bar">
          <div class="link-endpoint">
            <span class="link-label">${this._l("link_config.sender")}</span>
            ${this.senderDeviceName
              ? html`<span class="link-device-name">${this.senderDeviceName}</span>`
              : nothing}
            ${this.senderDeviceModel || this.senderChannelTypeLabel
              ? html`<span class="link-device-detail">
                  ${this.senderDeviceModel}${this.senderChannelTypeLabel
                    ? html` &middot; ${this.senderChannelTypeLabel}`
                    : nothing}
                </span>`
              : nothing}
            <span class="link-address">${this.senderAddress}</span>
          </div>
          <ha-icon class="link-direction-arrow" .icon=${"mdi:arrow-right"}></ha-icon>
          <div class="link-endpoint">
            <span class="link-label">${this._l("link_config.receiver")}</span>
            ${this.receiverDeviceName
              ? html`<span class="link-device-name">${this.receiverDeviceName}</span>`
              : nothing}
            ${this.receiverDeviceModel || this.receiverChannelTypeLabel
              ? html`<span class="link-device-detail">
                  ${this.receiverDeviceModel}${this.receiverChannelTypeLabel
                    ? html` &middot; ${this.receiverChannelTypeLabel}`
                    : nothing}
                </span>`
              : nothing}
            <span class="link-address">${this.receiverAddress}</span>
          </div>
        </div>
      </div>

      ${this._error ? html`<div class="error">${this._error}</div>` : nothing}
      ${this._renderProfileSelector()}
      ${this._hasReceiverParams() ? this._renderReceiverParams() : nothing}
      ${this._hasSenderParams()
        ? html`
            <div class="param-section">
              <h3>${this._l("link_config.sender_params")}</h3>
              <hm-config-form
                .hass=${this.hass}
                .schema=${this._senderSchema}
                .pendingChanges=${this._senderPendingChanges}
                .validationErrors=${this._senderValidationErrors}
                @value-changed=${this._handleSenderValueChanged}
              ></hm-config-form>
            </div>
          `
        : nothing}
      ${!this._hasReceiverParams() && !this._hasSenderParams()
        ? html`<div class="empty-state">${this._l("link_config.no_params")}</div>`
        : nothing}

      <div class="action-bar">
        <ha-button
          outlined
          @click=${this._handleDiscard}
          .disabled=${!this._isDirty || this._saving}
        >
          ${this._l("link_config.discard")}
        </ha-button>
        <ha-button raised @click=${this._handleSave} .disabled=${!this._isDirty || this._saving}>
          ${this._saving ? this._l("channel_config.saving") : this._l("common.save")}
        </ha-button>
      </div>
    `;
  }

  static styles = [
    sharedStyles,
    css`
      .config-header {
        margin-bottom: 16px;
      }

      .config-header h2 {
        margin: 8px 0 4px;
        font-size: 20px;
        font-weight: 400;
      }

      .link-info-bar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px;
        background: var(--secondary-background-color, #fafafa);
        border-radius: 8px;
        margin-top: 8px;
      }

      .link-endpoint {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .link-label {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--secondary-text-color);
        font-weight: 500;
      }

      .link-device-name {
        font-size: 14px;
        font-weight: 500;
      }

      .link-device-detail {
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .link-address {
        font-family: monospace;
        font-size: 13px;
        color: var(--secondary-text-color);
      }

      .link-direction-arrow {
        --ha-icon-display-size: 24px;
        color: var(--primary-color, #03a9f4);
        flex-shrink: 0;
      }

      .profile-selector {
        margin: 16px 0;
        padding: 12px;
        background: var(--secondary-background-color, #fafafa);
        border-radius: 8px;
      }

      .profile-selector ha-select {
        width: 100%;
      }

      .profile-description {
        margin: 8px 0 0;
        font-size: 13px;
        color: var(--secondary-text-color);
        line-height: 1.4;
      }

      .param-section {
        margin-bottom: 24px;
      }

      .param-section h3 {
        font-size: 16px;
        font-weight: 500;
        margin: 16px 0 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
      }

      .empty-state {
        padding: 24px;
        text-align: center;
        color: var(--secondary-text-color);
      }

      /* Keypress tabs */
      .keypress-tabs {
        display: flex;
        gap: 0;
        margin-bottom: 16px;
        border-bottom: 2px solid var(--divider-color, #e0e0e0);
      }

      .tab {
        padding: 10px 20px;
        font-size: 14px;
        font-weight: 500;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        cursor: pointer;
        color: var(--secondary-text-color);
        transition:
          color 0.2s,
          border-color 0.2s;
        user-select: none;
      }

      .tab:hover {
        color: var(--primary-text-color);
      }

      .tab.active {
        color: var(--primary-color, #03a9f4);
        border-bottom-color: var(--primary-color, #03a9f4);
      }

      .keypress-params {
        padding: 4px 0;
      }

      .common-params {
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid var(--divider-color, #e0e0e0);
      }

      /* Level parameter */
      .level-param .level-controls {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: none;
      }

      .last-value-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        cursor: pointer;
      }

      .last-value-toggle ha-checkbox {
        margin: -8px 0;
      }

      .slider-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .slider-group input[type="range"] {
        flex: 1;
        min-width: 80px;
      }

      .percent-display {
        font-size: 14px;
        font-weight: 500;
        min-width: 40px;
        text-align: right;
      }

      @media (max-width: 600px) {
        .link-info-bar {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }

        .link-direction-arrow {
          align-self: center;
        }

        .keypress-tabs {
          width: 100%;
        }

        .tab {
          flex: 1;
          text-align: center;
        }
      }
    `,
  ];
}
