import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import {
  listScheduleDevices,
  getClimateSchedule,
  setClimateScheduleWeekday,
  setClimateActiveProfile,
  getDeviceSchedule,
  setDeviceSchedule,
  reloadDeviceConfig,
} from "../api";
import { localize } from "../localize";
import { showConfirmationDialog, showToast } from "../ha-helpers";
import type {
  HomeAssistant,
  ScheduleDeviceInfo,
  ClimateScheduleData,
  DeviceScheduleData,
} from "../types";

const WEEKDAY_KEYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

interface SimplePeriod {
  starttime: string;
  endtime: string;
  temperature: number;
}

interface SimpleWeekdayData {
  base_temperature: number;
  periods: SimplePeriod[];
}

@safeCustomElement("hm-device-schedule")
export class HmDeviceSchedule extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";
  @property() public deviceAddress = "";
  @property() public deviceName = "";

  @state() private _devices: ScheduleDeviceInfo[] = [];
  @state() private _selectedDevice: ScheduleDeviceInfo | null = null;
  @state() private _climateData: ClimateScheduleData | null = null;
  @state() private _deviceData: DeviceScheduleData | null = null;
  @state() private _selectedProfile = "";
  @state() private _selectedWeekday: WeekdayKey = "MONDAY";
  @state() private _editingPeriods: SimplePeriod[] = [];
  @state() private _editingBaseTemp = 17;
  @state() private _loading = true;
  @state() private _saving = false;
  @state() private _error = "";

  updated(changedProps: Map<string, unknown>): void {
    if ((changedProps.has("entryId") || changedProps.has("deviceAddress")) && this.entryId) {
      this._fetchDevices();
    }
  }

  private async _fetchDevices(): Promise<void> {
    this._loading = true;
    this._error = "";
    try {
      this._devices = await listScheduleDevices(this.hass, this.entryId);
      if (this.deviceAddress) {
        const dev = this._devices.find((d) => d.address === this.deviceAddress);
        if (dev) {
          this._selectedDevice = dev;
          await this._loadSchedule(dev);
        }
      }
    } catch (err) {
      this._error = String(err);
    } finally {
      this._loading = false;
    }
  }

  private async _loadSchedule(device: ScheduleDeviceInfo): Promise<void> {
    this._loading = true;
    this._error = "";
    this._climateData = null;
    this._deviceData = null;
    try {
      if (device.schedule_type === "climate") {
        const data = await getClimateSchedule(
          this.hass,
          this.entryId,
          device.address,
          this._selectedProfile || undefined,
        );
        this._climateData = data;
        if (!this._selectedProfile) {
          this._selectedProfile = data.active_profile;
        }
        this._loadWeekdayEditor();
      } else {
        this._deviceData = await getDeviceSchedule(this.hass, this.entryId, device.address);
      }
    } catch {
      this._error = this._l("device_schedule.load_failed");
    } finally {
      this._loading = false;
    }
  }

  private _loadWeekdayEditor(): void {
    if (!this._climateData) return;
    const scheduleData = this._climateData.schedule_data as Record<string, SimpleWeekdayData>;
    const weekdayData = scheduleData[this._selectedWeekday];
    if (weekdayData) {
      this._editingBaseTemp = weekdayData.base_temperature;
      this._editingPeriods = [...weekdayData.periods];
    } else {
      this._editingBaseTemp = 17;
      this._editingPeriods = [];
    }
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private _handleBack(): void {
    this.dispatchEvent(new CustomEvent("back", { bubbles: true, composed: true }));
  }

  private async _handleDeviceSelect(e: Event): Promise<void> {
    const select = e.target as HTMLSelectElement;
    const address = select.value;
    if (!address) {
      this._selectedDevice = null;
      return;
    }
    const dev = this._devices.find((d) => d.address === address);
    if (dev) {
      this._selectedDevice = dev;
      this._selectedProfile = "";
      this._selectedWeekday = "MONDAY";
      await this._loadSchedule(dev);
    }
  }

  private async _handleProfileChange(e: Event): Promise<void> {
    const select = e.target as HTMLSelectElement;
    this._selectedProfile = select.value;
    if (this._selectedDevice) {
      await this._loadSchedule(this._selectedDevice);
    }
  }

  private async _handleSetActiveProfile(): Promise<void> {
    if (!this._selectedDevice || !this._selectedProfile) return;
    try {
      await setClimateActiveProfile(
        this.hass,
        this.entryId,
        this._selectedDevice.address,
        this._selectedProfile,
      );
      if (this._climateData) {
        this._climateData = {
          ...this._climateData,
          active_profile: this._selectedProfile,
        };
      }
      showToast(this, { message: this._l("device_schedule.save_success") });
    } catch {
      showToast(this, { message: this._l("device_schedule.save_failed") });
    }
  }

  private _handleWeekdaySelect(weekday: WeekdayKey): void {
    this._selectedWeekday = weekday;
    this._loadWeekdayEditor();
  }

  private _handlePeriodChange(
    index: number,
    field: keyof SimplePeriod,
    value: string | number,
  ): void {
    const periods = [...this._editingPeriods];
    periods[index] = { ...periods[index], [field]: value };
    this._editingPeriods = periods;
  }

  private _handleAddPeriod(): void {
    const lastPeriod = this._editingPeriods[this._editingPeriods.length - 1];
    const starttime = lastPeriod ? lastPeriod.endtime : "06:00";
    this._editingPeriods = [
      ...this._editingPeriods,
      {
        starttime,
        endtime: "24:00",
        temperature: this._editingBaseTemp + 4,
      },
    ];
  }

  private _handleDeletePeriod(index: number): void {
    this._editingPeriods = this._editingPeriods.filter((_, i) => i !== index);
  }

  private async _handleSaveClimateWeekday(): Promise<void> {
    if (!this._selectedDevice) return;
    this._saving = true;
    try {
      await setClimateScheduleWeekday(
        this.hass,
        this.entryId,
        this._selectedDevice.address,
        this._selectedProfile,
        this._selectedWeekday,
        this._editingBaseTemp,
        this._editingPeriods.map((p) => ({ ...p })),
      );
      showToast(this, { message: this._l("device_schedule.save_success") });
      await this._loadSchedule(this._selectedDevice);
    } catch {
      showToast(this, { message: this._l("device_schedule.save_failed") });
    } finally {
      this._saving = false;
    }
  }

  private async _handleSaveDeviceSchedule(): Promise<void> {
    if (!this._selectedDevice || !this._deviceData) return;
    this._saving = true;
    try {
      await setDeviceSchedule(
        this.hass,
        this.entryId,
        this._selectedDevice.address,
        this._deviceData.schedule_data,
      );
      showToast(this, { message: this._l("device_schedule.save_success") });
    } catch {
      showToast(this, { message: this._l("device_schedule.save_failed") });
    } finally {
      this._saving = false;
    }
  }

  private async _handleReload(): Promise<void> {
    if (!this._selectedDevice) return;
    try {
      await reloadDeviceConfig(this.hass, this.entryId, this._selectedDevice.address);
      showToast(this, { message: this._l("device_schedule.reload_success") });
      await this._loadSchedule(this._selectedDevice);
    } catch {
      showToast(this, { message: this._l("device_schedule.reload_failed") });
    }
  }

  private async _handleExport(): Promise<void> {
    const data = this._climateData?.schedule_data ?? this._deviceData?.schedule_data;
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const addr = this._selectedDevice?.address.replace(/:/g, "_") ?? "schedule";
    a.download = `${addr}_schedule.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async _handleImport(): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !this._selectedDevice) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const confirmed = await showConfirmationDialog(this, {
          title: this._l("device_schedule.import_confirm_title"),
          text: this._l("device_schedule.import_confirm_text"),
          confirmText: this._l("device_schedule.import"),
          dismissText: this._l("common.cancel"),
        });
        if (!confirmed) return;

        if (this._selectedDevice.schedule_type === "climate") {
          // For climate, reload schedule data to get the imported data into state
          this._climateData = {
            ...this._climateData!,
            schedule_data: data,
          };
          this._loadWeekdayEditor();
          showToast(this, { message: this._l("device_schedule.import_success") });
        } else {
          await setDeviceSchedule(this.hass, this.entryId, this._selectedDevice.address, data);
          showToast(this, { message: this._l("device_schedule.import_success") });
          await this._loadSchedule(this._selectedDevice);
        }
      } catch {
        showToast(this, { message: this._l("device_schedule.import_failed") });
      }
    };
    input.click();
  }

  render() {
    if (this._loading && this._devices.length === 0) {
      return html`<div class="loading">${this._l("common.loading")}</div>`;
    }
    if (this._error && this._devices.length === 0) {
      return html`<div class="error">${this._error}</div>`;
    }

    return html`
      <button class="back-button" @click=${this._handleBack}>◂ ${this._l("common.back")}</button>

      <div class="schedule-header">
        <h2>${this._l("device_schedule.title")}</h2>

        <div class="device-selector">
          <select @change=${this._handleDeviceSelect}>
            <option value="">${this._l("device_schedule.select_device")}</option>
            ${this._devices.map(
              (d) => html`
                <option
                  value="${d.address}"
                  ?selected=${d.address === this._selectedDevice?.address}
                >
                  ${d.name} (${d.model}) -
                  ${this._l(`device_schedule.schedule_type_${d.schedule_type}`)}
                </option>
              `,
            )}
          </select>
        </div>
      </div>

      ${this._devices.length === 0
        ? html`<div class="empty-state">${this._l("device_schedule.no_devices")}</div>`
        : nothing}
      ${this._selectedDevice && this._loading
        ? html`<div class="loading">${this._l("common.loading")}</div>`
        : nothing}
      ${this._error && this._selectedDevice
        ? html`<div class="error">${this._error}</div>`
        : nothing}
      ${this._selectedDevice?.schedule_type === "climate" && this._climateData
        ? this._renderClimateSchedule()
        : nothing}
      ${this._selectedDevice?.schedule_type === "default" && this._deviceData
        ? this._renderDeviceSchedule()
        : nothing}
    `;
  }

  private _renderClimateSchedule() {
    const data = this._climateData!;

    return html`
      <div class="schedule-content">
        <div class="toolbar">
          <div class="profile-selector">
            <label>${this._l("device_schedule.profile")}:</label>
            <select @change=${this._handleProfileChange}>
              ${data.available_profiles.map(
                (p) => html`
                  <option value="${p}" ?selected=${p === this._selectedProfile}>
                    ${p}${p === data.active_profile ? " \u2713" : ""}
                  </option>
                `,
              )}
            </select>
            ${this._selectedProfile !== data.active_profile
              ? html`
                  <button class="action-btn small" @click=${this._handleSetActiveProfile}>
                    ${this._l("device_schedule.active_profile")}
                  </button>
                `
              : nothing}
          </div>
          <div class="toolbar-actions">
            <button class="action-btn" @click=${this._handleExport}>
              ${this._l("device_schedule.export")}
            </button>
            <button class="action-btn" @click=${this._handleImport}>
              ${this._l("device_schedule.import")}
            </button>
            <button class="action-btn" @click=${this._handleReload}>
              ${this._l("device_schedule.reload")}
            </button>
          </div>
        </div>

        ${this._renderWeekdayOverview()} ${this._renderWeekdayEditor()}
      </div>
    `;
  }

  private _renderWeekdayOverview() {
    const data = this._climateData!;
    const scheduleData = data.schedule_data as Record<string, SimpleWeekdayData>;
    const weekdayLabels = this._l("device_schedule.weekdays").split(",");

    return html`
      <div class="weekday-overview">
        ${WEEKDAY_KEYS.map(
          (day, i) => html`
            <button
              class="weekday-tab ${day === this._selectedWeekday ? "active" : ""}"
              @click=${() => this._handleWeekdaySelect(day)}
            >
              <span class="weekday-name">${weekdayLabels[i]}</span>
              <span class="weekday-periods"> ${scheduleData[day]?.periods?.length ?? 0} </span>
            </button>
          `,
        )}
      </div>
    `;
  }

  private _renderWeekdayEditor() {
    const dayKey = `weekday_${this._selectedWeekday.toLowerCase()}` as const;

    return html`
      <div class="weekday-editor">
        <h3>${this._l(`device_schedule.${dayKey}`)}</h3>

        <div class="base-temp-row">
          <label>${this._l("device_schedule.base_temperature")}:</label>
          <input
            type="number"
            .value=${String(this._editingBaseTemp)}
            min=${this._climateData?.min_temp ?? 5}
            max=${this._climateData?.max_temp ?? 30.5}
            step=${this._climateData?.step ?? 0.5}
            @change=${(e: Event) => {
              this._editingBaseTemp = parseFloat((e.target as HTMLInputElement).value);
            }}
          />
          &deg;C
        </div>

        <div class="periods-list">
          ${this._editingPeriods.map(
            (period, index) => html`
              <div class="period-row">
                <label>${this._l("device_schedule.from")}:</label>
                <input
                  type="time"
                  .value=${period.starttime}
                  @change=${(e: Event) =>
                    this._handlePeriodChange(
                      index,
                      "starttime",
                      (e.target as HTMLInputElement).value,
                    )}
                />
                <label>${this._l("device_schedule.to")}:</label>
                <input
                  type="time"
                  .value=${period.endtime === "24:00" ? "23:59" : period.endtime}
                  @change=${(e: Event) =>
                    this._handlePeriodChange(
                      index,
                      "endtime",
                      (e.target as HTMLInputElement).value,
                    )}
                />
                <label>${this._l("device_schedule.temperature")}:</label>
                <input
                  type="number"
                  .value=${String(period.temperature)}
                  min=${this._climateData?.min_temp ?? 5}
                  max=${this._climateData?.max_temp ?? 30.5}
                  step=${this._climateData?.step ?? 0.5}
                  @change=${(e: Event) =>
                    this._handlePeriodChange(
                      index,
                      "temperature",
                      parseFloat((e.target as HTMLInputElement).value),
                    )}
                />
                &deg;C
                <button class="delete-btn" @click=${() => this._handleDeletePeriod(index)}>
                  ${this._l("device_schedule.delete_period")}
                </button>
              </div>
            `,
          )}
        </div>

        <div class="editor-actions">
          <button class="action-btn" @click=${this._handleAddPeriod}>
            + ${this._l("device_schedule.add_period")}
          </button>
          <button
            class="action-btn primary"
            ?disabled=${this._saving}
            @click=${this._handleSaveClimateWeekday}
          >
            ${this._saving ? this._l("device_schedule.saving") : this._l("device_schedule.save")}
          </button>
        </div>
      </div>
    `;
  }

  private _renderDeviceSchedule() {
    const data = this._deviceData!;
    const scheduleData = data.schedule_data as Record<string, Record<string, unknown>>;
    const entries = (scheduleData?.entries ?? {}) as Record<string, Record<string, unknown>>;
    const entryCount = Object.keys(entries).length;

    return html`
      <div class="schedule-content">
        <div class="toolbar">
          <div class="schedule-info">
            ${this._l("device_schedule.entries", { count: entryCount })} |
            ${this._l("device_schedule.max_entries", {
              max: data.max_entries,
            })}
            ${data.schedule_domain ? html` | ${data.schedule_domain}` : nothing}
          </div>
          <div class="toolbar-actions">
            <button class="action-btn" @click=${this._handleExport}>
              ${this._l("device_schedule.export")}
            </button>
            <button class="action-btn" @click=${this._handleImport}>
              ${this._l("device_schedule.import")}
            </button>
            <button class="action-btn" @click=${this._handleReload}>
              ${this._l("device_schedule.reload")}
            </button>
          </div>
        </div>

        ${entryCount === 0
          ? html`<div class="empty-state">${this._l("device_schedule.no_schedule_data")}</div>`
          : html`
              <div class="entries-table">
                <div class="entries-header">
                  <span>#</span>
                  <span>${this._l("device_schedule.weekdays")}</span>
                  <span>${this._l("device_schedule.time")}</span>
                  <span>${this._l("device_schedule.condition")}</span>
                </div>
                ${Object.entries(entries).map(
                  ([key, entry]) => html`
                    <div class="entry-row">
                      <span class="entry-key">${key}</span>
                      <span>${this._formatEntryWeekdays(entry)}</span>
                      <span>${this._formatEntryTime(entry)}</span>
                      <span>${this._formatEntryCondition(entry)}</span>
                    </div>
                  `,
                )}
              </div>
            `}

        <div class="editor-actions">
          <button
            class="action-btn primary"
            ?disabled=${this._saving}
            @click=${this._handleSaveDeviceSchedule}
          >
            ${this._saving ? this._l("device_schedule.saving") : this._l("device_schedule.save")}
          </button>
        </div>
      </div>
    `;
  }

  private _formatEntryWeekdays(entry: Record<string, unknown>): string {
    const weekdayLabels = this._l("device_schedule.weekdays").split(",");
    const weekdays = (entry.weekdays ?? []) as string[];
    return weekdays
      .map((wd) => {
        const idx = WEEKDAY_KEYS.indexOf(wd as WeekdayKey);
        return idx >= 0 ? weekdayLabels[idx] : wd;
      })
      .join(", ");
  }

  private _formatEntryTime(entry: Record<string, unknown>): string {
    return String(entry.time ?? entry.begin ?? "");
  }

  private _formatEntryCondition(entry: Record<string, unknown>): string {
    const condition = entry.condition_type ?? entry.condition ?? "";
    return String(condition);
  }

  static styles = [
    sharedStyles,
    css`
      .schedule-header {
        margin-bottom: 16px;
      }

      .schedule-header h2 {
        margin: 8px 0 12px;
        font-size: 20px;
        font-weight: 400;
      }

      .device-selector select {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
      }

      .schedule-content {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        overflow: hidden;
      }

      .toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: var(--secondary-background-color, #fafafa);
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
        flex-wrap: wrap;
        gap: 8px;
      }

      .profile-selector {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .profile-selector label {
        font-size: 14px;
        font-weight: 500;
      }

      .profile-selector select {
        padding: 4px 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
      }

      .toolbar-actions {
        display: flex;
        gap: 8px;
      }

      .schedule-info {
        font-size: 14px;
        color: var(--secondary-text-color);
      }

      .action-btn {
        background: none;
        border: 1px solid var(--primary-color, #03a9f4);
        color: var(--primary-color, #03a9f4);
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
      }

      .action-btn:hover {
        background: var(--primary-color, #03a9f4);
        color: #fff;
      }

      .action-btn.primary {
        background: var(--primary-color, #03a9f4);
        color: #fff;
      }

      .action-btn.primary:hover {
        opacity: 0.9;
      }

      .action-btn.small {
        padding: 2px 8px;
        font-size: 12px;
      }

      .action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .weekday-overview {
        display: flex;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
      }

      .weekday-tab {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 4px;
        border: none;
        background: none;
        cursor: pointer;
        font-family: inherit;
        font-size: 13px;
        color: var(--primary-text-color);
        border-bottom: 2px solid transparent;
      }

      .weekday-tab.active {
        border-bottom-color: var(--primary-color, #03a9f4);
        color: var(--primary-color, #03a9f4);
        font-weight: 500;
      }

      .weekday-tab:hover {
        background: var(--secondary-background-color, #fafafa);
      }

      .weekday-periods {
        font-size: 11px;
        color: var(--secondary-text-color);
        margin-top: 2px;
      }

      .weekday-editor {
        padding: 16px;
      }

      .weekday-editor h3 {
        margin: 0 0 12px;
        font-size: 16px;
        font-weight: 500;
      }

      .base-temp-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        font-size: 14px;
      }

      .base-temp-row input {
        width: 70px;
        padding: 4px 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
      }

      .periods-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }

      .period-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background: var(--secondary-background-color, #fafafa);
        border-radius: 4px;
        flex-wrap: wrap;
        font-size: 14px;
      }

      .period-row input[type="time"] {
        padding: 4px 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
      }

      .period-row input[type="number"] {
        width: 70px;
        padding: 4px 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
      }

      .delete-btn {
        background: none;
        border: 1px solid var(--error-color, #db4437);
        color: var(--error-color, #db4437);
        padding: 2px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-family: inherit;
        margin-left: auto;
      }

      .delete-btn:hover {
        background: var(--error-color, #db4437);
        color: #fff;
      }

      .editor-actions {
        display: flex;
        justify-content: space-between;
        padding: 16px;
        border-top: 1px solid var(--divider-color, #e0e0e0);
      }

      .entries-table {
        font-size: 14px;
      }

      .entries-header {
        display: grid;
        grid-template-columns: 40px 1fr 100px 120px;
        gap: 8px;
        padding: 8px 16px;
        font-weight: 500;
        background: var(--secondary-background-color, #fafafa);
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
      }

      .entry-row {
        display: grid;
        grid-template-columns: 40px 1fr 100px 120px;
        gap: 8px;
        padding: 8px 16px;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
      }

      .entry-row:last-child {
        border-bottom: none;
      }

      .entry-key {
        color: var(--secondary-text-color);
      }

      @media (max-width: 600px) {
        .toolbar {
          flex-direction: column;
          align-items: stretch;
        }

        .toolbar-actions {
          flex-wrap: wrap;
        }

        .period-row {
          flex-direction: column;
          align-items: stretch;
        }

        .period-row input {
          width: 100% !important;
        }

        .delete-btn {
          margin-left: 0;
        }

        .entries-header,
        .entry-row {
          grid-template-columns: 1fr;
          gap: 4px;
        }

        .entries-header {
          display: none;
        }
      }
    `,
  ];
}
