import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { localize } from "../localize";
import type { HomeAssistant, FormParameter } from "../types";

@safeCustomElement("hm-time-selector")
export class HmTimeSelector extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public baseParam!: FormParameter;
  @property({ attribute: false }) public factorParam!: FormParameter;
  @property({ type: Number }) public baseValue = 0;
  @property({ type: Number }) public factorValue = 0;
  @property({ attribute: false })
  public presets: Array<{ base: number; factor: number; label: string }> = [];
  @property({ type: Boolean }) public modified = false;

  @state() private _isCustom = false;

  private _l(key: string): string {
    return localize(this.hass, key);
  }

  private get _matchesPreset(): boolean {
    return this.presets.some((p) => p.base === this.baseValue && p.factor === this.factorValue);
  }

  private _emitChange(parameterId: string, value: number, currentValue: unknown): void {
    this.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { parameterId, value, currentValue },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handlePresetChange(e: Event): void {
    const val = (e.target as HTMLSelectElement).value;
    if (val === "custom") {
      this._isCustom = true;
      return;
    }
    this._isCustom = false;
    const [baseStr, factorStr] = val.split("-");
    const newBase = Number(baseStr);
    const newFactor = Number(factorStr);
    this._emitChange(this.baseParam.id, newBase, this.baseParam.current_value);
    this._emitChange(this.factorParam.id, newFactor, this.factorParam.current_value);
  }

  private _handleBaseChange(e: Event): void {
    const newBase = Number((e.target as HTMLInputElement).value);
    this._emitChange(this.baseParam.id, newBase, this.baseParam.current_value);
  }

  private _handleFactorChange(e: Event): void {
    const newFactor = Number((e.target as HTMLInputElement).value);
    this._emitChange(this.factorParam.id, newFactor, this.factorParam.current_value);
  }

  render() {
    const label = this.baseParam.label.replace(/ Base$/, "").replace(/ Basis$/, "");
    const matchesPreset = this._matchesPreset;
    const isCustom = this._isCustom && !matchesPreset;

    return html`
      <div class="time-selector">
        <div class="parameter-row">
          <div class="parameter-label">
            ${label} ${this.modified ? html`<span class="modified-dot"></span>` : nothing}
          </div>
          <div class="parameter-control">
            <select @change=${this._handlePresetChange}>
              ${this.presets.map(
                (p) => html`
                  <option
                    value="${p.base}-${p.factor}"
                    ?selected=${p.base === this.baseValue && p.factor === this.factorValue}
                  >
                    ${p.label}
                  </option>
                `,
              )}
              <option value="custom" ?selected=${!matchesPreset}>
                ${this._l("link_config.custom_time")}
              </option>
            </select>
          </div>
        </div>
        ${isCustom || !matchesPreset
          ? html`
              <div class="custom-time-inputs">
                <label>
                  ${this._l("time_selector.base")}:
                  <input
                    type="number"
                    min="0"
                    max="7"
                    .value=${String(this.baseValue)}
                    @change=${this._handleBaseChange}
                  />
                </label>
                <label>
                  ${this._l("time_selector.factor")}:
                  <input
                    type="number"
                    min="0"
                    max="31"
                    .value=${String(this.factorValue)}
                    @change=${this._handleFactorChange}
                  />
                </label>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  static styles = [
    sharedStyles,
    css`
      .time-selector {
        margin-bottom: 4px;
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

      select:focus {
        outline: none;
        border-color: var(--primary-color, #03a9f4);
      }

      .custom-time-inputs {
        display: flex;
        gap: 12px;
        padding: 8px 0 4px;
        margin-left: 16px;
      }

      .custom-time-inputs label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--secondary-text-color);
      }

      .custom-time-inputs input[type="number"] {
        width: 60px;
        padding: 4px 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
      }

      @media (max-width: 600px) {
        select {
          width: 100%;
          box-sizing: border-box;
        }
      }
    `,
  ];
}
