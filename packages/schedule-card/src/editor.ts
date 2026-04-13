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

  private _getScheduleEntityIds(): string[] {
    if (!this.hass?.states) return [];
    return Object.keys(this.hass.states).filter((entityId) => {
      if (!entityId.startsWith("sensor.")) return false;
      const entity = this.hass?.states?.[entityId];
      if (!entity) return false;
      return isValidScheduleEntity(entity.attributes);
    });
  }

  private _buildEntitySchema(): HaFormSchema[] {
    return [
      {
        name: "entities",
        required: true,
        selector: {
          entity: {
            multiple: true,
            include_entities: this._getScheduleEntityIds(),
          },
        },
      },
    ];
  }

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
      name: "show_import_export",
      selector: { boolean: {} },
      default: false,
    },
    {
      name: "collapse_after",
      selector: { number: { min: 0, max: 50, mode: "box" } },
      default: 5,
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

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }

    const entityData = {
      entities: this._getEntityIds(),
    };

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${entityData}
        .schema=${this._buildEntitySchema()}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._entitiesChanged}
      ></ha-form>

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
      show_import_export: "Show import/export buttons",
      collapse_after: "Collapse after (0 = off)",
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
  `;
}

if (!customElements.get("homematicip-local-schedule-card-editor")) {
  customElements.define("homematicip-local-schedule-card-editor", HomematicScheduleCardEditor);
}

declare global {
  interface HTMLElementTagNameMap {
    "homematicip-local-schedule-card-editor": HomematicScheduleCardEditor;
  }
}
