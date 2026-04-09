import { LitElement, html, css, nothing } from "lit";
import { property } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { localize } from "../localize";
import "./form-parameter";
import "./form-subset-select";
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
  @property({ type: Boolean }) public expertMode = false;
  @property() public entryId = "";
  @property() public interfaceId = "";
  @property() public channelAddress = "";

  private _customModePairs = new Set<string>();

  private _isDstParam(id: string): boolean {
    return id.startsWith("DST_START_") || id.startsWith("DST_END_");
  }

  private _detectDstGroups(section: FormSection): {
    startParams: FormParameter[];
    endParams: FormParameter[];
    dstIds: Set<string>;
  } {
    const startParams: FormParameter[] = [];
    const endParams: FormParameter[] = [];
    const dstIds = new Set<string>();
    for (const p of section.parameters) {
      if (p.id.startsWith("DST_START_")) {
        startParams.push(p);
        dstIds.add(p.id);
      } else if (p.id.startsWith("DST_END_")) {
        endParams.push(p);
        dstIds.add(p.id);
      }
    }
    return { startParams, endParams, dstIds };
  }

  private _formatMinutesAsTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  private _renderDstGroup(label: string, params: FormParameter[]) {
    return html`
      <div class="dst-group">
        <div class="dst-group-header">${label}</div>
        ${params.map((param) => {
          const value = this._getEffectiveValue(param);
          // Format TIME params (value in minutes) as HH:MM
          if (param.id.endsWith("_TIME")) {
            const minutes = Number(value ?? 0);
            return html`
              <div class="parameter-row">
                <div class="parameter-label">
                  ${param.label}
                  ${this._isModified(param) ? html`<span class="modified-dot"></span>` : nothing}
                </div>
                <div class="parameter-control">
                  <input
                    type="time"
                    .value=${this._formatMinutesAsTime(minutes)}
                    ?disabled=${!param.writable}
                    @change=${(e: Event) => {
                      const input = e.target as HTMLInputElement;
                      const [h, m] = input.value.split(":").map(Number);
                      this._dispatchValueChanged(param.id, h * 60 + m, param.current_value);
                    }}
                  />
                </div>
              </div>
            `;
          }
          return html`
            <hm-form-parameter
              .hass=${this.hass}
              .parameter=${param}
              .value=${value}
              .modified=${this._isModified(param)}
              .validationError=${this.validationErrors[param.id] ?? ""}
              .entryId=${this.entryId}
              .interfaceId=${this.interfaceId}
              .channelAddress=${this.channelAddress}
              @value-changed=${this._handleValueChanged}
            ></hm-form-parameter>
          `;
        })}
      </div>
    `;
  }

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
      // HmIP-style: PREFIX_UNIT + PREFIX_VALUE
      if (param.id.endsWith("_UNIT")) {
        const prefix = param.id.slice(0, -5);
        const valueParam = section.parameters.find((p) => p.id === `${prefix}_VALUE`);
        if (valueParam) {
          pairs.set(prefix, { unitParam: param, valueParam });
          pairedIds.add(param.id);
          pairedIds.add(valueParam.id);
        }
      }
      // Classic HM-style: PREFIX_TIME_BASE + PREFIX_TIME_FACTOR
      if (param.id.endsWith("_TIME_BASE")) {
        const prefix = param.id.slice(0, -10);
        const factorParam = section.parameters.find((p) => p.id === `${prefix}_TIME_FACTOR`);
        if (factorParam) {
          pairs.set(`${prefix}_TIME`, { unitParam: param, valueParam: factorParam });
          pairedIds.add(param.id);
          pairedIds.add(factorParam.id);
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

    // Collect subset member params to hide them individually
    const subsetMemberParams = new Set<string>();
    const subsetGroups = this.schema.subset_groups ?? [];
    for (const sg of subsetGroups) {
      for (const p of sg.member_params) {
        subsetMemberParams.add(p);
      }
    }
    // Track which subset groups have been rendered
    const renderedSubsets = new Set<string>();

    return html`
      ${this.schema.sections.map((section) => {
        const { pairs, pairedIds } = this._detectPairs(section);
        const { startParams, endParams, dstIds } = this._detectDstGroups(section);
        const rendered = new Set<string>();

        return html`
          <div class="form-section">
            <div class="section-header">${section.title}</div>
            ${section.parameters.map((param) => {
              if (rendered.has(param.id)) {
                return nothing;
              }

              // Hide expert-only parameters when expert mode is off
              if (param.hidden_by_default && !this.expertMode) {
                return nothing;
              }

              // DST group: render start/end with sub-headers on first DST param
              if (dstIds.has(param.id) && dstIds.size > 0) {
                for (const id of dstIds) rendered.add(id);
                return html`
                  ${startParams.length
                    ? this._renderDstGroup(
                        localize(this.hass, "config_form.dst_start"),
                        startParams,
                      )
                    : nothing}
                  ${endParams.length
                    ? this._renderDstGroup(localize(this.hass, "config_form.dst_end"), endParams)
                    : nothing}
                `;
              }

              // UC6: Hide subset member params — render subset widget instead
              if (subsetMemberParams.has(param.id)) {
                const sg = subsetGroups.find((g) => g.member_params.includes(param.id));
                if (sg && !renderedSubsets.has(sg.id)) {
                  renderedSubsets.add(sg.id);
                  return html`
                    <hm-form-subset-select
                      .hass=${this.hass}
                      .subsetGroup=${sg}
                      @value-changed=${this._handleValueChanged}
                    ></hm-form-subset-select>
                  `;
                }
                return nothing;
              }

              // UC2: Conditional visibility
              if (param.visible_when) {
                const triggerValue = this._getEffectiveValue({
                  id: param.visible_when.trigger_param,
                  current_value: this._getCurrentParamValue(param.visible_when.trigger_param),
                } as FormParameter);
                const matches = triggerValue === param.visible_when.trigger_value;
                const visible = param.visible_when.invert ? !matches : matches;
                if (!visible) {
                  return nothing;
                }
              }

              if (pairedIds.has(param.id)) {
                const pair = [...pairs.entries()].find(
                  ([, p]) => p.unitParam.id === param.id || p.valueParam.id === param.id,
                );
                if (pair) {
                  rendered.add(pair[1].unitParam.id);
                  rendered.add(pair[1].valueParam.id);
                  return this._renderTimePair(pair[0], pair[1]);
                }
              }

              return html`
                <hm-form-parameter
                  .hass=${this.hass}
                  .parameter=${param}
                  .value=${this._getEffectiveValue(param)}
                  .modified=${this._isModified(param)}
                  .validationError=${this.validationErrors[param.id] ?? ""}
                  .entryId=${this.entryId}
                  .interfaceId=${this.interfaceId}
                  .channelAddress=${this.channelAddress}
                  @value-changed=${this._handleValueChanged}
                ></hm-form-parameter>
              `;
            })}
          </div>
        `;
      })}
    `;
  }

  private _getCurrentParamValue(paramId: string): unknown {
    // Check pending changes first, then current schema values
    if (this.pendingChanges.has(paramId)) {
      return this.pendingChanges.get(paramId);
    }
    // Find in schema sections
    for (const section of this.schema?.sections ?? []) {
      const param = section.parameters.find((p) => p.id === paramId);
      if (param) return param.current_value;
    }
    return undefined;
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
            .options=${[
              ...TIME_PRESETS.map((preset, i) => ({
                value: String(i),
                label: lang === "de" ? preset.label_de : preset.label_en,
              })),
              { value: "custom", label: localize(this.hass, "form_parameter.custom_value") },
            ]}
            @selected=${(e: CustomEvent) =>
              this._handlePresetSelected(e, prefix, unitParam, valueParam)}
            @closed=${(e: Event) => e.stopPropagation()}
          ></ha-select>
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
      ${unitError ? html`<ha-alert alert-type="error">${unitError}</ha-alert>` : nothing}
      ${valueError ? html`<ha-alert alert-type="error">${valueError}</ha-alert>` : nothing}
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
          .entryId=${this.entryId}
          .interfaceId=${this.interfaceId}
          .channelAddress=${this.channelAddress}
          @value-changed=${this._handleValueChanged}
        ></hm-form-parameter>
        <hm-form-parameter
          .hass=${this.hass}
          .parameter=${valueParam}
          .value=${this._getEffectiveValue(valueParam)}
          .modified=${this._isModified(valueParam)}
          .validationError=${""}
          .entryId=${this.entryId}
          .interfaceId=${this.interfaceId}
          .channelAddress=${this.channelAddress}
          @value-changed=${this._handleValueChanged}
        ></hm-form-parameter>
      </div>
    `;
  }

  private _handlePresetSelected(
    e: CustomEvent,
    prefix: string,
    unitParam: FormParameter,
    valueParam: FormParameter,
  ): void {
    e.stopPropagation();
    const value = e.detail.value;

    if (!value || value === "custom") {
      this._customModePairs.add(prefix);
      this.requestUpdate();
      return;
    }

    this._customModePairs.delete(prefix);
    const preset = TIME_PRESETS[parseInt(value, 10)];
    if (preset) {
      const currentUnit = Number(this._getEffectiveValue(unitParam) ?? 0);
      const currentValue = Number(this._getEffectiveValue(valueParam) ?? 0);
      if (preset.unit === currentUnit && preset.value === currentValue) return;
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

      .dst-group {
        margin: 8px 0;
        padding-left: 16px;
        border-left: 2px solid var(--divider-color, #e0e0e0);
      }

      .dst-group-header {
        font-weight: 500;
        margin-bottom: 4px;
        color: var(--primary-text-color);
      }

      .dst-group input[type="time"] {
        padding: 4px 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
      }

      @media (max-width: 600px) {
        .custom-fields,
        .dst-group {
          padding-left: 8px;
        }

        .dst-group input[type="time"] {
          font-size: 16px;
          min-height: 44px;
          width: 100%;
          box-sizing: border-box;
        }
      }
    `,
  ];
}
