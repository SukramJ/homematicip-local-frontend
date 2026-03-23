import { LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import type { HomeAssistant } from "../types";

interface PresetEntry {
  value: number;
  label: string;
}

@safeCustomElement("hm-form-preset-select")
export class HmFormPresetSelect extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public presets: PresetEntry[] = [];
  @property({ type: Boolean }) public allowCustom = false;
  @property() public value: unknown = null;
  @property() public parameterId = "";

  @state() private _isCustom = false;

  protected firstUpdated(): void {
    this._isCustom = !this._isPresetValue(this.value);
  }

  protected render() {
    const selectValue = this._isCustom ? "__custom__" : String(this.value ?? "");

    const options = [
      ...this.presets.map((p) => ({ value: String(p.value), label: p.label })),
      ...(this.allowCustom ? [{ value: "__custom__", label: "Custom..." }] : []),
    ];

    return html`
      <div class="preset-select">
        <ha-select
          .value=${selectValue}
          .options=${options}
          @selected=${this._handlePresetSelected}
          @closed=${(e: Event) => e.stopPropagation()}
        ></ha-select>
        ${this._isCustom
          ? html`
              <input
                type="number"
                class="custom-input"
                .value=${String(this.value ?? "")}
                @change=${this._handleCustomChange}
              />
            `
          : nothing}
      </div>
    `;
  }

  private _isPresetValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    return this.presets.some((p) => p.value === value);
  }

  private _handlePresetSelected(e: CustomEvent): void {
    e.stopPropagation();
    const val = e.detail.value;
    if (!val) return;

    if (val === "__custom__") {
      this._isCustom = true;
      return;
    }

    this._isCustom = false;
    const numVal = parseFloat(val);
    this._dispatchChange(isNaN(numVal) ? val : numVal);
  }

  private _handleCustomChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    const numVal = parseFloat(target.value);
    this._dispatchChange(isNaN(numVal) ? target.value : numVal);
  }

  private _dispatchChange(value: unknown): void {
    this.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: {
          parameterId: this.parameterId,
          value,
          currentValue: this.value,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  static styles = css`
    .preset-select {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    ha-select {
      min-width: 150px;
    }
    .custom-input {
      width: 80px;
      padding: 8px;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 4px;
      font-size: 14px;
    }
  `;
}
