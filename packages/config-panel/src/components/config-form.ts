import { LitElement, html, css, nothing } from "lit";
import { property } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { localize } from "../localize";
import "./form-parameter";
import type { HomeAssistant, FormSchema, FormParameter, FormSection } from "../types";

interface UnitValuePair {
  unitParam: FormParameter;
  valueParam: FormParameter;
}

const TIME_PRESETS: Array<{ unit: number; value: number; label_en: string; label_de: string }> = [
  { unit: 0, value: 0, label_en: "Not active", label_de: "Nicht aktiv" },
  { unit: 0, value: 1, label_en: "100ms", label_de: "100ms" },
  { unit: 0, value: 3, label_en: "300ms", label_de: "300ms" },
  { unit: 0, value: 5, label_en: "500ms", label_de: "500ms" },
  { unit: 0, value: 15, label_en: "1500ms", label_de: "1500ms" },
  { unit: 1, value: 1, label_en: "1 second", label_de: "1 Sekunde" },
  { unit: 1, value: 2, label_en: "2 seconds", label_de: "2 Sekunden" },
  { unit: 1, value: 3, label_en: "3 seconds", label_de: "3 Sekunden" },
  { unit: 1, value: 30, label_en: "30 seconds", label_de: "30 Sekunden" },
  { unit: 2, value: 1, label_en: "1 minute", label_de: "1 Minute" },
  { unit: 2, value: 2, label_en: "2 minutes", label_de: "2 Minuten" },
  { unit: 2, value: 4, label_en: "4 minutes", label_de: "4 Minuten" },
  { unit: 2, value: 15, label_en: "15 minutes", label_de: "15 Minuten" },
];

