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
} from "@hmip/schedule-core";
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
      <div class="editor-overlay" @click=${this._handleClose}>
        <div class="editor-dialog" @click=${(e: Event) => e.stopPropagation()}>
          <div class="editor-header">
            <h3>${this.isNewEvent ? this.translations.addEvent : this.translations.editEvent}</h3>
            <button @click=${this._handleClose} class="close-button">✕</button>
          </div>
          <div class="editor-content">
            ${this._renderTimeFields()} ${this._renderConditionFields()}
            ${this._renderWeekdayFields()} ${this._renderLevelFields()}
            ${this._renderDurationFields()} ${this._renderRampTimeFields()}
            ${this._renderChannelFields()} ${this._renderValidationErrors()}
          </div>
          <div class="editor-footer">
            <button @click=${this._handleClose} class="button-secondary">
              ${this.translations.cancel}
            </button>
            <button @click=${this._handleSave} class="button-primary">
              ${this.translations.save}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderValidationErrors() {
    if (this._validationErrors.length === 0) return html``;

    return html`
      <div class="validation-errors">
        <ul>
          ${this._validationErrors.map((err) => html`<li>${err}</li>`)}
        </ul>
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
        <select
          .value=${this._editingEntry.condition}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value as ConditionType;
            const updates: Partial<SimpleScheduleEntry> = { condition: value };
            if (value === "fixed_time") {
              updates.astro_type = null;
              updates.astro_offset_minutes = 0;
            } else if (this._editingEntry!.astro_type === null) {
              updates.astro_type = "sunrise";
            }
            this._updateEditingEntry(updates);
          }}
        >
          ${CONDITION_TYPES.map(
            (ct) => html`
              <option value=${ct} ?selected=${ct === this._editingEntry!.condition}>
                ${this.translations.conditionLabels[ct] || ct}
              </option>
            `,
          )}
        </select>
      </div>
      ${showAstroFields
        ? html`
            <div class="form-group">
              <label>${this.translations.astroSunrise}/${this.translations.astroSunset}</label>
              <select
                .value=${this._editingEntry.astro_type || "sunrise"}
                @change=${(e: Event) => {
                  const value = (e.target as HTMLSelectElement).value as AstroType;
                  this._updateEditingEntry({ astro_type: value });
                }}
              >
                <option value="sunrise" ?selected=${this._editingEntry.astro_type === "sunrise"}>
                  ${this.translations.astroSunrise}
                </option>
                <option value="sunset" ?selected=${this._editingEntry.astro_type === "sunset"}>
                  ${this.translations.astroSunset}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>${this.translations.astroOffset}</label>
              <input
                type="number"
                min="-720"
                max="720"
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
                <input
                  type="checkbox"
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
                />
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
              <select
                .value=${String(this._editingEntry.level)}
                @change=${(e: Event) => {
                  const value = parseInt((e.target as HTMLSelectElement).value, 10);
                  this._updateEditingEntry({ level: value });
                }}
              >
                <option value="0">${this.translations.levelOff}</option>
                <option value="1">${this.translations.levelOn}</option>
              </select>
            `
          : html`
              <input
                type="range"
                min="0"
                max="100"
                .value=${String(Math.round(this._editingEntry.level * 100))}
                @input=${(e: Event) => {
                  const value = parseInt((e.target as HTMLInputElement).value, 10) / 100;
                  this._updateEditingEntry({ level: value });
                }}
              />
              <span>${Math.round(this._editingEntry.level * 100)}%</span>
            `}
      </div>
      ${config?.hasLevel2
        ? html`
            <div class="form-group">
              <label>${this.translations.slat}</label>
              <input
                type="range"
                min="0"
                max="100"
                .value=${String(Math.round((this._editingEntry.level_2 || 0) * 100))}
                @input=${(e: Event) => {
                  const value = parseInt((e.target as HTMLInputElement).value, 10) / 100;
                  this._updateEditingEntry({ level_2: value });
                }}
              />
              <span>${Math.round((this._editingEntry.level_2 || 0) * 100)}%</span>
            </div>
          `
        : ""}
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
          <select
            .value=${durationUnit}
            @change=${(e: Event) => {
              const unit = (e.target as HTMLSelectElement).value as DurationUnit;
              if (durationValue > 0) {
                this._updateEditingEntry({ duration: buildDuration(durationValue, unit) });
              }
            }}
          >
            ${DURATION_UNITS.map(
              (u) => html` <option value=${u} ?selected=${u === durationUnit}>${u}</option> `,
            )}
          </select>
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
          <select
            .value=${rampUnit}
            @change=${(e: Event) => {
              const unit = (e.target as HTMLSelectElement).value as DurationUnit;
              if (rampValue > 0) {
                this._updateEditingEntry({ ramp_time: buildDuration(rampValue, unit) });
              }
            }}
          >
            ${DURATION_UNITS.map(
              (u) => html` <option value=${u} ?selected=${u === rampUnit}>${u}</option> `,
            )}
          </select>
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
                  <input
                    type="checkbox"
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
                  />
                  ${info.name || key}
                </label>
              `;
            })}
          </div>
        </div>
      `;
    }

    // Fallback: text input
    return html`
      <div class="form-group">
        <label>${this.translations.channels}</label>
        <input
          type="text"
          .value=${this._editingEntry.target_channels.join(", ")}
          @input=${(e: Event) => {
            const value = (e.target as HTMLInputElement).value;
            const channels = value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            this._updateEditingEntry({ target_channels: channels });
          }}
          placeholder="1_1, 2_1"
        />
      </div>
    `;
  }
}
