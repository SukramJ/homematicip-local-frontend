import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import type { HomeAssistant } from "@hmip/panel-api";
import type { DeviceStatusCardConfig } from "./device-status-card";
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

export class HomematicipDeviceStatusEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private _config!: DeviceStatusCardConfig;
  @state() private _entryOptions: ConfigEntryOption[] = [];

  setConfig(config: DeviceStatusCardConfig): void {
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
      {
        name: "filter",
        selector: {
          select: {
            options: [
              { value: "problems", label: "Problems only" },
              { value: "all", label: "All devices" },
              { value: "unreachable", label: "Unreachable" },
              { value: "low_battery", label: "Low battery" },
              { value: "config_pending", label: "Config pending" },
            ],
            mode: "dropdown",
          },
        },
        default: "problems",
      },
      { name: "show_model", selector: { boolean: {} }, default: true },
      {
        name: "max_devices",
        selector: { number: { min: 0, max: 100, mode: "box" } },
        default: 10,
      },
      {
        name: "poll_interval",
        selector: {
          number: { min: 10, max: 600, mode: "box", unit_of_measurement: "s" },
        },
        default: 60,
      },
      { name: "interface_filter", selector: { text: {} } },
    ];
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${{ ...this._config, filter: this._config.filter || "problems" }}
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
      filter: "Filter",
      show_model: "Show device model",
      max_devices: "Max devices (0 = all)",
      poll_interval: "Poll interval",
      interface_filter: "Interface filter (optional)",
    };
    return labels[schema.name] || schema.name;
  };

  private _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const config = { ...this._config, ...ev.detail.value };
    if (!config.interface_filter) delete config.interface_filter;
    fireEvent(this, "config-changed", { config });
  }

  static styles = css`
    ha-form {
      display: block;
    }
  `;
}

const ELEMENT_NAME = "homematicip-device-status-editor";
if (!customElements.get(ELEMENT_NAME)) {
  customElements.define(ELEMENT_NAME, HomematicipDeviceStatusEditor);
}
