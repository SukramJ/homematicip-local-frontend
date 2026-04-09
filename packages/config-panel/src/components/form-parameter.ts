import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { localize } from "../localize";
import { determineParameter } from "../api";
import { showToast } from "../ha-helpers";
import type { HomeAssistant, FormParameter } from "../types";
import "./form-preset-select";

/**
 * Resolves a raw option value to its translated display label.
 * Uses option_labels from the backend if available, falls back to the raw value.
 */
function resolveOptionLabel(param: FormParameter, rawValue: string): string {
  return param.option_labels?.[rawValue] ?? rawValue;
}

/**
 * Resolves a raw parameter value to its display text.
 * For dropdown/radio_group: maps numeric index to translated option label.
 * For toggle: maps boolean to translated On/Off.
 */
export function formatParameterValue(
  hass: HomeAssistant,
  param: FormParameter,
  value: unknown,
): string {
  if (param.options && typeof value === "number" && value >= 0 && value < param.options.length) {
    return resolveOptionLabel(param, param.options[value]);
  }
  if (param.widget === "toggle") {
    return value
      ? localize(hass, "form_parameter.toggle_on")
      : localize(hass, "form_parameter.toggle_off");
  }
  return String(value ?? "");
}

@safeCustomElement("hm-form-parameter")
export class HmFormParameter extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public parameter!: FormParameter;
  @property() public value: unknown = null;
  @property({ type: Boolean }) public modified = false;
  @property() public validationError = "";
  @property() public entryId = "";
  @property() public interfaceId = "";
  @property() public channelAddress = "";

  @state() private _helpExpanded = false;
  @state() private _detecting = false;

  private _getDisplayValue(value: unknown): string {
    return formatParameterValue(this.hass, this.parameter, value);
  }

  private _emitChange(newValue: unknown): void {
    this.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: {
          parameterId: this.parameter.id,
          value: newValue,
          currentValue: this.parameter.current_value,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private get _supportsAutoDetect(): boolean {
    return Boolean(this.parameter.operations && this.parameter.operations & 8);
  }

  private async _handleAutoDetect(): Promise<void> {
    if (this._detecting || !this.entryId || !this.interfaceId || !this.channelAddress) return;
    this._detecting = true;
    try {
      const result = await determineParameter(
        this.hass,
        this.entryId,
        this.interfaceId,
        this.channelAddress,
        this.parameter.id,
      );
      if (result.success) {
        this._emitChange(result.value);
      } else {
        showToast(this, { message: localize(this.hass, "form_parameter.detect_failed") });
      }
    } catch {
      showToast(this, { message: localize(this.hass, "form_parameter.detect_failed") });
    } finally {
      this._detecting = false;
    }
  }

  private _renderAutoDetectButton() {
    if (!this._supportsAutoDetect) return nothing;
    if (this._detecting) {
      return html`<ha-circular-progress indeterminate size="small"></ha-circular-progress>`;
    }
    return html`
      <ha-icon-button
        class="auto-detect-icon"
        .path=${"M7.5,5.6L5,7L6.4,4.5L5,2L7.5,3.4L10,2L8.6,4.5L10,7L7.5,5.6M19.5,15.4L22,14L20.6,16.5L22,19L19.5,17.6L17,19L18.4,16.5L17,14L19.5,15.4M22,2L20.6,4.5L22,7L19.5,5.6L17,7L18.4,4.5L17,2L19.5,3.4L22,2M13.34,12.78L15.78,10.34L13.66,8.22L11.22,10.66L13.34,12.78M14.37,7.29L16.71,9.63C17.1,10 17.1,10.65 16.71,11.04L5.04,22.71C4.65,23.1 4,23.1 3.63,22.71L1.29,20.37C0.9,20 0.9,19.35 1.29,18.96L12.96,7.29C13.35,6.9 14,6.9 14.37,7.29Z"}
        @click=${this._handleAutoDetect}
        .label=${localize(this.hass, "form_parameter.auto_detect")}
      ></ha-icon-button>
    `;
  }

  render() {
    const param = this.parameter;
    const readOnly = !param.writable;

    return html`
      <div class="parameter-row ${readOnly ? "read-only" : ""}">
        <div class="parameter-label">
          ${param.label}
          ${param.unit ? html`<span class="parameter-unit">(${param.unit})</span>` : nothing}
          ${param.description
            ? html`<ha-icon-button
                class="help-icon"
                .path=${"M11,18H13V16H11V18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,6A4,4 0 0,0 8,10H10A2,2 0 0,1 12,8A2,2 0 0,1 14,10C14,12 11,11.75 11,14H13C13,12.5 16,12.25 16,10A4,4 0 0,0 12,6Z"}
                @click=${() => {
                  this._helpExpanded = !this._helpExpanded;
                }}
                .label=${"Info"}
              ></ha-icon-button>`
            : nothing}
          ${this.modified ? html`<span class="modified-dot"></span>` : nothing}
        </div>
        <div class="parameter-control">
          ${this._renderWidget(param, readOnly)}${this._renderAutoDetectButton()}
        </div>
      </div>
      ${this._helpExpanded && param.description
        ? html`<ha-markdown
            .content=${param.description}
            class="parameter-description"
          ></ha-markdown>`
        : nothing}
      ${this._renderRangeHint(param)}
      ${this.validationError
        ? html`<ha-alert alert-type="error" id="error-${this.parameter.id}">
            ${this.validationError}
          </ha-alert>`
        : nothing}
    `;
  }

  private _renderRangeHint(param: FormParameter) {
    if (
      param.widget === "toggle" ||
      param.widget === "dropdown" ||
      param.widget === "radio_group" ||
      param.widget === "button" ||
      param.widget === "read_only"
    ) {
      return nothing;
    }
    if (param.min == null && param.max == null) return nothing;
    const parts: string[] = [];
    if (param.min != null) parts.push(`Min: ${param.min}`);
    if (param.max != null) parts.push(`Max: ${param.max}`);
    return html`<div class="range-hint">${parts.join(" · ")}</div>`;
  }

  private _renderWidget(param: FormParameter, readOnly: boolean) {
    // UC5: Render preset select when presets are available
    if (param.presets && param.presets.length > 0 && !readOnly) {
      return html`
        <hm-form-preset-select
          .hass=${this.hass}
          .presets=${param.presets}
          .allowCustom=${param.allow_custom_value ?? false}
          .value=${this.value}
          .parameterId=${param.id}
          @value-changed=${(e: CustomEvent) => {
            e.stopPropagation();
            this._emitChange(e.detail.value);
          }}
        ></hm-form-preset-select>
      `;
    }

    switch (param.widget) {
      case "toggle":
        return html`
          <ha-switch
            .checked=${Boolean(this.value)}
            .disabled=${readOnly}
            @change=${(e: Event) => {
              this._emitChange((e.target as HTMLInputElement).checked);
            }}
          ></ha-switch>
        `;

      case "slider_with_input":
        return html`
          <div class="slider-group">
            <ha-slider
              .min=${param.min ?? 0}
              .max=${param.max ?? 100}
              .step=${param.step ?? 1}
              .value=${Number(this.value ?? param.min ?? 0)}
              .disabled=${readOnly}
              @change=${(e: Event) => {
                const num = Number((e.target as HTMLInputElement).value);
                const newValue = param.type === "integer" ? Math.round(num) : num;
                if (newValue === this.value) return;
                this._emitChange(newValue);
              }}
            ></ha-slider>
            <input
              type="number"
              class="number-input"
              .min=${String(param.min ?? "")}
              .max=${String(param.max ?? "")}
              .step=${String(param.step ?? 1)}
              .value=${String(this.value ?? "")}
              ?disabled=${readOnly}
              @change=${(e: Event) => {
                const num = Number((e.target as HTMLInputElement).value);
                this._emitChange(param.type === "integer" ? Math.round(num) : num);
              }}
            />
          </div>
        `;

      case "number_input":
        return html`
          <input
            type="number"
            class="number-input"
            .min=${String(param.min ?? "")}
            .max=${String(param.max ?? "")}
            .step=${String(param.step ?? 1)}
            .value=${String(this.value ?? "")}
            ?disabled=${readOnly}
            @change=${(e: Event) => {
              const num = Number((e.target as HTMLInputElement).value);
              this._emitChange(param.type === "integer" ? Math.round(num) : num);
            }}
          />
        `;

      case "dropdown":
        return html`
          <ha-select
            .value=${String(this.value ?? 0)}
            .disabled=${readOnly}
            .options=${(param.options ?? []).map((opt, i) => ({
              value: String(i),
              label: resolveOptionLabel(param, opt),
            }))}
            @selected=${(e: CustomEvent) => {
              e.stopPropagation();
              const newValue = parseInt(e.detail.value, 10);
              if (Number.isNaN(newValue) || newValue === this.value) return;
              this._emitChange(newValue);
            }}
            @closed=${(e: Event) => e.stopPropagation()}
          ></ha-select>
        `;

      case "radio_group":
        return html`
          <div class="radio-group">
            ${(param.options ?? []).map(
              (opt, i) => html`
                <label class="radio-item">
                  <ha-radio
                    name=${param.id}
                    .checked=${this.value === i}
                    .disabled=${readOnly}
                    @change=${() => this._emitChange(i)}
                  ></ha-radio>
                  ${resolveOptionLabel(param, opt)}
                </label>
              `,
            )}
          </div>
        `;

      case "text_input":
        return html`
          <input
            type="text"
            .value=${String(this.value ?? "")}
            ?disabled=${readOnly}
            @change=${(e: Event) => {
              this._emitChange((e.target as HTMLInputElement).value);
            }}
          />
        `;

      case "button":
        return html`
          <ha-button outlined .disabled=${readOnly} @click=${() => this._emitChange(true)}>
            ${param.label}
          </ha-button>
        `;

      case "read_only":
        return html`<span class="read-only-value">${this._getDisplayValue(this.value)}</span>`;

      default:
        return html`<span class="read-only-value">${this._getDisplayValue(this.value)}</span>`;
    }
  }

  static styles = [
    sharedStyles,
    css`
      .read-only {
        opacity: 0.7;
      }

      .help-icon {
        --ha-icon-button-size: 28px;
        --ha-icon-button-icon-size: 16px;
        color: var(--secondary-text-color);
        opacity: 0.6;
        margin: -4px 0;
      }

      .help-icon:hover {
        opacity: 1;
        color: var(--primary-color, #03a9f4);
      }

      .auto-detect-icon {
        --ha-icon-button-size: 28px;
        --ha-icon-button-icon-size: 16px;
        color: var(--secondary-text-color);
        opacity: 0.7;
        margin: -4px 0;
        flex-shrink: 0;
      }

      .auto-detect-icon:hover {
        opacity: 1;
        color: var(--primary-color, #03a9f4);
      }

      .slider-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .slider-group ha-slider {
        flex: 1;
        min-width: 80px;
      }

      .number-input {
        width: 80px;
        padding: 4px 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
      }

      ha-select {
        min-width: 120px;
      }

      input[type="text"] {
        padding: 6px 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        min-width: 120px;
      }

      .radio-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .radio-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        cursor: pointer;
      }

      .read-only-value {
        font-size: 14px;
        color: var(--secondary-text-color);
      }

      .range-hint {
        font-size: 11px;
        color: var(--secondary-text-color);
        margin: 2px 0 4px;
        opacity: 0.8;
      }

      .parameter-description {
        display: block;
        font-size: 12px;
        color: var(--secondary-text-color);
        margin: 0 0 4px;
        padding: 8px 12px;
        background: var(--secondary-background-color, #fafafa);
        border-radius: 4px;
        line-height: 1.4;
        animation: fadeIn 0.15s ease-out;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @media (max-width: 600px) {
        .slider-group {
          width: 100%;
        }

        .number-input {
          width: 100%;
          box-sizing: border-box;
          font-size: 16px;
          min-height: 44px;
        }

        ha-select {
          width: 100%;
          box-sizing: border-box;
        }

        input[type="text"] {
          width: 100%;
          box-sizing: border-box;
          font-size: 16px;
          min-height: 44px;
        }

        .radio-item {
          min-height: 44px;
        }
      }
    `,
  ];
}
