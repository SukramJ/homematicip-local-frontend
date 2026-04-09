import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { localize } from "../localize";
import type { HomeAssistant, FormParameter } from "../types";

interface TimeUnit {
  base: number;
  multiplierSeconds: number;
  labelKey: string;
}

const TIME_UNITS: TimeUnit[] = [
  { base: 0, multiplierSeconds: 0, labelKey: "time_selector.unit_inactive" },
  { base: 1, multiplierSeconds: 0.1, labelKey: "time_selector.unit_100ms" },
  { base: 2, multiplierSeconds: 1, labelKey: "time_selector.unit_seconds" },
  { base: 3, multiplierSeconds: 5, labelKey: "time_selector.unit_5seconds" },
  { base: 4, multiplierSeconds: 10, labelKey: "time_selector.unit_10seconds" },
  { base: 5, multiplierSeconds: 60, labelKey: "time_selector.unit_minutes" },
  { base: 6, multiplierSeconds: 600, labelKey: "time_selector.unit_10minutes" },
  { base: 7, multiplierSeconds: 3600, labelKey: "time_selector.unit_hours" },
];

function formatDuration(totalSeconds: number, lang: string): string {
  if (totalSeconds <= 0) return "";

  const isGerman = lang === "de";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.round((totalSeconds % 1) * 1000);

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(isGerman ? `${hours} Std.` : `${hours}h`);
  }
  if (minutes > 0) {
    parts.push(isGerman ? `${minutes} Min.` : `${minutes}min`);
  }
  if (seconds >= 1) {
    parts.push(isGerman ? `${Math.floor(seconds)} Sek.` : `${Math.floor(seconds)}s`);
  } else if (ms > 0 && hours === 0 && minutes === 0) {
    parts.push(`${ms}ms`);
  }

  return parts.length > 0 ? `= ${parts.join(" ")}` : "";
}

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

  private get _lang(): string {
    return this.hass?.config?.language ?? "en";
  }

  private get _effectivePresets(): Array<{ base: number; factor: number; label: string }> {
    const presets = [...this.presets];
    const hasInactive = presets.some((p) => p.base === 0 && p.factor === 0);
    const hasPermanent = presets.some((p) => p.base === 7 && p.factor === 31);

    if (!hasInactive) {
      presets.unshift({
        base: 0,
        factor: 0,
        label: this._l("time_selector.unit_inactive"),
      });
    }
    if (!hasPermanent) {
      presets.push({
        base: 7,
        factor: 31,
        label: this._l("time_selector.permanent"),
      });
    }
    return presets;
  }

  private get _matchesPreset(): boolean {
    return this._effectivePresets.some(
      (p) => p.base === this.baseValue && p.factor === this.factorValue,
    );
  }

  private _getDurationText(base: number, factor: number): string {
    const unit = TIME_UNITS.find((u) => u.base === base);
    if (!unit || unit.multiplierSeconds === 0 || factor === 0) return "";
    return formatDuration(unit.multiplierSeconds * factor, this._lang);
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

  private _handlePresetChange(e: CustomEvent): void {
    e.stopPropagation();
    const val = e.detail.value;
    if (!val || val === "custom") {
      this._isCustom = true;
      return;
    }
    this._isCustom = false;
    const [baseStr, factorStr] = val.split("-");
    const newBase = Number(baseStr);
    const newFactor = Number(factorStr);
    if (newBase === this.baseValue && newFactor === this.factorValue) return;
    this._emitChange(this.baseParam.id, newBase, this.baseParam.current_value);
    this._emitChange(this.factorParam.id, newFactor, this.factorParam.current_value);
  }

  private _handleUnitChange(e: CustomEvent): void {
    e.stopPropagation();
    const val = e.detail.value;
    if (val == null) return;
    const newBase = Number(val);
    if (newBase === this.baseValue) return;
    this._emitChange(this.baseParam.id, newBase, this.baseParam.current_value);
  }

  private _handleValueChange(e: Event): void {
    const newFactor = Number((e.target as HTMLInputElement).value);
    this._emitChange(this.factorParam.id, newFactor, this.factorParam.current_value);
  }

  render() {
    const label = this.baseParam.label.replace(/ Base$/, "").replace(/ Basis$/, "");
    const matchesPreset = this._matchesPreset;
    const isCustom = this._isCustom && !matchesPreset;
    const durationText = this._getDurationText(this.baseValue, this.factorValue);

    return html`
      <div class="time-selector">
        <div class="parameter-row">
          <div class="parameter-label">
            ${label} ${this.modified ? html`<span class="modified-dot"></span>` : nothing}
          </div>
          <div class="parameter-control">
            <ha-select
              .value=${matchesPreset ? `${this.baseValue}-${this.factorValue}` : "custom"}
              .options=${[
                ...this._effectivePresets.map((p) => ({
                  value: `${p.base}-${p.factor}`,
                  label: p.label,
                })),
                { value: "custom", label: this._l("link_config.custom_time") },
              ]}
              @selected=${this._handlePresetChange}
              @closed=${(e: Event) => e.stopPropagation()}
            ></ha-select>
          </div>
        </div>
        ${matchesPreset && durationText
          ? html`<div class="duration-hint">${durationText}</div>`
          : nothing}
        ${isCustom || !matchesPreset
          ? html`
              <div class="custom-time-inputs">
                <div class="custom-field">
                  <label class="custom-label">${this._l("time_selector.unit")}:</label>
                  <ha-select
                    .value=${String(this.baseValue)}
                    .options=${TIME_UNITS.map((u) => ({
                      value: String(u.base),
                      label: this._l(u.labelKey),
                    }))}
                    @selected=${this._handleUnitChange}
                    @closed=${(e: Event) => e.stopPropagation()}
                  ></ha-select>
                </div>
                ${this.baseValue > 0
                  ? html`
                      <div class="custom-field">
                        <label class="custom-label">${this._l("time_selector.value")}:</label>
                        <input
                          type="number"
                          min="0"
                          max="31"
                          .value=${String(this.factorValue)}
                          @change=${this._handleValueChange}
                        />
                      </div>
                    `
                  : nothing}
                ${durationText ? html`<div class="duration-hint">${durationText}</div>` : nothing}
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

      ha-select {
        min-width: 120px;
      }

      .custom-time-inputs {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 0 4px;
        margin-left: 16px;
      }

      .custom-field {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .custom-label {
        font-size: 13px;
        color: var(--secondary-text-color);
        min-width: 70px;
      }

      .custom-field ha-select {
        min-width: 160px;
      }

      .custom-time-inputs input[type="number"] {
        width: 70px;
        padding: 4px 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
      }

      .duration-hint {
        font-size: 13px;
        color: var(--secondary-text-color);
        padding: 4px 0 0 16px;
        font-style: italic;
      }

      @media (max-width: 600px) {
        ha-select {
          width: 100%;
          box-sizing: border-box;
        }
      }
    `,
  ];
}
