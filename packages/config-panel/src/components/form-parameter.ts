import { LitElement, html, css, nothing } from "lit";
import { property } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { localize } from "../localize";
import type { HomeAssistant, FormParameter } from "../types";

@safeCustomElement("hm-form-parameter")
export class HmFormParameter extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public parameter!: FormParameter;
  @property() public value: unknown = null;
  @property({ type: Boolean }) public modified = false;
  @property() public validationError = "";

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
      ${this.validationError
        ? html`<div class="validation-error">${this.validationError}</div>`
        : nothing}
    `;
  }

  private _renderWidget(param: FormParameter, readOnly: boolean) {
    switch (param.widget) {
      case "toggle":
        return html`
          <label class="toggle">
            <input
              type="checkbox"
              .checked=${Boolean(this.value)}
              ?disabled=${readOnly}
              @change=${(e: Event) => {
                this._emitChange((e.target as HTMLInputElement).checked);
              }}
            />
            <span class="toggle-label"
              >${this.value
                ? localize(this.hass, "form_parameter.toggle_on")
                : localize(this.hass, "form_parameter.toggle_off")}</span
            >
          </label>
        `;

      case "slider_with_input":
        return html`
          <div class="slider-group">
            <input
              type="range"
              .min=${String(param.min ?? 0)}
              .max=${String(param.max ?? 100)}
              .step=${String(param.step ?? 1)}
              .value=${String(this.value ?? param.min ?? 0)}
              ?disabled=${readOnly}
              @input=${(e: Event) => {
                const num = Number((e.target as HTMLInputElement).value);
                this._emitChange(param.type === "integer" ? Math.round(num) : num);
              }}
            />
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
          <select
            ?disabled=${readOnly}
            @change=${(e: Event) => {
              const idx = (e.target as HTMLSelectElement).selectedIndex;
              this._emitChange(idx);
            }}
          >
            ${(param.options ?? []).map(
              (opt, i) => html` <option value=${i} ?selected=${this.value === i}>${opt}</option> `,
            )}
          </select>
        `;

      case "radio_group":
        return html`
          <div class="radio-group">
            ${(param.options ?? []).map(
              (opt, i) => html`
                <label class="radio-item">
                  <input
                    type="radio"
                    name=${param.id}
                    .checked=${this.value === i}
                    ?disabled=${readOnly}
                    @change=${() => this._emitChange(i)}
                  />
                  ${opt}
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
          <button
            class="action-button"
            ?disabled=${readOnly}
            @click=${() => this._emitChange(true)}
          >
            ${param.label}
          </button>
        `;

      case "read_only":
        return html`<span class="read-only-value">${String(this.value ?? "")}</span>`;

      default:
        return html`<span class="read-only-value">${String(this.value ?? "")}</span>`;
    }
  }

  static styles = [
    sharedStyles,
    css`
      .read-only {
        opacity: 0.7;
      }

      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }

      .toggle input[type="checkbox"] {
        width: 18px;
        height: 18px;
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

      .number-input {
        width: 80px;
        padding: 4px 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
      }

      select {
        padding: 6px 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
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

      .action-button {
        padding: 6px 16px;
        border: 1px solid var(--primary-color, #03a9f4);
        color: var(--primary-color, #03a9f4);
        background: transparent;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }

      .read-only-value {
        font-size: 14px;
        color: var(--secondary-text-color);
      }

      @media (max-width: 600px) {
        .slider-group {
          width: 100%;
        }

        .number-input {
          width: 100%;
          box-sizing: border-box;
        }

        select {
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
