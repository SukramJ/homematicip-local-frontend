import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { localize } from "../localize";
import { showConfirmationDialog, showPromptDialog, showToast } from "../ha-helpers";
import {
  getSystemInformation,
  createBackup,
  getInstallModeStatus,
  triggerInstallMode,
  getSignalQuality,
  getFirmwareOverview,
  refreshFirmwareData,
  getInboxDevices,
  acceptInboxDevice,
  getServiceMessages,
  acknowledgeServiceMessage,
  getAlarmMessages,
  acknowledgeAlarmMessage,
  updateDeviceFirmware,
} from "../panel-api";
import type { HomeAssistant } from "../types";
import type {
  SystemInformation,
  InstallModeInfo,
  InstallModeStatus,
  SignalQualityDevice,
  FirmwareDevice,
  FirmwareOverview,
  InboxDevice,
  ServiceMessage,
  AlarmMessage,
} from "../panel-api";

type CcuSubTab = "general" | "pairing" | "messages" | "signal" | "firmware";

@safeCustomElement("hm-ccu-dashboard")
export class HmCcuDashboard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";

  @state() private _subTab: CcuSubTab = "general";
  @state() private _sysInfo: SystemInformation | null = null;
  @state() private _installMode: InstallModeStatus | null = null;
  @state() private _signalDevices: SignalQualityDevice[] | null = null;
  @state() private _firmware: FirmwareOverview | null = null;
  @state() private _inboxDevices: InboxDevice[] = [];
  @state() private _serviceMessages: ServiceMessage[] = [];
  @state() private _alarmMessages: AlarmMessage[] = [];
  @state() private _loading = true;
  @state() private _error = "";
  @state() private _backupRunning = false;
  @state() private _refreshingFirmware = false;
  @state() private _signalSortColumn: keyof SignalQualityDevice = "name";
  @state() private _signalSortAsc = true;
  @state() private _signalFilter = "";
  @state() private _signalInterfaceFilter = "";
  @state() private _signalReachableFilter = "";
  @state() private _signalBatteryFilter = "";
  @state() private _firmwareSortColumn: keyof FirmwareDevice = "name";
  @state() private _firmwareSortAsc = true;
  @state() private _firmwareFilter = "";
  @state() private _firmwareStateFilter = "";

  private _installModeTimer?: ReturnType<typeof setInterval>;
  private _pollTimer?: ReturnType<typeof setTimeout>;
  private static readonly _POLL_INTERVAL = 30000;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopInstallModePolling();
    this._stopPolling();
  }

  updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has("entryId") && this.entryId) {
      this._stopPolling();
      this._fetchAll();
    }
  }

  private _scheduleNextPoll(): void {
    this._stopPolling();
    this._pollTimer = setTimeout(() => this._fetchAll(), HmCcuDashboard._POLL_INTERVAL);
  }

  private _stopPolling(): void {
    if (this._pollTimer !== undefined) {
      clearTimeout(this._pollTimer);
      this._pollTimer = undefined;
    }
  }

  private async _fetchAll(): Promise<void> {
    if (!this.entryId) return;
    const isInitialLoad = this._sysInfo === null;
    if (isInitialLoad) {
      this._loading = true;
    }
    this._error = "";
    try {
      const [
        sysInfo,
        installMode,
        signalDevices,
        firmware,
        inboxDevices,
        serviceMessages,
        alarmMessages,
      ] = await Promise.all([
        getSystemInformation(this.hass, this.entryId),
        getInstallModeStatus(this.hass, this.entryId),
        getSignalQuality(this.hass, this.entryId),
        getFirmwareOverview(this.hass, this.entryId),
        getInboxDevices(this.hass, this.entryId).catch(() => [] as InboxDevice[]),
        getServiceMessages(this.hass, this.entryId).catch(() => [] as ServiceMessage[]),
        getAlarmMessages(this.hass, this.entryId).catch(() => [] as AlarmMessage[]),
      ]);
      this._sysInfo = sysInfo;
      this._installMode = installMode;
      this._signalDevices = signalDevices;
      this._firmware = firmware;
      this._inboxDevices = inboxDevices;
      this._serviceMessages = serviceMessages;
      this._alarmMessages = alarmMessages;
      if (installMode.hmip.active || installMode.bidcos.active) {
        this._startInstallModePolling();
      }
    } catch (err) {
      this._error = String(err);
    } finally {
      this._loading = false;
      this._scheduleNextPoll();
    }
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private async _handleCreateBackup(): Promise<void> {
    const confirmed = await showConfirmationDialog(this, {
      title: this._l("ccu.create_backup_title"),
      text: this._l("ccu.create_backup_text"),
      confirmText: this._l("ccu.create_backup"),
      dismissText: this._l("common.cancel"),
    });
    if (!confirmed) return;

    this._backupRunning = true;
    try {
      const result = await createBackup(this.hass, this.entryId);
      if (result.success) {
        const sizeMB = (result.size / 1024 / 1024).toFixed(1);
        showToast(this, {
          message: this._l("ccu.backup_success", { filename: result.filename, size: sizeMB }),
        });
      }
    } catch {
      showToast(this, { message: this._l("ccu.backup_failed") });
    } finally {
      this._backupRunning = false;
    }
  }

  private async _handleTriggerInstallMode(iface: "hmip" | "bidcos"): Promise<void> {
    const label = iface === "hmip" ? "HmIP-RF" : "BidCos-RF";
    const confirmed = await showConfirmationDialog(this, {
      title: this._l("ccu.install_mode_title"),
      text: this._l("ccu.install_mode_text", { interface: label }),
      confirmText: this._l("ccu.activate"),
      dismissText: this._l("common.cancel"),
    });
    if (!confirmed) return;

    try {
      await triggerInstallMode(this.hass, this.entryId, iface);
      showToast(this, { message: this._l("ccu.install_mode_activated", { interface: label }) });
      this._installMode = await getInstallModeStatus(this.hass, this.entryId);
      this._startInstallModePolling();
    } catch {
      showToast(this, { message: this._l("ccu.action_failed") });
    }
  }

  private _startInstallModePolling(): void {
    this._stopInstallModePolling();
    this._installModeTimer = setInterval(async () => {
      try {
        this._installMode = await getInstallModeStatus(this.hass, this.entryId);
        const anyActive = this._installMode.hmip.active || this._installMode.bidcos.active;
        if (!anyActive) {
          this._stopInstallModePolling();
        }
      } catch {
        this._stopInstallModePolling();
      }
    }, 1000);
  }

  private _stopInstallModePolling(): void {
    if (this._installModeTimer !== undefined) {
      clearInterval(this._installModeTimer);
      this._installModeTimer = undefined;
    }
  }

  private async _handleRefreshFirmware(): Promise<void> {
    this._refreshingFirmware = true;
    try {
      await refreshFirmwareData(this.hass, this.entryId);
      showToast(this, { message: this._l("ccu.firmware_refreshed") });
      this._firmware = await getFirmwareOverview(this.hass, this.entryId);
    } catch {
      showToast(this, { message: this._l("ccu.action_failed") });
    } finally {
      this._refreshingFirmware = false;
    }
  }

  private async _handleUpdateFirmware(dev: FirmwareDevice): Promise<void> {
    const confirmed = await showConfirmationDialog(this, {
      title: this._l("ccu.update_firmware"),
      text: this._l("ccu.update_firmware_confirm", { device: dev.name }),
      confirmText: this._l("ccu.update_firmware"),
      dismissText: this._l("common.cancel"),
    });
    if (!confirmed) return;

    try {
      await updateDeviceFirmware(this.hass, this.entryId, dev.address);
      showToast(this, {
        message: this._l("ccu.update_firmware_success", { device: dev.name }),
      });
    } catch {
      showToast(this, { message: this._l("ccu.update_firmware_failed") });
    }
  }

  private _switchSubTab(tab: CcuSubTab): void {
    this._subTab = tab;
  }

  private _renderSubTabs() {
    const tabs: { id: CcuSubTab; label: string; badge?: number }[] = [
      { id: "general", label: this._l("ccu.tab_general") },
      {
        id: "messages",
        label: this._l("ccu.tab_messages"),
        badge: this._serviceMessages.length + this._alarmMessages.length,
      },
      { id: "pairing", label: this._l("ccu.tab_pairing"), badge: this._inboxDevices.length },
      { id: "signal", label: this._l("ccu.tab_signal") },
      { id: "firmware", label: this._l("ccu.tab_firmware") },
    ];

    return html`
      <div class="sub-tab-bar">
        ${tabs.map(
          (t) => html`
            <button
              class="sub-tab ${this._subTab === t.id ? "active" : ""}"
              @click=${() => this._switchSubTab(t.id)}
            >
              ${t.label} ${t.badge ? html`<span class="tab-badge">${t.badge}</span>` : nothing}
            </button>
          `,
        )}
      </div>
    `;
  }

  private _renderSubTabContent() {
    switch (this._subTab) {
      case "general":
        return html`${this._renderSystemInfoCard()} ${this._renderActionsCard()}`;
      case "pairing":
        return html`${this._renderInstallModeCard()} ${this._renderInboxCard()}`;
      case "messages":
        return html`${this._renderServiceMessagesCard()} ${this._renderAlarmMessagesCard()}`;
      case "signal":
        return html`${this._renderSignalQualityCard()}`;
      case "firmware":
        return html`${this._renderFirmwareCard()}`;
    }
  }

  render() {
    if (!this.entryId) {
      return html`<div class="empty-state">${this._l("device_list.no_entry_selected")}</div>`;
    }

    if (this._loading) {
      return html`<div class="loading">${this._l("common.loading")}</div>`;
    }

    if (this._error) {
      return html`<div class="error">${this._error}</div>`;
    }

    return html` ${this._renderSubTabs()} ${this._renderSubTabContent()} `;
  }

  private _renderSystemInfoCard() {
    if (!this._sysInfo) return nothing;
    const info = this._sysInfo;

    return html`
      <ha-card>
        <div class="card-header">${this._l("ccu.system_information")}</div>
        <div class="card-content">
          <div class="kv-grid">
            <div class="kv-item">
              <span class="kv-label">${this._l("ccu.name")}</span>
              <span class="kv-value">${info.name}</span>
            </div>
            ${info.model
              ? html`
                  <div class="kv-item">
                    <span class="kv-label">${this._l("ccu.model")}</span>
                    <span class="kv-value">${info.model}</span>
                  </div>
                `
              : nothing}
            ${info.version
              ? html`
                  <div class="kv-item">
                    <span class="kv-label">${this._l("ccu.version")}</span>
                    <span class="kv-value">${info.version}</span>
                  </div>
                `
              : nothing}
            ${info.serial
              ? html`
                  <div class="kv-item">
                    <span class="kv-label">${this._l("ccu.serial")}</span>
                    <span class="kv-value">${info.serial}</span>
                  </div>
                `
              : nothing}
            <div class="kv-item">
              <span class="kv-label">${this._l("ccu.hostname")}</span>
              <span class="kv-value">${info.hostname}</span>
            </div>
            ${info.ccu_type
              ? html`
                  <div class="kv-item">
                    <span class="kv-label">${this._l("ccu.ccu_type")}</span>
                    <span class="kv-value">${info.ccu_type}</span>
                  </div>
                `
              : nothing}
            <div class="kv-item">
              <span class="kv-label">${this._l("ccu.interfaces")}</span>
              <span class="kv-value">${info.available_interfaces.join(", ")}</span>
            </div>
            ${info.auth_enabled !== null
              ? html`
                  <div class="kv-item">
                    <span class="kv-label">${this._l("ccu.auth_enabled")}</span>
                    <span class="kv-value"
                      >${info.auth_enabled ? this._l("common.yes") : this._l("common.no")}</span
                    >
                  </div>
                `
              : nothing}
          </div>
          <div class="status-badges"></div>
        </div>
      </ha-card>
    `;
  }

  private _renderInstallModeCard() {
    if (!this._installMode) return nothing;
    const { hmip, bidcos } = this._installMode;

    if (!hmip.available && !bidcos.available) return nothing;

    return html`
      <ha-card>
        <div class="card-header">${this._l("ccu.install_mode")}</div>
        <div class="card-content">
          <div class="install-mode-grid">
            ${hmip.available ? this._renderInstallModeItem("HmIP-RF", "hmip", hmip) : nothing}
            ${bidcos.available
              ? this._renderInstallModeItem("BidCos-RF", "bidcos", bidcos)
              : nothing}
          </div>
        </div>
      </ha-card>
    `;
  }

  private _renderInstallModeItem(label: string, iface: "hmip" | "bidcos", info: InstallModeInfo) {
    return html`
      <div class="install-mode-item">
        <div class="install-mode-header">
          <span class="install-mode-label">${label}</span>
          <span class="install-mode-status ${info.active ? "active" : ""}">
            ${info.active ? this._l("ccu.active") : this._l("ccu.inactive")}
          </span>
        </div>
        ${info.active && info.remaining_seconds !== null
          ? html`<span class="install-mode-remaining"
              >${this._l("ccu.remaining_seconds", {
                seconds: info.remaining_seconds,
              })}</span
            >`
          : nothing}
        ${!info.active
          ? html`
              <ha-button @click=${() => this._handleTriggerInstallMode(iface)}>
                ${this._l("ccu.activate")}
              </ha-button>
            `
          : nothing}
      </div>
    `;
  }

  private async _handleAcceptInboxDevice(device: InboxDevice): Promise<void> {
    const deviceName = await showPromptDialog(this, {
      title: this._l("ccu.accept_device_title"),
      text: this._l("ccu.accept_device_text", { device: device.name || device.address }),
      inputLabel: this._l("ccu.device_name"),
      defaultValue: device.name || "",
      confirmText: this._l("ccu.accept"),
      dismissText: this._l("common.cancel"),
    });
    if (deviceName === null) return;

    try {
      await acceptInboxDevice(
        this.hass,
        this.entryId,
        device.address,
        deviceName || undefined,
        deviceName ? device.device_id : undefined,
      );
      showToast(this, {
        message: this._l("ccu.accept_device_success", { device: deviceName || device.address }),
      });
      this._inboxDevices = await getInboxDevices(this.hass, this.entryId).catch(() => []);
    } catch {
      showToast(this, { message: this._l("ccu.action_failed") });
    }
  }

  private async _handleAcknowledgeServiceMessage(msg: ServiceMessage): Promise<void> {
    try {
      await acknowledgeServiceMessage(this.hass, this.entryId, msg.msg_id);
      showToast(this, { message: this._l("ccu.message_acknowledged") });
      this._serviceMessages = await getServiceMessages(this.hass, this.entryId).catch(() => []);
    } catch {
      showToast(this, { message: this._l("ccu.action_failed") });
    }
  }

  private async _handleAcknowledgeAlarmMessage(alarm: AlarmMessage): Promise<void> {
    try {
      await acknowledgeAlarmMessage(this.hass, this.entryId, alarm.alarm_id);
      showToast(this, { message: this._l("ccu.message_acknowledged") });
      this._alarmMessages = await getAlarmMessages(this.hass, this.entryId).catch(() => []);
    } catch {
      showToast(this, { message: this._l("ccu.action_failed") });
    }
  }

  private _renderInboxCard() {
    return html`
      <ha-card>
        <div class="card-header">
          <span>${this._l("ccu.inbox")}</span>
          ${this._inboxDevices.length > 0
            ? html`<span class="badge">${this._inboxDevices.length}</span>`
            : nothing}
        </div>
        <div class="card-content">
          ${this._inboxDevices.length === 0
            ? html`<div class="empty-hint">${this._l("ccu.no_inbox_devices")}</div>`
            : html`
                <div class="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>${this._l("ccu.device")}</th>
                        <th>${this._l("ccu.address")}</th>
                        <th>${this._l("ccu.device_type")}</th>
                        <th>${this._l("ccu.interface")}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      ${this._inboxDevices.map(
                        (dev) => html`
                          <tr>
                            <td class="device-name" data-label=${this._l("ccu.device")}>
                              ${dev.name || "—"}
                            </td>
                            <td data-label=${this._l("ccu.address")}>${dev.address}</td>
                            <td data-label=${this._l("ccu.device_type")}>${dev.device_type}</td>
                            <td data-label=${this._l("ccu.interface")}>${dev.interface}</td>
                            <td>
                              <ha-button @click=${() => this._handleAcceptInboxDevice(dev)}>
                                ${this._l("ccu.accept")}
                              </ha-button>
                            </td>
                          </tr>
                        `,
                      )}
                    </tbody>
                  </table>
                </div>
              `}
        </div>
      </ha-card>
    `;
  }

  private _renderServiceMessagesCard() {
    return html`
      <ha-card>
        <div class="card-header">
          <span>${this._l("ccu.service_messages")}</span>
          ${this._serviceMessages.length > 0
            ? html`<span class="badge warning">${this._serviceMessages.length}</span>`
            : nothing}
        </div>
        <div class="card-content">
          ${this._serviceMessages.length === 0
            ? html`<div class="empty-hint">${this._l("ccu.no_service_messages")}</div>`
            : html`<div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>${this._l("ccu.device")}</th>
                      <th>${this._l("ccu.address")}</th>
                      <th>${this._l("ccu.msg_type")}</th>
                      <th>${this._l("ccu.message")}</th>
                      <th>${this._l("ccu.timestamp")}</th>
                      <th>${this._l("ccu.counter_label")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this._serviceMessages.map(
                      (msg) => html`
                        <tr>
                          <td class="device-name" data-label=${this._l("ccu.device")}>
                            ${msg.device_name || "—"}
                          </td>
                          <td data-label=${this._l("ccu.address")}>${msg.address || "—"}</td>
                          <td data-label=${this._l("ccu.msg_type")}>
                            <span class="msg-type msg-type-${msg.msg_type}">
                              ${msg.msg_type_name}
                            </span>
                          </td>
                          <td data-label=${this._l("ccu.message")}>${msg.display_name}</td>
                          <td class="timestamp-cell" data-label=${this._l("ccu.timestamp")}>
                            ${msg.timestamp || "—"}
                          </td>
                          <td data-label=${this._l("ccu.counter_label")}>
                            ${msg.counter > 1 ? msg.counter : ""}
                          </td>
                          <td>
                            ${msg.quittable
                              ? html`
                                  <ha-button
                                    @click=${() => this._handleAcknowledgeServiceMessage(msg)}
                                  >
                                    ${this._l("ccu.acknowledge")}
                                  </ha-button>
                                `
                              : nothing}
                          </td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
              </div>`}
        </div>
      </ha-card>
    `;
  }

  private _renderAlarmMessagesCard() {
    return html`
      <ha-card>
        <div class="card-header">
          <span>${this._l("ccu.alarm_messages")}</span>
          ${this._alarmMessages.length > 0
            ? html`<span class="badge error">${this._alarmMessages.length}</span>`
            : nothing}
        </div>
        <div class="card-content">
          ${this._alarmMessages.length === 0
            ? html`<div class="empty-hint">${this._l("ccu.no_alarm_messages")}</div>`
            : html`<div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>${this._l("ccu.device")}</th>
                      <th>${this._l("ccu.message")}</th>
                      <th>${this._l("ccu.description")}</th>
                      <th>${this._l("ccu.last_trigger")}</th>
                      <th>${this._l("ccu.timestamp")}</th>
                      <th>${this._l("ccu.counter_label")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this._alarmMessages.map(
                      (alarm) => html`
                        <tr>
                          <td class="device-name" data-label=${this._l("ccu.device")}>
                            ${alarm.device_name || "—"}
                          </td>
                          <td data-label=${this._l("ccu.message")}>${alarm.display_name}</td>
                          <td data-label=${this._l("ccu.description")}>
                            ${alarm.description || "—"}
                          </td>
                          <td data-label=${this._l("ccu.last_trigger")}>
                            ${alarm.last_trigger || "—"}
                          </td>
                          <td class="timestamp-cell" data-label=${this._l("ccu.timestamp")}>
                            ${alarm.timestamp || "—"}
                          </td>
                          <td data-label=${this._l("ccu.counter_label")}>
                            ${alarm.counter > 1 ? alarm.counter : ""}
                          </td>
                          <td>
                            <ha-button @click=${() => this._handleAcknowledgeAlarmMessage(alarm)}>
                              ${this._l("ccu.acknowledge")}
                            </ha-button>
                          </td>
                        </tr>
                      `,
                    )}
                  </tbody>
                </table>
              </div>`}
        </div>
      </ha-card>
    `;
  }

  private _filterSignalDevices(devices: SignalQualityDevice[]): SignalQualityDevice[] {
    return devices.filter((dev) => {
      if (this._signalFilter) {
        const q = this._signalFilter.toLowerCase();
        if (!dev.name.toLowerCase().includes(q) && !dev.model.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (this._signalInterfaceFilter && dev.interface_id !== this._signalInterfaceFilter) {
        return false;
      }
      if (this._signalReachableFilter && String(dev.is_reachable) !== this._signalReachableFilter) {
        return false;
      }
      if (this._signalBatteryFilter) {
        if (this._signalBatteryFilter === "low" && dev.low_battery !== true) return false;
        if (this._signalBatteryFilter === "ok" && dev.low_battery !== false) return false;
      }
      return true;
    });
  }

  private _renderSignalQualityCard() {
    if (!this._signalDevices || this._signalDevices.length === 0) return nothing;

    const showFilters = this._signalDevices.length > 10;
    const filtered = showFilters
      ? this._filterSignalDevices(this._signalDevices)
      : this._signalDevices;
    const sorted = [...filtered].sort((a, b) => {
      const col = this._signalSortColumn;
      const cmp = this._compareValues(a[col], b[col]);
      return this._signalSortAsc ? cmp : -cmp;
    });
    const isFiltered = showFilters && filtered.length !== this._signalDevices.length;
    const interfaces = [...new Set(this._signalDevices.map((d) => d.interface_id))].sort();

    return html`
      <ha-card>
        <div class="card-header">${this._l("ccu.signal_quality")}</div>
        <div class="card-content table-wrapper">
          ${showFilters
            ? html`
                <div class="filter-bar">
                  <ha-input
                    .value=${this._signalFilter}
                    .placeholder=${this._l("ccu.filter_devices")}
                    aria-label=${this._l("ccu.filter_devices")}
                    @input=${(e: InputEvent) => {
                      this._signalFilter = (e.target as HTMLInputElement).value;
                    }}
                    class="filter-search"
                  ></ha-input>
                  <div class="filter-selects">
                    <ha-select
                      .label=${this._l("ccu.interface")}
                      .value=${this._signalInterfaceFilter}
                      .options=${[
                        { value: "", label: this._l("ccu.filter_all") },
                        ...interfaces.map((i) => ({ value: i, label: i })),
                      ]}
                      @selected=${(e: CustomEvent) => {
                        e.stopPropagation();
                        this._signalInterfaceFilter = e.detail.value ?? "";
                      }}
                      @closed=${(e: Event) => e.stopPropagation()}
                    ></ha-select>
                    <ha-select
                      .label=${this._l("ccu.reachable")}
                      .value=${this._signalReachableFilter}
                      .options=${[
                        { value: "", label: this._l("ccu.filter_all") },
                        { value: "true", label: this._l("common.yes") },
                        { value: "false", label: this._l("common.no") },
                      ]}
                      @selected=${(e: CustomEvent) => {
                        e.stopPropagation();
                        this._signalReachableFilter = e.detail.value ?? "";
                      }}
                      @closed=${(e: Event) => e.stopPropagation()}
                    ></ha-select>
                    <ha-select
                      .label=${this._l("ccu.battery")}
                      .value=${this._signalBatteryFilter}
                      .options=${[
                        { value: "", label: this._l("ccu.filter_all") },
                        { value: "ok", label: this._l("ccu.ok") },
                        { value: "low", label: this._l("ccu.low") },
                      ]}
                      @selected=${(e: CustomEvent) => {
                        e.stopPropagation();
                        this._signalBatteryFilter = e.detail.value ?? "";
                      }}
                      @closed=${(e: Event) => e.stopPropagation()}
                    ></ha-select>
                  </div>
                </div>
                ${isFiltered
                  ? html`<div class="filter-count">
                      ${this._l("ccu.filter_result", {
                        count: filtered.length,
                        total: this._signalDevices.length,
                      })}
                    </div>`
                  : nothing}
              `
            : nothing}
          <table>
            <thead>
              <tr>
                <th @click=${() => this._toggleSignalSort("name")}>
                  ${this._l("ccu.device")} ${this._sortIcon("signal", "name")}
                </th>
                <th @click=${() => this._toggleSignalSort("model")}>
                  ${this._l("ccu.model")} ${this._sortIcon("signal", "model")}
                </th>
                <th @click=${() => this._toggleSignalSort("interface_id")}>
                  ${this._l("ccu.interface")} ${this._sortIcon("signal", "interface_id")}
                </th>
                <th @click=${() => this._toggleSignalSort("is_reachable")}>
                  ${this._l("ccu.reachable")} ${this._sortIcon("signal", "is_reachable")}
                </th>
                <th @click=${() => this._toggleSignalSort("rssi_device")}>
                  RSSI ${this._sortIcon("signal", "rssi_device")}
                </th>
                <th @click=${() => this._toggleSignalSort("low_battery")}>
                  ${this._l("ccu.battery")} ${this._sortIcon("signal", "low_battery")}
                </th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(
                (dev) => html`
                  <tr class="${dev.is_reachable ? "" : "unreachable-row"}">
                    <td class="device-name" data-label=${this._l("ccu.device")}>${dev.name}</td>
                    <td data-label=${this._l("ccu.model")}>${dev.model}</td>
                    <td data-label=${this._l("ccu.interface")}>${dev.interface_id}</td>
                    <td data-label=${this._l("ccu.reachable")}>
                      <span class="status-dot ${dev.is_reachable ? "online" : "offline"}"></span>
                    </td>
                    <td data-label="RSSI">${dev.rssi_device ?? "—"}</td>
                    <td data-label=${this._l("ccu.battery")}>
                      ${dev.low_battery === null
                        ? "—"
                        : dev.low_battery
                          ? html`<span class="warn-text">${this._l("ccu.low")}</span>`
                          : this._l("ccu.ok")}
                    </td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </ha-card>
    `;
  }

  private _filterFirmwareDevices(devices: FirmwareDevice[]): FirmwareDevice[] {
    return devices.filter((dev) => {
      if (this._firmwareFilter) {
        const q = this._firmwareFilter.toLowerCase();
        if (!dev.name.toLowerCase().includes(q) && !dev.model.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (this._firmwareStateFilter && dev.firmware_update_state !== this._firmwareStateFilter) {
        return false;
      }
      return true;
    });
  }

  private _renderFirmwareCard() {
    if (!this._firmware) return nothing;

    const allDevices = this._firmware.devices;
    const showFilters = allDevices.length > 10;
    const filtered = showFilters ? this._filterFirmwareDevices(allDevices) : allDevices;
    const sorted = [...filtered].sort((a, b) => {
      const col = this._firmwareSortColumn;
      const cmp = this._compareValues(a[col], b[col]);
      return this._firmwareSortAsc ? cmp : -cmp;
    });
    const isFiltered = showFilters && filtered.length !== allDevices.length;
    const states = [...new Set(allDevices.map((d) => d.firmware_update_state))].sort();

    return html`
      <ha-card>
        <div class="card-header">
          <span>${this._l("ccu.firmware_overview")}</span>
          ${this._firmware.summary.firmware_updatable > 0
            ? html`<span class="badge"
                >${this._firmware.summary.firmware_updatable} ${this._l("ccu.updatable")}</span
              >`
            : nothing}
        </div>
        <div class="card-content table-wrapper">
          <div class="action-bar">
            <ha-button @click=${this._handleRefreshFirmware} .disabled=${this._refreshingFirmware}>
              ${this._refreshingFirmware
                ? this._l("common.loading")
                : this._l("ccu.refresh_firmware")}
            </ha-button>
          </div>
          ${showFilters
            ? html`
                <div class="filter-bar">
                  <ha-input
                    .value=${this._firmwareFilter}
                    .placeholder=${this._l("ccu.filter_devices")}
                    aria-label=${this._l("ccu.filter_devices")}
                    @input=${(e: InputEvent) => {
                      this._firmwareFilter = (e.target as HTMLInputElement).value;
                    }}
                    class="filter-search"
                  ></ha-input>
                  <div class="filter-selects">
                    <ha-select
                      .label=${this._l("ccu.state")}
                      .value=${this._firmwareStateFilter}
                      .options=${[
                        { value: "", label: this._l("ccu.filter_all") },
                        ...states.map((s) => ({ value: s, label: s })),
                      ]}
                      @selected=${(e: CustomEvent) => {
                        e.stopPropagation();
                        this._firmwareStateFilter = e.detail.value ?? "";
                      }}
                      @closed=${(e: Event) => e.stopPropagation()}
                    ></ha-select>
                  </div>
                </div>
                ${isFiltered
                  ? html`<div class="filter-count">
                      ${this._l("ccu.filter_result", {
                        count: filtered.length,
                        total: allDevices.length,
                      })}
                    </div>`
                  : nothing}
              `
            : nothing}
          <table>
            <thead>
              <tr>
                <th @click=${() => this._toggleFirmwareSort("name")}>
                  ${this._l("ccu.device")} ${this._sortIcon("firmware", "name")}
                </th>
                <th @click=${() => this._toggleFirmwareSort("model")}>
                  ${this._l("ccu.model")} ${this._sortIcon("firmware", "model")}
                </th>
                <th @click=${() => this._toggleFirmwareSort("firmware")}>
                  ${this._l("ccu.current_fw")} ${this._sortIcon("firmware", "firmware")}
                </th>
                <th @click=${() => this._toggleFirmwareSort("available_firmware")}>
                  ${this._l("ccu.available_fw")} ${this._sortIcon("firmware", "available_firmware")}
                </th>
                <th @click=${() => this._toggleFirmwareSort("firmware_update_state")}>
                  ${this._l("ccu.state")} ${this._sortIcon("firmware", "firmware_update_state")}
                </th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(
                (dev) => html`
                  <tr class="${dev.firmware_updatable ? "updatable-row" : ""}">
                    <td class="device-name" data-label=${this._l("ccu.device")}>${dev.name}</td>
                    <td data-label=${this._l("ccu.model")}>${dev.model}</td>
                    <td data-label=${this._l("ccu.current_fw")}>${dev.firmware}</td>
                    <td data-label=${this._l("ccu.available_fw")}>
                      ${dev.available_firmware ?? "—"}
                    </td>
                    <td data-label=${this._l("ccu.state")}>
                      <span class="fw-state ${dev.firmware_updatable ? "updatable" : ""}">
                        ${dev.firmware_update_state}
                      </span>
                    </td>
                    <td>
                      ${dev.firmware_updatable
                        ? html`
                            <ha-button @click=${() => this._handleUpdateFirmware(dev)}>
                              ${this._l("ccu.update_firmware")}
                            </ha-button>
                          `
                        : nothing}
                    </td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </ha-card>
    `;
  }

  private _renderActionsCard() {
    return html`
      <ha-card>
        <div class="card-header">${this._l("ccu.actions")}</div>
        <div class="card-content">
          <div class="action-buttons">
            <ha-button @click=${this._fetchAll}>${this._l("ccu.refresh")}</ha-button>
            <ha-button @click=${this._handleCreateBackup} .disabled=${this._backupRunning}>
              ${this._backupRunning ? this._l("ccu.backup_running") : this._l("ccu.create_backup")}
            </ha-button>
          </div>
        </div>
      </ha-card>
    `;
  }

  private _toggleSignalSort(col: keyof SignalQualityDevice): void {
    if (this._signalSortColumn === col) {
      this._signalSortAsc = !this._signalSortAsc;
    } else {
      this._signalSortColumn = col;
      this._signalSortAsc = true;
    }
  }

  private _toggleFirmwareSort(col: keyof FirmwareDevice): void {
    if (this._firmwareSortColumn === col) {
      this._firmwareSortAsc = !this._firmwareSortAsc;
    } else {
      this._firmwareSortColumn = col;
      this._firmwareSortAsc = true;
    }
  }

  private _sortIcon(table: "signal" | "firmware", col: string): string {
    const activeCol = table === "signal" ? this._signalSortColumn : this._firmwareSortColumn;
    const asc = table === "signal" ? this._signalSortAsc : this._firmwareSortAsc;
    if (activeCol !== col) return "";
    return asc ? " \u25B2" : " \u25BC";
  }

  private _compareValues(a: unknown, b: unknown): number {
    if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
    if (b === null || b === undefined) return 1;
    if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b));
  }

  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .sub-tab-bar {
        display: flex;
        gap: 4px;
        border-bottom: 2px solid var(--divider-color);
        padding-bottom: 0;
        margin-bottom: 4px;
      }

      .sub-tab {
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
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .sub-tab:hover {
        color: var(--primary-text-color);
      }

      .sub-tab.active {
        color: var(--primary-color);
        border-bottom-color: var(--primary-color);
      }

      .tab-badge {
        font-size: 11px;
        min-width: 18px;
        height: 18px;
        line-height: 18px;
        text-align: center;
        padding: 0 5px;
        border-radius: 9px;
        background: var(--warning-color, #ff9800);
        color: #fff;
        font-weight: 600;
      }

      .empty-hint {
        color: var(--secondary-text-color);
        font-size: 14px;
        padding: 8px 0;
      }

      ha-card {
        border-radius: var(--ha-card-border-radius, 12px);
        background: var(--ha-card-background, var(--card-background-color, #fff));
        box-shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0, 0, 0, 0.1));
        overflow: hidden;
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .badge {
        font-size: 11px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 12px;
        white-space: nowrap;
        background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.15);
        color: var(--primary-color);
      }

      .badge.warning {
        background: rgba(var(--rgb-amber, 255, 152, 0), 0.15);
        color: var(--warning-color, #ff9800);
      }

      .badge.error {
        background: rgba(var(--rgb-red, 244, 67, 54), 0.15);
        color: var(--error-color, #db4437);
      }

      .kv-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
      }

      .kv-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .kv-label {
        font-size: 12px;
        color: var(--secondary-text-color);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .kv-value {
        font-size: 16px;
        font-weight: 500;
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 16px;
      }

      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px;
        border-radius: 8px;
        background: var(--secondary-background-color);
      }

      .stat-item.warning {
        background: rgba(var(--rgb-amber, 255, 152, 0), 0.1);
      }

      .stat-item.error {
        background: rgba(var(--rgb-red, 244, 67, 54), 0.1);
      }

      .stat-value {
        font-size: 28px;
        font-weight: 500;
      }

      .stat-label {
        font-size: 12px;
        color: var(--secondary-text-color);
        text-transform: uppercase;
        margin-top: 4px;
      }

      .status-badges {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        flex-wrap: wrap;
      }

      .status-badge {
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 12px;
        font-weight: 500;
      }

      .status-badge.has-backup {
        background: rgba(var(--rgb-green, 76, 175, 80), 0.15);
        color: var(--success-color, #4caf50);
      }

      .install-mode-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
      }

      .install-mode-item {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        border-radius: 8px;
        background: var(--secondary-background-color);
      }

      .install-mode-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .install-mode-label {
        font-weight: 500;
      }

      .install-mode-status {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 8px;
        background: var(--secondary-background-color);
      }

      .install-mode-status.active {
        background: rgba(var(--rgb-green, 76, 175, 80), 0.15);
        color: var(--success-color, #4caf50);
      }

      .install-mode-remaining {
        font-size: 13px;
        color: var(--secondary-text-color);
      }

      .filter-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: end;
        margin-bottom: 12px;
      }

      .filter-search {
        flex: 1 1 200px;
        min-width: min(200px, 100%);
      }

      .filter-selects {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .filter-selects ha-select {
        min-width: 140px;
      }

      .filter-count {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-bottom: 8px;
      }

      .table-wrapper {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      thead th {
        text-align: left;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 500;
        color: var(--secondary-text-color);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 2px solid var(--divider-color);
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
      }

      tbody td {
        padding: 8px 12px;
        border-bottom: 1px solid var(--divider-color);
      }

      tbody tr:last-child td {
        border-bottom: none;
      }

      tbody tr:hover {
        background: var(--secondary-background-color);
      }

      .device-name {
        font-weight: 500;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .unreachable-row {
        opacity: 0.6;
      }

      .updatable-row {
        background: rgba(var(--rgb-blue, 33, 150, 243), 0.05);
      }

      .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .status-dot.online {
        background: var(--success-color, #4caf50);
      }

      .status-dot.offline {
        background: var(--error-color, #db4437);
      }

      .warn-text {
        color: var(--warning-color, #ff9800);
      }

      .fw-state.updatable {
        color: var(--info-color, #2196f3);
        font-weight: 500;
      }

      .msg-type {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 8px;
        white-space: nowrap;
      }

      .msg-type-0 {
        background: rgba(var(--rgb-blue, 33, 150, 243), 0.15);
        color: var(--info-color, #2196f3);
      }

      .msg-type-1 {
        background: rgba(var(--rgb-amber, 255, 152, 0), 0.15);
        color: var(--warning-color, #ff9800);
      }

      .msg-type-2 {
        background: rgba(var(--rgb-red, 244, 67, 54), 0.15);
        color: var(--error-color, #db4437);
      }

      .timestamp-cell {
        white-space: nowrap;
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .action-bar {
        margin-bottom: 12px;
      }

      .action-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      @media (max-width: 600px) {
        .sub-tab-bar {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .sub-tab-bar::-webkit-scrollbar {
          display: none;
        }

        .sub-tab {
          padding: 8px 10px;
          font-size: 13px;
          white-space: nowrap;
        }

        .kv-grid {
          grid-template-columns: 1fr 1fr;
        }

        .install-mode-grid {
          grid-template-columns: 1fr;
        }

        .filter-bar {
          flex-direction: column;
          gap: 8px;
        }

        .filter-search {
          min-width: 0;
          flex: 1 1 auto;
          width: 100%;
        }

        .filter-selects {
          width: 100%;
          gap: 8px;
        }

        .filter-selects ha-select {
          min-width: 0;
          flex: 1;
        }

        /* Tables as card list on mobile */
        table,
        thead,
        tbody,
        th,
        td,
        tr {
          display: block;
        }

        thead {
          display: none;
        }

        tbody tr {
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
          background: var(--card-background-color, #fff);
        }

        tbody tr:hover {
          background: var(--secondary-background-color);
        }

        tbody td {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
          border-bottom: none;
          font-size: 13px;
        }

        tbody td::before {
          content: attr(data-label);
          font-weight: 500;
          font-size: 12px;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          margin-right: 8px;
          flex-shrink: 0;
        }

        tbody td:empty {
          display: none;
        }

        .device-name {
          max-width: none;
          font-size: 14px;
        }

        .action-buttons {
          flex-direction: column;
        }

        .action-buttons ha-button {
          width: 100%;
        }
      }
    `,
  ];
}
