import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import { safeCustomElement } from "./safe-element";
import "./views/device-list";
import "./views/device-detail";
import "./views/channel-config";
import "./views/device-links";
import "./views/link-config";
import "./views/add-link";
import "./views/device-schedule";
import "./components/breadcrumb";
import { localize } from "./localize";
import { getUserPermissions } from "./api";
import type { HomeAssistant, PanelInfo, EntryInfo, UserPermissions } from "./types";
import type { BreadcrumbItem } from "./components/breadcrumb";

type PermissionScope = "schedule_edit" | "device_config" | "device_links" | "system_admin";

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
  @state() private _permissions?: UserPermissions;
  @state() private _senderDeviceName = "";
  @state() private _senderDeviceModel = "";
  @state() private _senderChannelTypeLabel = "";
  @state() private _receiverDeviceName = "";
  @state() private _receiverDeviceModel = "";
  @state() private _receiverChannelTypeLabel = "";

  connectedCallback(): void {
    super.connectedCallback();
    this._resolveEntryId().then(() => {
      this._loadPermissions();
      this._parseUrlHash();
    });
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
    window.history.pushState(null, "", `#${hash}`);
  }

  private static readonly _STORAGE_KEY = "hmip_selected_entry_id";

  private async _resolveEntryId(): Promise<void> {
    const entries = await this.hass.callWS<
      { entry_id: string; domain: string; state: string; title: string }[]
    >({
      type: "config_entries/get",
      domain: "homematicip_local",
    });
    const loadedEntries = entries
      .filter((e) => e.state === "loaded")
      .map((e) => ({ entry_id: e.entry_id, title: e.title }));

    this._entries = loadedEntries;

    if (this._entries.length === 1) {
      this._entryId = this._entries[0].entry_id;
    } else if (this._entries.length > 1) {
      const stored = localStorage.getItem(HomematicConfigPanel._STORAGE_KEY);
      if (stored && this._entries.some((e) => e.entry_id === stored)) {
        this._entryId = stored;
      }
    }
  }

  private async _loadPermissions(): Promise<void> {
    if (!this._entryId) return;
    try {
      this._permissions = await getUserPermissions(this.hass, this._entryId);
    } catch {
      // Fallback: if endpoint not available (backend not yet updated), assume admin
      this._permissions = { is_admin: true, permissions: [], backend: null };
    }
  }

  private _hasPermission(scope: PermissionScope): boolean {
    if (!this._permissions) return false;
    return this._permissions.is_admin || this._permissions.permissions.includes(scope);
  }

  private async _ensureView(view: PanelView): Promise<void> {
    switch (view) {
      case "ccu-dashboard":
        await import("./views/ccu-dashboard");
        break;
      case "integration-dashboard":
        await import("./views/integration-dashboard");
        break;
      case "change-history":
        await import("./views/change-history");
        break;
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
    this._ensureView(view);
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
    this._ensureView(this._view);
    this._updateUrlHash();
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private _renderTabs() {
    const tabs: { id: PanelTab; label: string }[] = [
      { id: "devices", label: this._l("tabs.devices") },
    ];
    if (this._hasPermission("system_admin")) {
      tabs.push({ id: "integration", label: this._l("tabs.integration") });
      if (this._permissions?.backend === "CCU") {
        tabs.push({ id: "ccu", label: this._l("tabs.ccu") });
      }
    }
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

  private _getBreadcrumbItems(): BreadcrumbItem[] {
    const items: BreadcrumbItem[] = [];
    const devicesLabel = this._l("tabs.devices");

    if (this._view === "device-list" || this._tab !== "devices") return items;

    items.push({
      label: devicesLabel,
      view: "device-list",
    });

    const deviceLabel = this._selectedDeviceName || this._selectedDevice || "...";

    if (this._view === "device-detail") {
      items.push({ label: deviceLabel });
      return items;
    }

    items.push({
      label: deviceLabel,
      view: "device-detail",
      detail: { device: this._selectedDevice, interfaceId: this._selectedInterfaceId },
    });

    switch (this._view) {
      case "channel-config":
        items.push({ label: this._selectedChannel || "..." });
        break;
      case "change-history":
        items.push({ label: this._l("change_history.title") });
        break;
      case "device-links":
        items.push({ label: this._l("device_links.title") });
        break;
      case "link-config":
        items.push({
          label: this._l("device_links.title"),
          view: "device-links",
          detail: { device: this._selectedDevice, interfaceId: this._selectedInterfaceId },
        });
        items.push({ label: this._l("link_config.title") });
        break;
      case "add-link":
        items.push({
          label: this._l("device_links.title"),
          view: "device-links",
          detail: { device: this._selectedDevice, interfaceId: this._selectedInterfaceId },
        });
        items.push({ label: this._l("add_link.title") });
        break;
      case "device-schedule":
        items.push({ label: this._l("device_schedule.title") });
        break;
    }

    return items;
  }

  private _handleBreadcrumbNavigate(e: CustomEvent): void {
    const { view, ...detail } = e.detail;
    if (view) this._navigateTo(view, detail);
  }

  private _renderBreadcrumb() {
    const items = this._getBreadcrumbItems();
    if (items.length === 0) return nothing;
    return html`
      <hm-breadcrumb
        .items=${items}
        @breadcrumb-navigate=${this._handleBreadcrumbNavigate}
      ></hm-breadcrumb>
    `;
  }

  private _renderToolbar() {
    return html`
      <div class="toolbar">
        <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
        <div class="main-title">${this._l("device_list.title")}</div>
      </div>
    `;
  }

  private _renderEntrySelector() {
    if (this._entries.length <= 1) return nothing;
    return html`
      <div class="entry-selector">
        <ha-select
          .label=${this._l("device_list.select_ccu")}
          .value=${this._entryId}
          .options=${this._entries.map((entry) => ({
            value: entry.entry_id,
            label: entry.title,
          }))}
          @selected=${(e: CustomEvent) => {
            e.stopPropagation();
            const entryId = e.detail.value;
            if (!entryId || entryId === this._entryId) return;
            this._entryId = entryId;
            localStorage.setItem(HomematicConfigPanel._STORAGE_KEY, entryId);
            this._loadPermissions();
            this._updateUrlHash();
          }}
          @closed=${(e: Event) => e.stopPropagation()}
        ></ha-select>
      </div>
    `;
  }

  render() {
    if (this._view === "integration-dashboard") {
      return html`
        ${this._renderToolbar()} ${this._renderEntrySelector()} ${this._renderTabs()}
        ${keyed(
          this._view,
          html`<div class="view-content">
            <hm-integration-dashboard
              .hass=${this.hass}
              .entryId=${this._entryId}
            ></hm-integration-dashboard>
          </div>`,
        )}
      `;
    }

    if (this._view === "ccu-dashboard") {
      return html`
        ${this._renderToolbar()} ${this._renderEntrySelector()} ${this._renderTabs()}
        ${keyed(
          this._view,
          html`<div class="view-content">
            <hm-ccu-dashboard .hass=${this.hass} .entryId=${this._entryId}></hm-ccu-dashboard>
          </div>`,
        )}
      `;
    }

    switch (this._view) {
      case "device-list":
        return html`
          ${this._renderToolbar()} ${this._renderEntrySelector()} ${this._renderTabs()}
          ${keyed(
            this._view,
            html`<div class="view-content">
              <hm-device-list
                .hass=${this.hass}
                .entryId=${this._entryId}
                @device-selected=${(e: CustomEvent) => this._navigateTo("device-detail", e.detail)}
              ></hm-device-list>
            </div>`,
          )}
        `;
      case "device-detail":
        return html`
          ${this._renderToolbar()} ${this._renderBreadcrumb()}
          ${keyed(
            this._view,
            html`<div class="view-content">
              <hm-device-detail
                .hass=${this.hass}
                .entryId=${this._entryId}
                .interfaceId=${this._selectedInterfaceId}
                .deviceAddress=${this._selectedDevice}
                @channel-selected=${(e: CustomEvent) =>
                  this._navigateTo("channel-config", e.detail)}
                @show-history=${(e: CustomEvent) => this._navigateTo("change-history", e.detail)}
                @show-links=${(e: CustomEvent) => this._navigateTo("device-links", e.detail)}
                @show-schedules=${(e: CustomEvent) => this._navigateTo("device-schedule", e.detail)}
                @back=${() => this._navigateTo("device-list")}
              ></hm-device-detail>
            </div>`,
          )}
        `;
      case "channel-config":
        return html`
          ${this._renderToolbar()} ${this._renderBreadcrumb()}
          ${keyed(
            this._view,
            html`<div class="view-content">
              <hm-channel-config
                .hass=${this.hass}
                .entryId=${this._entryId}
                .interfaceId=${this._selectedInterfaceId}
                .channelAddress=${this._selectedChannel}
                .channelType=${this._selectedChannelType}
                .paramsetKey=${this._selectedParamsetKey}
                .deviceName=${this._selectedDeviceName}
                .editable=${this._hasPermission("device_config")}
                @back=${() =>
                  this._navigateTo("device-detail", {
                    device: this._selectedDevice,
                    interfaceId: this._selectedInterfaceId,
                  })}
              ></hm-channel-config>
            </div>`,
          )}
        `;
      case "change-history":
        return html`
          ${this._renderToolbar()} ${this._renderBreadcrumb()}
          ${keyed(
            this._view,
            html`<div class="view-content">
              <hm-change-history
                .hass=${this.hass}
                .entryId=${this._entryId}
                .filterDevice=${this._selectedDevice}
                .editable=${this._hasPermission("system_admin")}
                @back=${() =>
                  this._navigateTo(
                    this._selectedDevice ? "device-detail" : "device-list",
                    this._selectedDevice
                      ? { device: this._selectedDevice, interfaceId: this._selectedInterfaceId }
                      : undefined,
                  )}
              ></hm-change-history>
            </div>`,
          )}
        `;
      case "device-links":
        return html`
          ${this._renderToolbar()} ${this._renderBreadcrumb()}
          ${keyed(
            this._view,
            html`<div class="view-content">
              <hm-device-links
                .hass=${this.hass}
                .entryId=${this._entryId}
                .interfaceId=${this._selectedInterfaceId}
                .deviceAddress=${this._selectedDevice}
                .deviceName=${this._selectedDeviceName}
                .editable=${this._hasPermission("device_links")}
                @configure-link=${(e: CustomEvent) => this._navigateTo("link-config", e.detail)}
                @add-link=${(e: CustomEvent) => this._navigateTo("add-link", e.detail)}
                @back=${() =>
                  this._navigateTo("device-detail", {
                    device: this._selectedDevice,
                    interfaceId: this._selectedInterfaceId,
                  })}
              ></hm-device-links>
            </div>`,
          )}
        `;
      case "link-config":
        return html`
          ${this._renderToolbar()} ${this._renderBreadcrumb()}
          ${keyed(
            this._view,
            html`<div class="view-content">
              <hm-link-config
                .hass=${this.hass}
                .entryId=${this._entryId}
                .interfaceId=${this._selectedInterfaceId}
                .senderAddress=${this._selectedSenderAddress}
                .receiverAddress=${this._selectedReceiverAddress}
                .editable=${this._hasPermission("device_links")}
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
            </div>`,
          )}
        `;
      case "add-link":
        return html`
          ${this._renderToolbar()} ${this._renderBreadcrumb()}
          ${keyed(
            this._view,
            html`<div class="view-content">
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
            </div>`,
          )}
        `;
      case "device-schedule":
        return html`
          ${this._renderToolbar()} ${this._renderBreadcrumb()}
          ${keyed(
            this._view,
            html`<div class="view-content">
              <hm-device-schedule
                .hass=${this.hass}
                .entryId=${this._entryId}
                .deviceAddress=${this._selectedDevice}
                .deviceName=${this._selectedDeviceName}
                .editable=${this._hasPermission("schedule_edit")}
                @back=${() =>
                  this._navigateTo(
                    this._selectedDevice ? "device-detail" : "device-list",
                    this._selectedDevice
                      ? { device: this._selectedDevice, interfaceId: this._selectedInterfaceId }
                      : undefined,
                  )}
              ></hm-device-schedule>
            </div>`,
          )}
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

    .toolbar {
      display: flex;
      align-items: center;
      height: 48px;
      margin: -16px -16px 16px -16px;
      padding: 0 4px;
      background-color: var(--app-header-background-color, var(--primary-color));
      color: var(--app-header-text-color, var(--text-primary-color, #fff));
      font-size: 20px;
      --ha-icon-button-color: var(--app-header-text-color, var(--text-primary-color, #fff));
    }

    .main-title {
      margin-left: 8px;
      font-weight: 400;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .entry-selector {
      margin-bottom: 16px;
    }

    .entry-selector ha-select {
      width: 100%;
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

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .view-content {
      animation: fadeIn 0.2s ease-out;
    }

    @media (max-width: 600px) {
      :host {
        padding: 8px;
      }

      .toolbar {
        margin: -8px -8px 8px -8px;
      }

      .tab-bar {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }

      .tab-bar::-webkit-scrollbar {
        display: none;
      }

      .tab {
        padding: 8px 12px;
        font-size: 13px;
        white-space: nowrap;
      }
    }
  `;
}
