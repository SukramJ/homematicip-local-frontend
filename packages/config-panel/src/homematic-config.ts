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
import "./views/loom-device-editor";
import "./components/breadcrumb";
import { localize } from "./localize";
import { getUserPermissions } from "./api";
import { showToast } from "./ha-helpers";
import { resolveLoomRoute } from "./loom-routes";
import { BACKEND_LOOM, getLoomEditorManifest } from "@hmip/panel-api";
import type { HomeAssistant, PanelInfo, EntryInfo, UserPermissions } from "./types";
import type { BreadcrumbItem } from "./components/breadcrumb";

type PermissionScope = "schedule_edit" | "device_config" | "device_links" | "system_admin";

/**
 * The Lit device views. A loom entry shows the daemon's editor in their place,
 * so a link into one of them on a loom entry opens the editor instead.
 */
const LIT_DEVICE_VIEWS: ReadonlySet<PanelView> = new Set<PanelView>([
  "device-detail",
  "channel-config",
  "change-history",
  "device-links",
  "link-config",
  "add-link",
  "device-schedule",
]);

/**
 * Backends that serve the `homematicip_local/ccu/*` command surface, and thus
 * the CCU dashboard (inbox, service/alarm messages, install mode, firmware,
 * signal quality, backup, system information).
 *
 * `backend` is `central.model`. The direct-CCU (aiohomematic) backend reports
 * `"CCU"`; the openccu-loom backend reports its own identity and *could* serve
 * this dashboard — it implements the same commands, and did serve it for a
 * while.
 *
 * It is excluded again deliberately. A loom daemon brings its own Config UI,
 * which covers inbox, firmware, signal quality, service messages and backups
 * for **every** CCU it serves, while this dashboard only ever showed the one
 * CCU behind the selected config entry. Two surfaces claiming the same
 * capability — one of them narrower — is worse than one, and the loom daemon
 * is the side that actually owns the state.
 *
 * The same argument shapes the device views: on a loom entry the panel does
 * not render its own Lit views but hosts the daemon's device editor
 * (`hm-loom-device-editor`), so the daemon stays the one implementation.
 */
