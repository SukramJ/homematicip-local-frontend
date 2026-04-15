import { LitElement, html, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "./safe-element";
import {
  WEEKDAYS,
  CONDITION_TYPES,
  DOMAIN_FIELD_CONFIG,
  DURATION_UNITS,
  isAstroCondition,
  parseDuration,
  buildDuration,
  validateEntry,
} from "@hmip/schedule-core";
import type {
  SimpleScheduleEntry,
  ScheduleDomain,
  ConditionType,
  AstroType,
  TargetChannelInfo,
  DurationUnit,
  LockMode,
  LockAction,
  LockPermission,
} from "@hmip/schedule-core";
import { LOCK_ACTIONS } from "@hmip/schedule-core";
import type { DeviceEditorTranslations, SaveDeviceEventDetail } from "./types";
import { deviceEditorStyles } from "./styles/device-editor-styles";

@safeCustomElement("hmip-device-schedule-editor")
export class HmipDeviceScheduleEditor extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) entry?: SimpleScheduleEntry;
  @property() groupNo?: string;
  @property({ type: Boolean }) isNewEvent = false;
  @property({ attribute: false }) domain?: ScheduleDomain;
  @property({ attribute: false }) availableTargetChannels?: Record<string, TargetChannelInfo>;
  @property({ attribute: false }) translations!: DeviceEditorTranslations;

  @state() private _editingEntry?: SimpleScheduleEntry;
  @state() private _validationErrors: string[] = [];

  static styles = deviceEditorStyles;

  protected willUpdate(changedProps: PropertyValues): void {
    // When opened or entry changes, copy entry to internal state
    if (changedProps.has("open") || changedProps.has("entry")) {
      if (this.open && this.entry) {
        this._editingEntry = { ...this.entry };
        this._validationErrors = [];
      } else if (!this.open) {
        this._editingEntry = undefined;
        this._validationErrors = [];
      }
    }
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);

    // Focus the first interactive element when the editor opens
    if (changedProps.has("open") && this.open && !changedProps.get("open")) {
      this.updateComplete.then(() => {
        const firstInput = this.shadowRoot?.querySelector<HTMLElement>(
          "input[type='time'], ha-select, input",
        );
        firstInput?.focus();
      });
    }
  }

  private _updateEditingEntry(updates: Partial<SimpleScheduleEntry>): void {
    if (!this._editingEntry) return;
    this._editingEntry = { ...this._editingEntry, ...updates };
    this._validationErrors = [];
    this.requestUpdate();
  }

  private _handleClose(): void {
    this.dispatchEvent(new CustomEvent("editor-closed", { bubbles: true, composed: true }));
  }

  private _handleSave(): void {
    if (!this._editingEntry || this.groupNo === undefined) {
      return;
    }

    const errors = validateEntry(this._editingEntry, this.domain);
    if (errors.length > 0) {
      this._validationErrors = errors.map((e) => `${e.field}: ${e.message}`);
      return;
    }

    this.dispatchEvent(
      new CustomEvent<SaveDeviceEventDetail>("save-event", {
        bubbles: true,
        composed: true,
        detail: { entry: { ...this._editingEntry }, groupNo: this.groupNo },
      }),
    );
  }

  protected render() {
    if (!this.open || !this._editingEntry) {
      return html``;
    }

    return html`
      <ha-dialog
        open
        @closed=${this._handleClose}
        .heading=${this.isNewEvent ? this.translations.addEvent : this.translations.editEvent}
      >
        <div class="editor-content">
          ${this._renderTimeFields()} ${this._renderConditionFields()}
          ${this._renderWeekdayFields()}
          ${this.domain === "lock" ? this._renderLockFields() : this._renderLevelFields()}
          ${this._renderDurationFields()} ${this._renderRampTimeFields()}
          ${this._renderChannelFields()} ${this._renderValidationErrors()}
          <div class="editor-footer">
            <ha-button @click=${this._handleClose}> ${this.translations.cancel} </ha-button>
            <ha-button @click=${this._handleSave}> ${this.translations.save} </ha-button>
          </div>
        </div>
      </ha-dialog>
    `;
  }

  private _renderValidationErrors() {
    return html`
      <div aria-live="polite">
        ${this._validationErrors.length > 0
          ? html`
              <ha-alert alert-type="error">
                <ul class="validation-list">
                  ${this._validationErrors.map((err) => html`<li>${err}</li>`)}
                </ul>
              </ha-alert>
            `
          : ""}
      </div>
    `;
  }

  private _renderTimeFields() {
    if (!this._editingEntry) return html``;

    return html`
      <div class="form-group">
        <label>${this.translations.time}</label>
        <input
          type="time"
          .value=${this._editingEntry.time}
          @change=${(e: Event) => {
            const target = e.target as HTMLInputElement;
            this._updateEditingEntry({ time: target.value });
          }}
        />
      </div>
    `;
  }

  private _renderConditionFields() {
    if (!this._editingEntry) return html``;

    const showAstroFields = isAstroCondition(this._editingEntry.condition);

    return html`
      <div class="form-group">
        <label>${this.translations.condition}</label>
        <ha-select
          .value=${this._editingEntry.condition}
          .options=${CONDITION_TYPES.map((ct) => ({
            value: ct,
            label: this.translations.conditionLabels[ct] || ct,
          }))}
          @selected=${(e: CustomEvent) => {
            e.stopPropagation();
            const value = e.detail.value as ConditionType;
            const updates: Partial<SimpleScheduleEntry> = { condition: value };
            if (value === "fixed_time") {
              updates.astro_type = null;
              updates.astro_offset_minutes = 0;
            } else if (this._editingEntry!.astro_type === null) {
              updates.astro_type = "sunrise";
            }
            this._updateEditingEntry(updates);
          }}
          @closed=${(e: Event) => e.stopPropagation()}
        ></ha-select>
      </div>
      ${showAstroFields
        ? html`
            <div class="form-group">
              <label>${this.translations.astroSunrise}/${this.translations.astroSunset}</label>
              <ha-select
                .value=${this._editingEntry.astro_type || "sunrise"}
                .options=${[
                  { value: "sunrise", label: this.translations.astroSunrise },
                  { value: "sunset", label: this.translations.astroSunset },
                ]}
                @selected=${(e: CustomEvent) => {
                  e.stopPropagation();
                  const value = e.detail.value as AstroType;
                  this._updateEditingEntry({ astro_type: value });
                }}
                @closed=${(e: Event) => e.stopPropagation()}
              ></ha-select>
            </div>
            <div class="form-group">
              <label>${this.translations.astroOffset}</label>
              <input
                type="number"
                min="-128"
                max="127"
                .value=${String(this._editingEntry.astro_offset_minutes)}
                @input=${(e: Event) => {
                  const value = parseInt((e.target as HTMLInputElement).value, 10);
                  if (!isNaN(value)) {
                    this._updateEditingEntry({ astro_offset_minutes: value });
                  }
                }}
              />
            </div>
          `
        : ""}
    `;
  }

  private _renderWeekdayFields() {
    if (!this._editingEntry) return html``;

    return html`
      <div class="form-group">
        <label>${this.translations.weekdaysLabel}</label>
        <div class="weekday-checkboxes">
          ${WEEKDAYS.map((weekday) => {
            const isChecked = this._editingEntry!.weekdays.includes(weekday);
            return html`
              <label class="checkbox-label">
                <ha-checkbox
                  .checked=${isChecked}
                  @change=${(e: Event) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    const currentWeekdays = [...this._editingEntry!.weekdays];
                    if (checked && !currentWeekdays.includes(weekday)) {
                      currentWeekdays.push(weekday);
                    } else if (!checked) {
                      const index = currentWeekdays.indexOf(weekday);
                      if (index > -1) currentWeekdays.splice(index, 1);
                    }
                    this._updateEditingEntry({ weekdays: currentWeekdays });
                  }}
                ></ha-checkbox>
                ${this.translations.weekdayShortLabels[weekday]}
              </label>
            `;
          })}
        </div>
      </div>
    `;
  }

  private _renderLevelFields() {
    if (!this._editingEntry) return html``;

    const config = this.domain ? DOMAIN_FIELD_CONFIG[this.domain] : undefined;
    const isBinary = config?.levelType === "binary";

    return html`
      <div class="form-group">
        <label>${this.translations.stateLabel}</label>
        ${isBinary
          ? html`
              <ha-select
                .value=${String(this._editingEntry.level)}
                .options=${[
                  { value: "0", label: this.translations.levelOff },
                  { value: "1", label: this.translations.levelOn },
                ]}
                @selected=${(e: CustomEvent) => {
                  e.stopPropagation();
                  const value = parseInt(e.detail.value, 10);
                  this._updateEditingEntry({ level: value });
                }}
                @closed=${(e: Event) => e.stopPropagation()}
              ></ha-select>
            `
          : html`
              <div class="slider-group">
                <ha-slider
                  min="0"
                  max="100"
                  .value=${Math.round(this._editingEntry.level * 100)}
                  @change=${(e: Event) => {
                    const value = Number((e.target as HTMLInputElement).value);
                    this._updateEditingEntry({ level: value / 100 });
                  }}
                ></ha-slider>
                <span class="slider-value">${Math.round(this._editingEntry.level * 100)}%</span>
              </div>
            `}
      </div>
      ${config?.hasLevel2
        ? html`
            <div class="form-group">
              <label>${this.translations.slat}</label>
              <div class="slider-group">
                <ha-slider
                  min="0"
                  max="100"
                  .value=${Math.round((this._editingEntry.level_2 || 0) * 100)}
                  @change=${(e: Event) => {
                    const value = Number((e.target as HTMLInputElement).value);
                    this._updateEditingEntry({ level_2: value / 100 });
                  }}
                ></ha-slider>
                <span class="slider-value"
                  >${Math.round((this._editingEntry.level_2 || 0) * 100)}%</span
                >
              </div>
            </div>
          `
        : ""}
    `;
  }

  private _renderLockFields() {
    if (!this._editingEntry) return html``;

    const lockMode = this._editingEntry.lock_mode || "door_lock";

    const lockActionLabels: Record<LockAction, string> = {
      lock_autorelock_end: this.translations.lockActionLockAutorelockEnd,
      lock_autorelock_start: this.translations.lockActionLockAutorelockStart,
      unlock_autorelock_end: this.translations.lockActionUnlockAutorelockEnd,
      autorelock_end: this.translations.lockActionAutorelockEnd,
    };

    return html`
      <div class="form-group">
        <label>${this.translations.lockMode}</label>
        <ha-select
          .value=${lockMode}
          @selected=${(e: CustomEvent) => {
            e.stopPropagation();
            const newMode = e.detail.value as LockMode;
            if (newMode === "door_lock") {
              this._updateEditingEntry({
                lock_mode: newMode,
                lock_action: "lock_autorelock_end",
                permission: null,
                level: 0,
              });
            } else {
              this._updateEditingEntry({
                lock_mode: newMode,
                lock_action: null,
                permission: "granted",
                level: 1,
              });
            }
          }}
          @closed=${(e: Event) => e.stopPropagation()}
        >
          <ha-list-item value="door_lock">${this.translations.lockModeDoorLock}</ha-list-item>
          <ha-list-item value="user_permission"
            >${this.translations.lockModeUserPermission}</ha-list-item
          >
        </ha-select>
      </div>

      ${lockMode === "door_lock"
        ? html`
            <div class="form-group">
              <label>${this.translations.stateLabel}</label>
              <ha-select
                .value=${this._editingEntry.lock_action || "lock_autorelock_end"}
                @selected=${(e: CustomEvent) => {
                  e.stopPropagation();
                  this._updateEditingEntry({ lock_action: e.detail.value as LockAction });
                }}
                @closed=${(e: Event) => e.stopPropagation()}
              >
                ${LOCK_ACTIONS.map(
                  (action) =>
                    html`<ha-list-item value=${action}>${lockActionLabels[action]}</ha-list-item>`,
                )}
              </ha-select>
            </div>
          `
        : html`
            <div class="form-group">
              <label>${this.translations.stateLabel}</label>
              <ha-select
                .value=${this._editingEntry.permission || "granted"}
                @selected=${(e: CustomEvent) => {
                  e.stopPropagation();
                  this._updateEditingEntry({ permission: e.detail.value as LockPermission });
                }}
                @closed=${(e: Event) => e.stopPropagation()}
              >
                <ha-list-item value="granted">${this.translations.permissionGranted}</ha-list-item>
                <ha-list-item value="not_granted"
                  >${this.translations.permissionNotGranted}</ha-list-item
                >
              </ha-select>
            </div>
          `}
    `;
  }

  private _renderDurationFields() {
    if (!this._editingEntry) return html``;
    const config = this.domain ? DOMAIN_FIELD_CONFIG[this.domain] : undefined;
    if (config && !config.hasDuration) return html``;

    const parsed = this._editingEntry.duration ? parseDuration(this._editingEntry.duration) : null;
    const durationValue = parsed?.value ?? 0;
    const durationUnit: DurationUnit = parsed?.unit ?? "s";

    return html`
      <div class="form-group">
        <label>${this.translations.duration}</label>
        <div class="duration-row">
          <input
            type="number"
            min="0"
            .value=${String(durationValue)}
            @input=${(e: Event) => {
              const value = parseFloat((e.target as HTMLInputElement).value);
              if (!isNaN(value) && value > 0) {
                this._updateEditingEntry({ duration: buildDuration(value, durationUnit) });
              } else {
                this._updateEditingEntry({ duration: null });
              }
            }}
          />
          <ha-select
            .value=${durationUnit}
            .options=${DURATION_UNITS.map((u) => ({ value: u, label: u }))}
            @selected=${(e: CustomEvent) => {
              e.stopPropagation();
              const unit = e.detail.value as DurationUnit;
              if (durationValue > 0) {
                this._updateEditingEntry({ duration: buildDuration(durationValue, unit) });
              }
            }}
            @closed=${(e: Event) => e.stopPropagation()}
          ></ha-select>
        </div>
      </div>
    `;
  }

  private _renderRampTimeFields() {
    if (!this._editingEntry) return html``;
    const config = this.domain ? DOMAIN_FIELD_CONFIG[this.domain] : undefined;
    if (config && !config.hasRampTime) return html``;

    const parsed = this._editingEntry.ramp_time
      ? parseDuration(this._editingEntry.ramp_time)
      : null;
    const rampValue = parsed?.value ?? 0;
    const rampUnit: DurationUnit = parsed?.unit ?? "s";

    return html`
      <div class="form-group">
        <label>${this.translations.rampTime}</label>
        <div class="duration-row">
          <input
            type="number"
            min="0"
            .value=${String(rampValue)}
            @input=${(e: Event) => {
              const value = parseFloat((e.target as HTMLInputElement).value);
              if (!isNaN(value) && value > 0) {
                this._updateEditingEntry({ ramp_time: buildDuration(value, rampUnit) });
              } else {
                this._updateEditingEntry({ ramp_time: null });
              }
            }}
          />
          <ha-select
            .value=${rampUnit}
            .options=${DURATION_UNITS.map((u) => ({ value: u, label: u }))}
            @selected=${(e: CustomEvent) => {
              e.stopPropagation();
              const unit = e.detail.value as DurationUnit;
              if (rampValue > 0) {
                this._updateEditingEntry({ ramp_time: buildDuration(rampValue, unit) });
              }
            }}
            @closed=${(e: Event) => e.stopPropagation()}
          ></ha-select>
        </div>
      </div>
    `;
  }

  private _renderChannelFields() {
    if (!this._editingEntry) return html``;

    // If available_target_channels metadata is present, render checkboxes
    if (this.availableTargetChannels && Object.keys(this.availableTargetChannels).length > 0) {
      return html`
        <div class="form-group">
          <label>${this.translations.channels}</label>
          <div class="channel-checkboxes">
            ${Object.entries(this.availableTargetChannels).map(([key, info]) => {
              const isChecked = this._editingEntry!.target_channels.includes(key);
              return html`
                <label class="checkbox-label">
                  <ha-checkbox
                    .checked=${isChecked}
                    @change=${(e: Event) => {
                      const checked = (e.target as HTMLInputElement).checked;
                      const channels = [...this._editingEntry!.target_channels];
                      if (checked && !channels.includes(key)) {
                        channels.push(key);
                      } else if (!checked) {
                        const index = channels.indexOf(key);
                        if (index > -1) channels.splice(index, 1);
                      }
                      this._updateEditingEntry({ target_channels: channels });
                    }}
                  ></ha-checkbox>
                  ${info.name || key}
                </label>
              `;
            })}
          </div>
        </div>
      `;
    }

    // No available channels metadata — backend handles channel assignment
    return html``;
  }
}
