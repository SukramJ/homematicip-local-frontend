import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant } from "@hmip/panel-api";
import type { SystemHealthCardConfig } from "./system-health-card";
import { fetchConfigEntryOptions, type ConfigEntryOption } from "../helpers";

interface HaFormSchema {
  name: string;
  selector: Record<string, unknown>;
  required?: boolean;
  default?: unknown;
}

const fireEvent = (node: HTMLElement, type: string, detail?: Record<string, unknown>): void => {
  node.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
};

@customElement("homematicip-system-health-editor")
export class HomematicipSystemHealthEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: SystemHealthCardConfig;
  @state() private _entryOptions: ConfigEntryOption[] = [];

  setConfig(config: SystemHealthCardConfig): void {
    this._config = config;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._loadEntries();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has("hass") && this.hass && this._entryOptions.length === 0) {
      this._loadEntries();
    }
  }

  private async _loadEntries(): Promise<void> {
    if (!this.hass) return;
    this._entryOptions = await fetchConfigEntryOptions(this.hass);
  }

  private _buildSchema(): HaFormSchema[] {
    return [
      {
        name: "entry_id",
        required: true,
        selector: {
          select: {
            options: this._entryOptions,
            mode: "dropdown",
          },
        },
      },
      { name: "title", selector: { text: {} } },
      { name: "show_incidents", selector: { boolean: {} }, default: false },
      {
        name: "max_incidents",
        selector: { number: { min: 1, max: 50, mode: "box" } },
        default: 5,
      },
      {
        name: "poll_interval",
        selector: {
          number: { min: 5, max: 300, mode: "box", unit_of_measurement: "s" },
        },
        default: 30,
      },
    ];
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${this._buildSchema()}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: HaFormSchema): string => {
    const labels: Record<string, string> = {
      entry_id: "Integration",
      title: "Title (optional)",
      show_incidents: "Show incidents",
      max_incidents: "Max incidents",
      poll_interval: "Poll interval",
    };
    return labels[schema.name] || schema.name;
  };

  private _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    fireEvent(this, "config-changed", { config: { ...this._config, ...ev.detail.value } });
  }

  static styles = css`
    ha-form {
      display: block;
    }
  `;
}
