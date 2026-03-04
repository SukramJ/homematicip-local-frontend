import { LitElement, html, css } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "./safe-element";
import "./views/device-list";
import "./views/device-detail";
import "./views/channel-config";
import "./views/change-history";
import "./views/device-links";
import "./views/link-config";
import "./views/add-link";
import "./views/device-schedule";
import "./views/integration-dashboard";
import "./views/ccu-dashboard";
import { localize } from "./localize";
import type { HomeAssistant, PanelInfo, EntryInfo } from "./types";

type PanelTab = "devices" | "integration" | "ccu";

type PanelView =
  | "device-list"
  | "device-detail"
  | "channel-config"
  | "change-history"
  | "device-links"
  | "link-config"
  | "add-link"
  | "device-schedule"
  | "integration-dashboard"
  | "ccu-dashboard";

@safeCustomElement("homematic-config")
export class HomematicConfigPanel extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public panel!: PanelInfo;
  @property({ type: Boolean, reflect: true }) public narrow = false;

  @state() private _tab: PanelTab = "devices";
  @state() private _view: PanelView = "device-list";
  @state() private _entryId = "";
  @state() private _entries: EntryInfo[] = [];
  @state() private _selectedDevice = "";
  @state() private _selectedInterfaceId = "";
  @state() private _selectedChannel = "";
  @state() private _selectedChannelType = "";
  @state() private _selectedParamsetKey = "MASTER";
  @state() private _selectedDeviceName = "";
  @state() private _selectedSenderAddress = "";
  @state() private _selectedReceiverAddress = "";
  @state() private _senderDeviceName = "";
  @state() private _senderDeviceModel = "";
  @state() private _senderChannelTypeLabel = "";
  @state() private _receiverDeviceName = "";
  @state() private _receiverDeviceModel = "";
  @state() private _receiverChannelTypeLabel = "";

  connectedCallback(): void {
    super.connectedCallback();
    this._resolveEntryId().then(() => this._parseUrlHash());
    window.addEventListener("popstate", this._onPopState);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("popstate", this._onPopState);
  }

  private _onPopState = (): void => {
    this._parseUrlHash();
  };

  private _parseUrlHash(): void {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);

    const tab = params.get("tab") as PanelTab | null;
    const view = params.get("view") as PanelView | null;
    const entryId = params.get("entry") || this._entryId;
    const device = params.get("device") || "";
    const interfaceId = params.get("interface") || "";
    const channel = params.get("channel") || "";
    const channelType = params.get("channel_type") || "";
    const paramsetKey = params.get("paramset") || "MASTER";
    const senderAddress = params.get("sender") || "";
    const receiverAddress = params.get("receiver") || "";

    if (entryId) this._entryId = entryId;
    if (tab) this._tab = tab;
    if (view) {
      this._navigateTo(view, {
        device,
        interfaceId,
        channel,
        channelType,
        paramsetKey,
        senderAddress,
        receiverAddress,
      });
    } else if (tab) {
      this._switchTab(tab);
    }
  }

  private _updateUrlHash(): void {
    const params = new URLSearchParams();
    params.set("tab", this._tab);
    params.set("view", this._view);
    if (this._entryId) params.set("entry", this._entryId);

    if (this._view !== "device-list") {
      if (this._selectedDevice) params.set("device", this._selectedDevice);
      if (this._selectedInterfaceId) params.set("interface", this._selectedInterfaceId);
    }
    if (this._view === "channel-config") {
      if (this._selectedChannel) params.set("channel", this._selectedChannel);
      if (this._selectedChannelType) params.set("channel_type", this._selectedChannelType);
      if (this._selectedParamsetKey !== "MASTER") {
        params.set("paramset", this._selectedParamsetKey);
      }
    }
    if (this._view === "link-config") {
      if (this._selectedSenderAddress) params.set("sender", this._selectedSenderAddress);
      if (this._selectedReceiverAddress) params.set("receiver", this._selectedReceiverAddress);
    }
    if (this._view === "add-link") {
      if (this._selectedChannel) params.set("channel", this._selectedChannel);
    }

    const hash = params.toString();
    window.history.replaceState(null, "", `#${hash}`);
  }

  private async _resolveEntryId(): Promise<void> {
    const entries = await this.hass.callWS<
      { entry_id: string; domain: string; state: string; title: string }[]
    >({
      type: "config_entries/get",
      domain: "homematicip_local",
    });
    this._entries = entries
      .filter((e) => e.state === "loaded")
      .map((e) => ({ entry_id: e.entry_id, title: e.title }));

    if (this._entries.length === 1) {
      this._entryId = this._entries[0].entry_id;
    }
  }

  private _navigateTo(
    view: PanelView,
    detail?: {
      device?: string;
      interfaceId?: string;
      channel?: string;
      channelType?: string;
      paramsetKey?: string;
      deviceName?: string;
      senderAddress?: string;
      receiverAddress?: string;
      senderDeviceName?: string;
      senderDeviceModel?: string;
      senderChannelTypeLabel?: string;
      receiverDeviceName?: string;
      receiverDeviceModel?: string;
      receiverChannelTypeLabel?: string;
    },
  ): void {
    this._view = view;
    if (detail?.device !== undefined) this._selectedDevice = detail.device;
    if (detail?.interfaceId !== undefined) this._selectedInterfaceId = detail.interfaceId;
    if (detail?.channel !== undefined) this._selectedChannel = detail.channel;
    if (detail?.channelType !== undefined) this._selectedChannelType = detail.channelType;
    if (detail?.paramsetKey !== undefined) this._selectedParamsetKey = detail.paramsetKey;
    if (detail?.deviceName !== undefined) this._selectedDeviceName = detail.deviceName;
    if (detail?.senderAddress !== undefined) this._selectedSenderAddress = detail.senderAddress;
    if (detail?.receiverAddress !== undefined)
      this._selectedReceiverAddress = detail.receiverAddress;
    if (detail?.senderDeviceName !== undefined) this._senderDeviceName = detail.senderDeviceName;
    if (detail?.senderDeviceModel !== undefined) this._senderDeviceModel = detail.senderDeviceModel;
    if (detail?.senderChannelTypeLabel !== undefined)
      this._senderChannelTypeLabel = detail.senderChannelTypeLabel;
    if (detail?.receiverDeviceName !== undefined)
      this._receiverDeviceName = detail.receiverDeviceName;
    if (detail?.receiverDeviceModel !== undefined)
      this._receiverDeviceModel = detail.receiverDeviceModel;
    if (detail?.receiverChannelTypeLabel !== undefined)
      this._receiverChannelTypeLabel = detail.receiverChannelTypeLabel;
    this._updateUrlHash();
  }

  private _switchTab(tab: PanelTab): void {
    this._tab = tab;
    switch (tab) {
      case "devices":
        this._view = "device-list";
        break;
      case "integration":
        this._view = "integration-dashboard";
        break;
      case "ccu":
        this._view = "ccu-dashboard";
        break;
    }
    this._updateUrlHash();
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private _renderTabs() {
    const tabs: { id: PanelTab; label: string }[] = [
      { id: "devices", label: this._l("tabs.devices") },
      { id: "integration", label: this._l("tabs.integration") },
      { id: "ccu", label: this._l("tabs.ccu") },
    ];
    return html`
      <div class="tab-bar">
        ${tabs.map(
          (t) => html`
            <button
              class="tab ${this._tab === t.id ? "active" : ""}"
              @click=${() => this._switchTab(t.id)}
            >
              ${t.label}
            </button>
          `,
        )}
      </div>
    `;
  }

  render() {
    if (this._view === "integration-dashboard") {
      return html`
        ${this._renderTabs()}
        <hm-integration-dashboard
          .hass=${this.hass}
          .entryId=${this._entryId}
        ></hm-integration-dashboard>
      `;
    }

    if (this._view === "ccu-dashboard") {
      return html`
        ${this._renderTabs()}
        <hm-ccu-dashboard .hass=${this.hass} .entryId=${this._entryId}></hm-ccu-dashboard>
      `;
    }

    switch (this._view) {
      case "device-list":
        return html`
          ${this._renderTabs()}
          <hm-device-list
            .hass=${this.hass}
            .entryId=${this._entryId}
            .entries=${this._entries}
            @entry-changed=${(e: CustomEvent) => {
              this._entryId = e.detail.entryId;
              this._updateUrlHash();
            }}
            @device-selected=${(e: CustomEvent) => this._navigateTo("device-detail", e.detail)}
          ></hm-device-list>
        `;
      case "device-detail":
        return html`
          <hm-device-detail
            .hass=${this.hass}
            .entryId=${this._entryId}
            .interfaceId=${this._selectedInterfaceId}
            .deviceAddress=${this._selectedDevice}
            @channel-selected=${(e: CustomEvent) => this._navigateTo("channel-config", e.detail)}
            @show-history=${(e: CustomEvent) => this._navigateTo("change-history", e.detail)}
            @show-links=${(e: CustomEvent) => this._navigateTo("device-links", e.detail)}
            @show-schedules=${(e: CustomEvent) => this._navigateTo("device-schedule", e.detail)}
            @back=${() => this._navigateTo("device-list")}
          ></hm-device-detail>
        `;
      case "channel-config":
        return html`
          <hm-channel-config
            .hass=${this.hass}
            .entryId=${this._entryId}
            .interfaceId=${this._selectedInterfaceId}
            .channelAddress=${this._selectedChannel}
            .channelType=${this._selectedChannelType}
            .paramsetKey=${this._selectedParamsetKey}
            .deviceName=${this._selectedDeviceName}
            @back=${() =>
              this._navigateTo("device-detail", {
                device: this._selectedDevice,
                interfaceId: this._selectedInterfaceId,
              })}
          ></hm-channel-config>
        `;
      case "change-history":
        return html`
          <hm-change-history
            .hass=${this.hass}
            .entryId=${this._entryId}
            .filterDevice=${this._selectedDevice}
            @back=${() =>
              this._navigateTo(
                this._selectedDevice ? "device-detail" : "device-list",
                this._selectedDevice
                  ? { device: this._selectedDevice, interfaceId: this._selectedInterfaceId }
                  : undefined,
              )}
          ></hm-change-history>
        `;
      case "device-links":
        return html`
          <hm-device-links
            .hass=${this.hass}
            .entryId=${this._entryId}
            .interfaceId=${this._selectedInterfaceId}
            .deviceAddress=${this._selectedDevice}
            .deviceName=${this._selectedDeviceName}
            @configure-link=${(e: CustomEvent) => this._navigateTo("link-config", e.detail)}
            @add-link=${(e: CustomEvent) => this._navigateTo("add-link", e.detail)}
            @back=${() =>
              this._navigateTo("device-detail", {
                device: this._selectedDevice,
                interfaceId: this._selectedInterfaceId,
              })}
          ></hm-device-links>
        `;
      case "link-config":
        return html`
          <hm-link-config
            .hass=${this.hass}
            .entryId=${this._entryId}
            .interfaceId=${this._selectedInterfaceId}
            .senderAddress=${this._selectedSenderAddress}
            .receiverAddress=${this._selectedReceiverAddress}
            .senderDeviceName=${this._senderDeviceName}
            .senderDeviceModel=${this._senderDeviceModel}
            .senderChannelTypeLabel=${this._senderChannelTypeLabel}
            .receiverDeviceName=${this._receiverDeviceName}
            .receiverDeviceModel=${this._receiverDeviceModel}
            .receiverChannelTypeLabel=${this._receiverChannelTypeLabel}
            @back=${() =>
              this._navigateTo("device-links", {
                device: this._selectedDevice,
                interfaceId: this._selectedInterfaceId,
              })}
          ></hm-link-config>
        `;
      case "add-link":
        return html`
          <hm-add-link
            .hass=${this.hass}
            .entryId=${this._entryId}
            .interfaceId=${this._selectedInterfaceId}
            .deviceAddress=${this._selectedDevice}
            @link-created=${() =>
              this._navigateTo("device-links", {
                device: this._selectedDevice,
                interfaceId: this._selectedInterfaceId,
              })}
            @back=${() =>
              this._navigateTo("device-links", {
                device: this._selectedDevice,
                interfaceId: this._selectedInterfaceId,
              })}
          ></hm-add-link>
        `;
      case "device-schedule":
        return html`
          <hm-device-schedule
            .hass=${this.hass}
            .entryId=${this._entryId}
            .deviceAddress=${this._selectedDevice}
            .deviceName=${this._selectedDeviceName}
            @back=${() =>
              this._navigateTo(
                this._selectedDevice ? "device-detail" : "device-list",
                this._selectedDevice
                  ? { device: this._selectedDevice, interfaceId: this._selectedInterfaceId }
                  : undefined,
              )}
          ></hm-device-schedule>
        `;
    }
  }

  static styles = css`
    :host {
      display: block;
      padding: 16px;
      max-width: 1200px;
      margin: 0 auto;
      font-family: var(--paper-font-body1_-_font-family, "Roboto", sans-serif);
      color: var(--primary-text-color);
      background-color: var(--primary-background-color);
    }

    .tab-bar {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      border-bottom: 2px solid var(--divider-color);
      padding-bottom: 0;
    }

    .tab {
      padding: 8px 16px;
      border: none;
      background: none;
      font-size: 14px;
      font-weight: 500;
      color: var(--secondary-text-color);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition:
        color 0.2s,
        border-color 0.2s;
      font-family: inherit;
    }

    .tab:hover {
      color: var(--primary-text-color);
    }

    .tab.active {
      color: var(--primary-color);
      border-bottom-color: var(--primary-color);
    }

    @media (max-width: 600px) {
      :host {
        padding: 8px;
      }

      .tab {
        padding: 8px 12px;
        font-size: 13px;
      }
    }
  `;
}
