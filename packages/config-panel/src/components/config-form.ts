import { LitElement, html, css, nothing } from "lit";
import { property } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import "./form-parameter";
import type { HomeAssistant, FormSchema, FormParameter } from "../types";

@safeCustomElement("hm-config-form")
export class HmConfigForm extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public schema!: FormSchema;
  @property({ attribute: false }) public pendingChanges: Map<string, unknown> = new Map();
  @property({ attribute: false }) public validationErrors: Record<string, string> = {};

  private _getEffectiveValue(param: FormParameter): unknown {
    if (this.pendingChanges.has(param.id)) {
      return this.pendingChanges.get(param.id);
    }
    return param.current_value;
  }

  private _isModified(param: FormParameter): boolean {
    return this.pendingChanges.has(param.id);
  }

  render() {
    if (!this.schema || !this.schema.sections) {
      return nothing;
    }

    return html`
      ${this.schema.sections.map(
        (section) => html`
          <div class="form-section">
            <div class="section-header">${section.title}</div>
            ${section.parameters.map(
              (param) => html`
                <hm-form-parameter
                  .hass=${this.hass}
                  .parameter=${param}
                  .value=${this._getEffectiveValue(param)}
                  .modified=${this._isModified(param)}
                  .validationError=${this.validationErrors[param.id] ?? ""}
                  @value-changed=${this._handleValueChanged}
                ></hm-form-parameter>
              `,
            )}
          </div>
        `,
      )}
    `;
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
    `,
  ];
}
