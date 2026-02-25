import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import {
  getFormSchema,
  putParamset,
  sessionOpen,
  sessionSet,
  sessionUndo,
  sessionRedo,
  sessionSave,
  sessionDiscard,
} from "../api";
import { localize } from "../localize";
import { showConfirmationDialog, showToast } from "../ha-helpers";
import "../components/config-form";
import type { HomeAssistant, FormSchema } from "../types";

@safeCustomElement("hm-channel-config")
export class HmChannelConfig extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";
  @property() public interfaceId = "";
  @property() public channelAddress = "";
  @property() public channelType = "";
  @property() public paramsetKey = "MASTER";
  @property() public deviceName = "";

  @state() private _schema: FormSchema | null = null;
  @state() private _pendingChanges: Map<string, unknown> = new Map();
  @state() private _loading = true;
  @state() private _saving = false;
  @state() private _error = "";
  @state() private _validationErrors: Record<string, string> = {};

  // Session state
  @state() private _sessionActive = false;
  @state() private _canUndo = false;
  @state() private _canRedo = false;

  updated(changedProps: Map<string, unknown>): void {
    if (
      (changedProps.has("channelAddress") || changedProps.has("entryId")) &&
      this.entryId &&
      this.channelAddress
    ) {
      this._fetchSchema();
    }
  }

  private async _fetchSchema(): Promise<void> {
    this._loading = true;
    this._error = "";
    this._pendingChanges = new Map();
    this._validationErrors = {};
    this._canUndo = false;
    this._canRedo = false;
    try {
      this._schema = await getFormSchema(
        this.hass,
        this.entryId,
        this.interfaceId,
        this.channelAddress,
        this.channelType,
        this.paramsetKey,
      );
      // Open server-side session
      await sessionOpen(
        this.hass,
        this.entryId,
        this.interfaceId,
        this.channelAddress,
        this.paramsetKey,
      );
      this._sessionActive = true;
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
    return this._pendingChanges.size > 0;
  }

  private async _handleValueChanged(e: CustomEvent): Promise<void> {
    const { parameterId, value, currentValue } = e.detail;

    // Local tracking (existing)
    if (value === currentValue) {
      this._pendingChanges.delete(parameterId);
    } else {
      this._pendingChanges.set(parameterId, value);
    }
    this._pendingChanges = new Map(this._pendingChanges);

    // Server session sync
    if (this._sessionActive) {
      try {
        const state = await sessionSet(
          this.hass,
          this.entryId,
          this.channelAddress,
          parameterId,
          value,
          this.paramsetKey,
        );
        this._canUndo = state.can_undo;
        this._canRedo = state.can_redo;
        this._validationErrors = state.validation_errors;
      } catch {
        /* session sync is best-effort */
      }
    }
  }

  private async _handleUndo(): Promise<void> {
    if (!this._sessionActive) return;
    try {
      const result = await sessionUndo(
        this.hass,
        this.entryId,
        this.channelAddress,
        this.paramsetKey,
      );
      this._canUndo = result.can_undo;
      this._canRedo = result.can_redo;
      if (result.performed) {
        // Refetch schema to reflect session state, reset local tracking
        await this._refreshSchemaValues();
      }
    } catch (err) {
      this._error = String(err);
    }
  }

  private async _handleRedo(): Promise<void> {
    if (!this._sessionActive) return;
    try {
      const result = await sessionRedo(
        this.hass,
        this.entryId,
        this.channelAddress,
        this.paramsetKey,
      );
      this._canUndo = result.can_undo;
      this._canRedo = result.can_redo;
      if (result.performed) {
        await this._refreshSchemaValues();
      }
    } catch (err) {
      this._error = String(err);
    }
  }

  private async _refreshSchemaValues(): Promise<void> {
    try {
      this._schema = await getFormSchema(
        this.hass,
        this.entryId,
        this.interfaceId,
        this.channelAddress,
        this.channelType,
        this.paramsetKey,
      );
      this._pendingChanges = new Map();
    } catch (err) {
      this._error = String(err);
    }
  }

  private _handleDiscard(): void {
    this._pendingChanges = new Map();
    this._validationErrors = {};
    if (this._sessionActive) {
      sessionDiscard(this.hass, this.entryId, this.channelAddress, this.paramsetKey)
        .then(() => {
          this._canUndo = false;
          this._canRedo = false;
          // Reopen session for a fresh start
          return sessionOpen(
            this.hass,
            this.entryId,
            this.interfaceId,
            this.channelAddress,
            this.paramsetKey,
          );
        })
        .catch(() => {
          /* best-effort */
        });
    }
  }

  private _handleResetDefaults(): void {
    if (!this._schema) return;
    this._pendingChanges = new Map();
    for (const section of this._schema.sections) {
      for (const param of section.parameters) {
        if (
          param.writable &&
          param.default !== undefined &&
          param.default !== param.current_value
        ) {
          this._pendingChanges.set(param.id, param.default);
        }
      }
    }
    this._pendingChanges = new Map(this._pendingChanges);
  }

  private async _handleSave(): Promise<void> {
    if (!this._isDirty || this._saving) return;

    const changeCount = this._pendingChanges.size;
    const changeSummary = [...this._pendingChanges.entries()]
      .map(([key, value]) => {
        const param = this._findParameter(key);
        const label = param?.label ?? key;
        const oldValue = param?.current_value ?? "?";
        return `${label}: ${oldValue} \u2192 ${value}`;
      })
      .join("\n");

    const confirmed = await showConfirmationDialog(this, {
      title: this._l("channel_config.confirm_save_title"),
      text: `${this._l("channel_config.confirm_save_text", { count: changeCount })}\n\n${changeSummary}`,
      confirmText: this._l("common.save"),
      dismissText: this._l("common.cancel"),
    });
    if (!confirmed) return;

    this._saving = true;
    this._validationErrors = {};

    try {
      if (this._sessionActive) {
        // Use session save (validates + writes + logs history)
        const result = await sessionSave(
          this.hass,
          this.entryId,
          this.interfaceId,
          this.channelAddress,
          this.paramsetKey,
        );
        if (result.success) {
          this._pendingChanges = new Map();
          this._sessionActive = false;
          showToast(this, { message: this._l("channel_config.save_success") });
          await this._fetchSchema(); // Reopens session
        } else if (Object.keys(result.validation_errors).length > 0) {
          this._validationErrors = result.validation_errors;
          showToast(this, { message: this._l("channel_config.validation_failed") });
        } else {
          showToast(this, { message: this._l("channel_config.save_failed") });
        }
      } else {
        // Fallback to direct put
        const changes = Object.fromEntries(this._pendingChanges);
        const result = await putParamset(
          this.hass,
          this.entryId,
          this.interfaceId,
          this.channelAddress,
          changes,
          this.paramsetKey,
        );
        if (result.success) {
          this._pendingChanges = new Map();
          showToast(this, { message: this._l("channel_config.save_success") });
          await this._fetchSchema();
        } else if (Object.keys(result.validation_errors).length > 0) {
          this._validationErrors = result.validation_errors;
          showToast(this, { message: this._l("channel_config.validation_failed") });
        } else {
          showToast(this, { message: this._l("channel_config.save_failed") });
        }
      }
    } catch (err) {
      this._error = String(err);
      showToast(this, { message: this._l("channel_config.save_failed") });
    } finally {
      this._saving = false;
    }
  }

  private _findParameter(parameterId: string) {
    if (!this._schema) return undefined;
    for (const section of this._schema.sections) {
      const found = section.parameters.find((p) => p.id === parameterId);
      if (found) return found;
    }
    return undefined;
  }

  private async _handleBack(): Promise<void> {
    if (this._isDirty) {
      const confirmed = await showConfirmationDialog(this, {
        title: this._l("channel_config.unsaved_title"),
        text: this._l("channel_config.unsaved_warning"),
        confirmText: this._l("channel_config.discard"),
        dismissText: this._l("common.cancel"),
        destructive: true,
      });
      if (!confirmed) return;
    }
    // Clean up session
    if (this._sessionActive) {
      try {
        await sessionDiscard(this.hass, this.entryId, this.channelAddress, this.paramsetKey);
      } catch {
        /* best-effort */
      }
      this._sessionActive = false;
    }
    this.dispatchEvent(new CustomEvent("back", { bubbles: true, composed: true }));
  }

  render() {
    if (this._loading) {
      return html`<div class="loading">${this._l("common.loading")}</div>`;
    }
    if (this._error && !this._schema) {
      return html`<div class="error">${this._error}</div>`;
    }

    return html`
      <button class="back-button" @click=${this._handleBack}>◂ ${this._l("common.back")}</button>

      <div class="config-header">
        ${this.deviceName ? html`<h2>${this.deviceName}</h2>` : nothing}
        <div class="device-info">
          ${this.channelAddress} —
          ${this._schema?.channel_type_label || this._schema?.channel_type || ""} —
          ${this.paramsetKey}
        </div>
      </div>

      ${this._error ? html`<div class="error">${this._error}</div>` : nothing}
      ${this._schema
        ? html`
            <hm-config-form
              .hass=${this.hass}
              .schema=${this._schema}
              .pendingChanges=${this._pendingChanges}
              .validationErrors=${this._validationErrors}
              @value-changed=${this._handleValueChanged}
            ></hm-config-form>
          `
        : nothing}

      <div class="action-bar-split">
        <div class="action-bar-left">
          <button
            class="btn btn-icon"
            @click=${this._handleUndo}
            ?disabled=${!this._canUndo || this._saving}
            title="${this._l("channel_config.undo")}"
          >
            &#x21A9;
          </button>
          <button
            class="btn btn-icon"
            @click=${this._handleRedo}
            ?disabled=${!this._canRedo || this._saving}
            title="${this._l("channel_config.redo")}"
          >
            &#x21AA;
          </button>
        </div>
        <div class="action-bar-right">
          <button
            class="btn btn-secondary"
            @click=${this._handleResetDefaults}
            ?disabled=${this._saving}
          >
            ${this._l("channel_config.reset_defaults")}
          </button>
          <button
            class="btn btn-secondary"
            @click=${this._handleDiscard}
            ?disabled=${!this._isDirty || this._saving}
          >
            ${this._l("channel_config.discard")}
          </button>
          <button
            class="btn btn-primary"
            @click=${this._handleSave}
            ?disabled=${!this._isDirty || this._saving}
          >
            ${this._saving ? this._l("channel_config.saving") : this._l("channel_config.save")}
          </button>
        </div>
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

      .btn {
        padding: 8px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-family: inherit;
        border: 1px solid transparent;
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-primary {
        background: var(--primary-color, #03a9f4);
        color: #fff;
        border-color: var(--primary-color, #03a9f4);
      }

      .btn-primary:hover:not(:disabled) {
        opacity: 0.9;
      }

      .btn-secondary {
        background: transparent;
        color: var(--primary-text-color);
        border-color: var(--divider-color, #e0e0e0);
      }

      .btn-secondary:hover:not(:disabled) {
        background: var(--secondary-background-color, #f5f5f5);
      }

      .btn-icon {
        background: none;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        padding: 6px 10px;
        cursor: pointer;
        font-size: 16px;
        color: var(--primary-text-color);
      }

      .btn-icon:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .btn-icon:hover:not(:disabled) {
        background: var(--secondary-background-color, #f5f5f5);
      }

      .action-bar-split {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-top: 1px solid var(--divider-color);
      }

      .action-bar-left,
      .action-bar-right {
        display: flex;
        gap: 8px;
      }

      @media (max-width: 600px) {
        .action-bar-split {
          flex-direction: column;
          gap: 12px;
        }

        .action-bar-left,
        .action-bar-right {
          width: 100%;
          justify-content: stretch;
        }

        .action-bar-right {
          flex-direction: column;
        }

        .action-bar-right button {
          width: 100%;
        }
      }
    `,
  ];
}
