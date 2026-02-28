import { LitElement, html, css, nothing } from "lit";
import { property } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { localize } from "../localize";
import type { HomeAssistant, FormParameter } from "../types";

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

  render() {
    const param = this.parameter;
    const readOnly = !param.writable;

    return html`
      <div class="parameter-row ${readOnly ? "read-only" : ""}">
        <div class="parameter-label">
          ${param.label}
          ${param.unit ? html`<span class="parameter-unit">(${param.unit})</span>` : nothing}
          ${this.modified ? html`<span class="modified-dot"></span>` : nothing}
        </div>
        <div class="parameter-control">${this._renderWidget(param, readOnly)}</div>
      </div>
      ${param.description
        ? html`<ha-markdown
            .content=${param.description}
            class="parameter-description"
          ></ha-markdown>`
        : nothing}
      ${this.validationError
        ? html`<div class="validation-error">${this.validationError}</div>`
        : nothing}
    `;
  }

  private _renderWidget(param: FormParameter, readOnly: boolean) {
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
              @value-changed=${(e: CustomEvent) => {
                e.stopPropagation();
                const num = Number(e.detail.value);
                this._emitChange(param.type === "integer" ? Math.round(num) : num);
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
            @selected=${(e: Event) => {
              const value = (e.target as HTMLElement & { value: string }).value;
              this._emitChange(parseInt(value, 10));
            }}
            @value-changed=${(e: Event) => e.stopPropagation()}
          >
            ${(param.options ?? []).map(
              (opt, i) => html`
                <ha-list-item .value=${String(i)} ?selected=${this.value === i}>
                  ${resolveOptionLabel(param, opt)}
                </ha-list-item>
              `,
            )}
          </ha-select>
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

      .parameter-description {
        display: block;
        font-size: 12px;
        color: var(--secondary-text-color);
        margin: -4px 0 4px;
        line-height: 1.4;
      }

      @media (max-width: 600px) {
        .slider-group {
          width: 100%;
        }

        .number-input {
          width: 100%;
          box-sizing: border-box;
        }

        ha-select {
          width: 100%;
          box-sizing: border-box;
        }

        input[type="text"] {
          width: 100%;
          box-sizing: border-box;
        }
      }
    `,
  ];
}
