import { LitElement, css, html } from "lit";
import { property } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import type { HomeAssistant, SubsetGroup } from "../types";

@safeCustomElement("hm-form-subset-select")
export class HmFormSubsetSelect extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public subsetGroup!: SubsetGroup;

  protected render() {
    const group = this.subsetGroup;
    const currentId = group.current_option_id;

    const options = group.options.map((opt) => ({
      value: String(opt.id),
      label: opt.label,
    }));

    return html`
      <div class="subset-select">
        <div class="subset-label">${group.label}</div>
        <ha-select
          .value=${currentId != null ? String(currentId) : ""}
          .options=${options}
          @selected=${this._handleSelected}
          @closed=${(e: Event) => e.stopPropagation()}
        ></ha-select>
      </div>
    `;
  }

  private _handleSelected(e: CustomEvent): void {
    e.stopPropagation();
    const val = e.detail.value;
    if (!val) return;

    const selectedId = parseInt(val, 10);
    const option = this.subsetGroup.options.find((o) => o.id === selectedId);

    if (!option) return;

    // Dispatch value-changed for each member parameter
    for (const [paramId, value] of Object.entries(option.values)) {
      this.dispatchEvent(
        new CustomEvent("value-changed", {
          detail: {
            parameterId: paramId,
            value,
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  static styles = css`
    .subset-select {
      margin: 8px 0;
    }
    .subset-label {
      font-weight: 500;
      margin-bottom: 4px;
      color: var(--primary-text-color);
    }
    ha-select {
      min-width: 200px;
    }
  `;
}