@safeCustomElement("hm-config-form")
export class HmConfigForm extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public schema!: FormSchema;
  @property({ attribute: false }) public pendingChanges: Map<string, unknown> = new Map();
  @property({ attribute: false }) public validationErrors: Record<string, string> = {};

  private _customModePairs = new Set<string>();

  private _getEffectiveValue(param: FormParameter): unknown {
    if (this.pendingChanges.has(param.id)) {
      return this.pendingChanges.get(param.id);
    }
    return param.current_value;
  }

  private _isModified(param: FormParameter): boolean {
    return this.pendingChanges.has(param.id);
  }

  private _detectPairs(section: FormSection): {
    pairs: Map<string, UnitValuePair>;
    pairedIds: Set<string>;
  } {
    const pairs = new Map<string, UnitValuePair>();
    const pairedIds = new Set<string>();

    for (const param of section.parameters) {
      if (param.id.endsWith("_UNIT") && param.options?.length) {
        const prefix = param.id.slice(0, -5);
        const valueParam = section.parameters.find((p) => p.id === `${prefix}_VALUE`);
        if (valueParam) {
          pairs.set(prefix, { unitParam: param, valueParam });
          pairedIds.add(param.id);
          pairedIds.add(valueParam.id);
        }
      }
    }

    return { pairs, pairedIds };
  }

  private _derivePairLabel(valueLabel: string, lang: string): string {
    if (lang === "de") {
      if (valueLabel.startsWith("Wert ")) {
        return valueLabel.slice(5);
      }
    } else {
      if (valueLabel.endsWith(" Value")) {
        return valueLabel.slice(0, -6);
      }
    }
    return valueLabel;
  }

  render() {
    if (!this.schema || !this.schema.sections) {
      return nothing;
    }

    return html`
      ${this.schema.sections.map((section) => {
        const { pairs, pairedIds } = this._detectPairs(section);
        const rendered = new Set<string>();

        return html`
          <div class="form-section">
            <div class="section-header">${section.title}</div>
            ${section.parameters.map((param) => {
              if (rendered.has(param.id)) {
                return nothing;
              }

              if (pairedIds.has(param.id)) {
                const prefix = param.id.endsWith("_UNIT")
                  ? param.id.slice(0, -5)
                  : param.id.slice(0, -6);
                const pair = pairs.get(prefix);
                if (pair) {
                  rendered.add(pair.unitParam.id);
                  rendered.add(pair.valueParam.id);
                  return this._renderTimePair(prefix, pair);
                }
              }

              return html`
                <hm-form-parameter
                  .hass=${this.hass}
                  .parameter=${param}
                  .value=${this._getEffectiveValue(param)}
                  .modified=${this._isModified(param)}
                  .validationError=${this.validationErrors[param.id] ?? ""}
                  @value-changed=${this._handleValueChanged}
                ></hm-form-parameter>
              `;
            })}
          </div>
        `;
      })}
    `;
  }

  private _renderTimePair(prefix: string, pair: UnitValuePair) {
    const { unitParam, valueParam } = pair;
    const lang = this.hass.config.language ?? "en";
    const unitValue = Number(this._getEffectiveValue(unitParam) ?? 0);
    const valueValue = Number(this._getEffectiveValue(valueParam) ?? 0);
    const modified = this._isModified(unitParam) || this._isModified(valueParam);
    const readOnly = !unitParam.writable || !valueParam.writable;
    const label = this._derivePairLabel(valueParam.label, lang);

    const matchingPreset = TIME_PRESETS.findIndex(
      (p) => p.unit === unitValue && p.value === valueValue,
    );
    const isCustom = this._customModePairs.has(prefix) || matchingPreset < 0;
    const selectedValue = isCustom ? "custom" : String(matchingPreset);

    return html`
      <div class="parameter-row ${readOnly ? "read-only" : ""}">
        <div class="parameter-label">
          ${label} ${modified ? html`<span class="modified-dot"></span>` : nothing}
        </div>
        <div class="parameter-control">
          <ha-select
            .value=${selectedValue}
            .disabled=${readOnly}
            @selected=${(e: Event) => this._handlePresetSelected(e, prefix, unitParam, valueParam)}
            @value-changed=${(e: Event) => e.stopPropagation()}
          >
            ${TIME_PRESETS.map(
              (preset, i) => html`
                <ha-list-item .value=${String(i)}>
                  ${lang === "de" ? preset.label_de : preset.label_en}
                </ha-list-item>
              `,
            )}
            <ha-list-item .value=${"custom"}>
              ${localize(this.hass, "form_parameter.custom_value")}
            </ha-list-item>
          </ha-select>
        </div>
      </div>
      ${this._renderPairValidationErrors(unitParam, valueParam)}
      ${isCustom ? this._renderCustomFields(unitParam, valueParam) : nothing}
    `;
  }

  private _renderPairValidationErrors(unitParam: FormParameter, valueParam: FormParameter) {
    const unitError = this.validationErrors[unitParam.id];
    const valueError = this.validationErrors[valueParam.id];
    if (!unitError && !valueError) {
      return nothing;
    }
    return html`
      ${unitError ? html`<div class="validation-error">${unitError}</div>` : nothing}
      ${valueError ? html`<div class="validation-error">${valueError}</div>` : nothing}
    `;
  }

  private _renderCustomFields(unitParam: FormParameter, valueParam: FormParameter) {
    return html`
      <div class="custom-fields">
        <hm-form-parameter
          .hass=${this.hass}
          .parameter=${unitParam}
          .value=${this._getEffectiveValue(unitParam)}
          .modified=${this._isModified(unitParam)}
          .validationError=${""}
          @value-changed=${this._handleValueChanged}
        ></hm-form-parameter>
        <hm-form-parameter
          .hass=${this.hass}
          .parameter=${valueParam}
          .value=${this._getEffectiveValue(valueParam)}
          .modified=${this._isModified(valueParam)}
          .validationError=${""}
          @value-changed=${this._handleValueChanged}
        ></hm-form-parameter>
      </div>
    `;
  }

  private _handlePresetSelected(
    e: Event,
    prefix: string,
    unitParam: FormParameter,
    valueParam: FormParameter,
  ): void {
    const value = (e.target as HTMLElement & { value: string }).value;

    if (value === "custom") {
      this._customModePairs.add(prefix);
      this.requestUpdate();
      return;
    }

    this._customModePairs.delete(prefix);
    const preset = TIME_PRESETS[parseInt(value, 10)];
    if (preset) {
      this._dispatchValueChanged(unitParam.id, preset.unit, unitParam.current_value);
      this._dispatchValueChanged(valueParam.id, preset.value, valueParam.current_value);
    }
  }

  private _dispatchValueChanged(parameterId: string, value: unknown, currentValue: unknown): void {
    this.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { parameterId, value, currentValue },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleValueChanged(e: CustomEvent): void {
    // Re-dispatch from child
    this.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: e.detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  static styles = [
    sharedStyles,
    css`
      .form-section {
        margin-bottom: 16px;
      }

      .custom-fields {
        padding-left: 16px;
        border-left: 2px solid var(--divider-color, #e0e0e0);
        margin: 0 0 8px;
      }
    `,
  ];
}
