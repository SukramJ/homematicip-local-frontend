import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type { HomeAssistant, HomematicScheduleCardConfig, ScheduleDomain } from "./types";
import { isValidScheduleEntity } from "@hmip/schedule-core";

// Schema type for ha-form
interface HaFormSchema {
  name: string;
  selector: Record<string, unknown>;
  required?: boolean;
  default?: unknown;
}

// Fire event helper
const fireEvent = (node: HTMLElement, type: string, detail?: Record<string, unknown>): void => {
  const event = new CustomEvent(type, {
    bubbles: true,
    composed: true,
    detail,
  });
  node.dispatchEvent(event);
};

export class HomematicScheduleCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: HomematicScheduleCardConfig;

  private static readonly ENTITY_SCHEMA: HaFormSchema[] = [
    {
      name: "entities",
      required: true,
      selector: {
        entity: { domain: "sensor", integration: "homematicip_local", multiple: true },
      },
    },
  ];

  private static readonly OPTIONS_SCHEMA: HaFormSchema[] = [
    {
      name: "name",
      selector: { text: {} },
    },
    {
      name: "editable",
      selector: { boolean: {} },
      default: true,
    },
    {
      name: "schedule_domain",
      selector: {
        select: {
          options: [
            { value: "", label: "Auto (from entity)" },
            { value: "switch", label: "Switch" },
            { value: "light", label: "Light" },
            { value: "cover", label: "Cover" },
            { value: "valve", label: "Valve" },
          ],
          mode: "dropdown",
        },
      },
      default: "",
    },
    {
      name: "hour_format",
      selector: {
        select: {
          options: [
            { value: "24", label: "24h" },
            { value: "12", label: "12h (AM/PM)" },
          ],
        },
      },
      default: "24",
    },
  ];

  public setConfig(config: HomematicScheduleCardConfig): void {
    this._config = config;
  }

  private _getEntityIds(): string[] {
    if (!this._config) return [];
    if (this._config.entities) return this._config.entities;
    if (this._config.entity) return [this._config.entity];
    return [];
  }

  private _getCompatibleEntityIds(): string[] {
    return this._getEntityIds().filter((entityId) => {
      const entity = this.hass?.states?.[entityId];
      if (!entity) return false;
      return isValidScheduleEntity(entity.attributes);
    });
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }

    const entityData = {
      entities: this._getEntityIds(),
    };

    const incompatible = this._getEntityIds().filter(
      (id) => !this._getCompatibleEntityIds().includes(id),
    );

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${entityData}
        .schema=${HomematicScheduleCardEditor.ENTITY_SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._entitiesChanged}
      ></ha-form>

      ${incompatible.length > 0
        ? html`
            <div class="warning">
              ${incompatible.map(
                (id) => html`
                  <div class="warning-item">
                    ⚠ ${id}: requires schedule_type "default" and schedule_api_version "v1.0"
                  </div>
                `,
              )}
            </div>
          `
        : ""}

      <ha-form
        .hass=${this.hass}
        .data=${{ ...this._config, schedule_domain: this._config.schedule_domain || "" }}
        .schema=${HomematicScheduleCardEditor.OPTIONS_SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._optionsChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: HaFormSchema): string => {
    const labels: Record<string, string> = {
      entities: "Entities",
      name: "Card Name (optional)",
      editable: "Allow editing",
      schedule_domain: "Schedule Domain",
      hour_format: "Time format",
    };
    return labels[schema.name] || schema.name;
  };

  private _entitiesChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const newEntityIds = (ev.detail.value?.entities || []) as string[];

    const config = {
      ...this._config,
      entities: newEntityIds,
    };

    // Remove legacy single entity field
    delete config.entity;

    fireEvent(this, "config-changed", { config });
  }

  private _optionsChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const newOptions = ev.detail.value as Partial<HomematicScheduleCardConfig>;

    // Clean up empty schedule_domain
    const scheduleDomain = newOptions.schedule_domain as ScheduleDomain | "" | undefined;

    const config = {
      ...this._config,
      ...newOptions,
      entities: this._config.entities, // preserve
    };

    if (!scheduleDomain) {
      delete config.schedule_domain;
    }

    fireEvent(this, "config-changed", { config });
  }

  static styles = css`
    ha-form {
      display: block;
    }

    .warning {
      margin: 8px 0;
      padding: 8px 12px;
      background: var(--warning-color, #ffc107);
      color: var(--primary-text-color);
      border-radius: 4px;
      font-size: 13px;
    }

    .warning-item {
      padding: 2px 0;
    }
  `;
}

customElements.define("homematicip-local-schedule-card-editor", HomematicScheduleCardEditor);

declare global {
  interface HTMLElementTagNameMap {
    "homematicip-local-schedule-card-editor": HomematicScheduleCardEditor;
  }
}