const CCU_DASHBOARD_BACKENDS: readonly string[] = ["CCU"];

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
  | "loom-editor"
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
  /** The editor's channel number and sub-page, on a loom entry. */
  @state() private _loomChannel?: number;
  @state() private _loomSub?: string;

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
    const loomSub = params.get("sub") || undefined;

    // Only an entry this panel actually serves. A URL can name any id —
    // an old bookmark, an unloaded entry, or a loom entry the picker left
    // out (a non-admin user, a daemon without the editor). Honouring it
    // would put the panel on an entry it does not offer, and with a single
    // remaining entry the picker is hidden, so nothing on screen would
    // show that it had happened.
    const servesEntry = !entryId || this._entries.some((e) => e.entry_id === entryId);
    if (entryId && servesEntry) {
      this._entryId = entryId;
    }
    if (tab) this._tab = tab;
    // The rest of the link belongs to the rejected entry: its device and
    // channel addresses mean nothing under the entry we kept, and opening
    // them there would fail as "not found" instead of saying why. Land on
    // the device list of the entry this panel does serve.
    if (!servesEntry) {
      this._navigateTo("device-list", {});
      return;
    }
    // The device views belong to the backend: a link written for one kind
    // of entry opens the other kind's device page, not a view that cannot
    // serve it.
    if (view && this._isLoomEntry() && LIT_DEVICE_VIEWS.has(view)) {
      if (device) {
        this._navigateTo("loom-editor", { device, loomChannel: undefined, loomSub: undefined });
      } else {
        this._navigateTo("device-list", {});
      }
      return;
    }
    if (view === "loom-editor") {
      if (this._isLoomEntry() && device) {
        const n = Number.parseInt(channel, 10);
        this._navigateTo("loom-editor", {
          device,
          loomChannel: Number.isNaN(n) ? undefined : n,
          loomSub,
        });
      } else {
        this._navigateTo(device ? "device-detail" : "device-list", { device, interfaceId });
      }
      return;
    }
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
    if (this._view === "loom-editor") {
      if (this._loomChannel !== undefined) params.set("channel", String(this._loomChannel));
      if (this._loomSub) params.set("sub", this._loomSub);
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

    // The backend is per-entry and only `get_user_permissions` reports
    // it, so this costs one call per loaded entry — a handful, once, at
    // panel open. An entry whose call fails is kept rather than dropped:
    // losing a CCU entry to a transient error is the worse failure.
    this._entries = (
      await Promise.all(
        loadedEntries.map(async (entry): Promise<EntryInfo | null> => {
          let perms;
          try {
            perms = await getUserPermissions(this.hass, entry.entry_id);
          } catch {
            return this._classifyWithoutPermissions(entry);
          }
          if (perms.backend !== BACKEND_LOOM) return { ...entry, backend: perms.backend };
          return (await this._offersLoomEditor(entry.entry_id, perms.is_admin))
            ? { ...entry, backend: BACKEND_LOOM }
            : null;
        }),
      )
    ).filter((entry): entry is EntryInfo => entry !== null);

    if (this._entries.length === 1) {
      this._entryId = this._entries[0].entry_id;
    } else if (this._entries.length > 1) {
      const stored = localStorage.getItem(HomematicConfigPanel._STORAGE_KEY);
      if (stored && this._entries.some((e) => e.entry_id === stored)) {
        this._entryId = stored;
      }
    }
  }

  /**
   * Whether a loom entry belongs in the picker. Its device pages are the
   * daemon's editor, relayed through admin-only commands, so a non-admin
   * would see an editor that cannot load; and a daemon older than the
   * editor has nothing to show. A manifest call that fails keeps the entry:
   * a daemon that is briefly unreachable should say so in the editor rather
   * than vanish from the picker.
   */
  private async _offersLoomEditor(entryId: string, isAdmin: boolean): Promise<boolean> {
    if (!isAdmin) return false;
    try {
      return (await getLoomEditorManifest(this.hass, entryId)).available;
    } catch {
      return true;
    }
  }

  /**
   * Classifies an entry whose `get_user_permissions` call failed, so its
   * backend is unknown. The editor manifest answers for loom entries only —
   * any other entry gets an error from the relay — so a manifest answer
   * makes it a loom entry, and one without the editor is left out like any
   * other. Every error keeps the entry with its backend unknown: it may be a
   * CCU entry, or a loom entry the manifest cannot be asked for (a
   * non-admin, an unreachable daemon), and losing an entry is the worse
   * failure. Such an entry gets the panel's own device views.
   */
  private async _classifyWithoutPermissions(entry: EntryInfo): Promise<EntryInfo | null> {
    let manifest;
    try {
      manifest = await getLoomEditorManifest(this.hass, entry.entry_id);
    } catch {
      return entry;
    }
    return manifest.available ? { ...entry, backend: BACKEND_LOOM } : null;
  }

  private _isLoomEntry(): boolean {
    return this._entries.find((e) => e.entry_id === this._entryId)?.backend === BACKEND_LOOM;
  }

  /** Follows a link inside the daemon's editor (`loom-navigate`). */
  private _onLoomNavigate = (e: CustomEvent<{ route: string }>): void => {
    e.stopPropagation();
    const target = resolveLoomRoute(e.detail?.route ?? "");
    switch (target.kind) {
      case "device-list":
        this._navigateTo("device-list");
        return;
      case "device":
        if (target.address !== this._selectedDevice) this._selectedDeviceName = "";
        this._navigateTo("loom-editor", {
          device: target.address,
          loomChannel: target.channel,
          loomSub: target.sub,
        });
        if (target.fallbackFrom) {
          showToast(this, { message: this._l("loom_editor.link_page_fallback") });
        }
        return;
      case "unsupported":
        showToast(this, { message: this._l("loom_editor.unsupported_route") });
        return;
    }
  };

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
      loomChannel?: number;
      loomSub?: string;
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
    // A present key sets the value even when it is undefined: opening a
    // device clears the channel and sub-page the previous one was on.
    if (detail && "loomChannel" in detail) this._loomChannel = detail.loomChannel;
    if (detail && "loomSub" in detail) this._loomSub = detail.loomSub;
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
      if (CCU_DASHBOARD_BACKENDS.includes(this._permissions?.backend ?? "")) {
        tabs.push({ id: "ccu", label: this._l("tabs.ccu") });
      }
    }
    return html`
      <div class="tab-bar">
        <div class="tabs">
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

    if (this._view === "device-detail" || this._view === "loom-editor") {
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
                @device-selected=${(e: CustomEvent) =>
                  this._isLoomEntry()
                    ? this._navigateTo("loom-editor", {
                        device: e.detail.device,
                        interfaceId: e.detail.interfaceId,
                        deviceName: "",
                        loomChannel: undefined,
                        loomSub: undefined,
                      })
                    : this._navigateTo("device-detail", e.detail)}
              ></hm-device-list>
            </div>`,
          )}
        `;
      case "loom-editor":
        return html`
          ${this._renderToolbar()} ${this._renderBreadcrumb()}
          ${keyed(
            this._view,
            html`<div class="view-content">
              <hm-loom-device-editor
                .hass=${this.hass}
                .entryId=${this._entryId}
                .address=${this._selectedDevice}
                .channel=${this._loomChannel}
                .sub=${this._loomSub}
                @loom-navigate=${this._onLoomNavigate}
              ></hm-loom-device-editor>
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
      font-family: var(--paper-font-body1_-_font-family, "Roboto", sans-serif);
      color: var(--primary-text-color);
    }

    /* The toolbar and the tab bar span the full width; everything else — including the
       tabs inside the bar — shares one centered column. */
    .entry-selector,
    .tabs,
    hm-breadcrumb,
    .view-content {
      max-width: 1200px;
      margin-inline: auto;
      padding-inline: 16px;
      box-sizing: border-box;
    }

    .toolbar {
      display: flex;
      height: var(--header-height, 56px);
      align-items: center;
      background-color: var(--app-header-background-color, var(--primary-color));
      color: var(--app-header-text-color, var(--text-primary-color, #fff));
      font-size: 20px;
      --ha-icon-button-color: var(--app-header-text-color, var(--text-primary-color, #fff));
      border-bottom: var(--app-header-border-bottom);
      box-sizing: border-box;
    }

    .main-title {
      font-weight: 400;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding-inline-start: var(--ha-space-6, 24px);
    }

    hm-breadcrumb {
      display: block;
    }

    .entry-selector {
      padding-block: 16px 0;
    }

    .entry-selector ha-select {
      width: 100%;
    }

    /* Carries the header's surface across the full width, so the bar reads as part of it. */
    .tab-bar {
      background-color: var(--app-header-background-color, var(--primary-color));
      border-bottom: 2px solid var(--divider-color);
    }

    .tabs {
      display: flex;
      gap: 4px;
      padding-block: 16px 0;
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
      padding-block: 16px;
    }

    @media (max-width: 600px) {
      .entry-selector,
      .tabs,
      hm-breadcrumb,
      .view-content {
        padding-inline: 8px;
      }

      .entry-selector {
        padding-block: 8px 0;
      }

      .tabs {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        padding-block: 8px 0;
      }

      .tabs::-webkit-scrollbar {
        display: none;
      }

      .tab {
        padding: 8px 12px;
        font-size: 13px;
        white-space: nowrap;
      }

      .view-content {
        padding-block: 8px;
      }
    }
  `;
}
