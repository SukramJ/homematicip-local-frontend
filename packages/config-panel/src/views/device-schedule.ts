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
  setScheduleEnabled,
} from "../api";
import { localize } from "../localize";
import { showConfirmationDialog, showToast } from "../ha-helpers";
import type {
  HomeAssistant,
  ScheduleDeviceInfo,
  ClimateScheduleData,
  DeviceScheduleData,
} from "../types";
import "@hmip/schedule-ui";
import {
  parseSimpleWeekdaySchedule,
  timeBlocksToSimpleWeekdayData,
  validateSimpleWeekdayData,
  calculateBaseTemperature,
  createEmptyEntry,
  scheduleToBackend,
} from "@hmip/schedule-core";
import type {
  Weekday,
  SimpleProfileData,
  SimpleSchedule,
  SimpleScheduleEntry,
  ScheduleDomain,
  ConditionType,
  TargetChannelInfo,
  TimeBlock,
} from "@hmip/schedule-core";
import type {
  GridTranslations,
  EditorTranslations,
  WeekdayClickDetail,
  CopyScheduleDetail,
  PasteScheduleDetail,
  SaveScheduleDetail,
  ValidationFailedDetail,
  DeviceListTranslations,
  DeviceEditorTranslations,
  EditEventDetail,
  DeleteEventDetail,
  SaveDeviceEventDetail,
} from "@hmip/schedule-ui";
import type { ClimateValidationMessageKey } from "@hmip/schedule-core";

const DEVICE_MODE_HINTS: Record<string, string> = {
  "HmIP-BSL": "device_schedule.device_mode_hint_bsl",
  "HmIP-RGBW": "device_schedule.device_mode_hint_rgbw",
  "HmIP-DLD": "device_schedule.device_mode_hint_lock",
  "HmIP-FLC": "device_schedule.device_mode_hint_lock",
  "HmIP-DLP": "device_schedule.device_mode_hint_lock",
};

@safeCustomElement("hm-device-schedule")
export class HmDeviceSchedule extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";
  @property() public deviceAddress = "";
  @property() public deviceName = "";
  @property({ type: Boolean }) public editable = true;

  @state() private _devices: ScheduleDeviceInfo[] = [];
  @state() private _selectedDevice: ScheduleDeviceInfo | null = null;
  @state() private _climateData: ClimateScheduleData | null = null;
  @state() private _deviceData: DeviceScheduleData | null = null;
  @state() private _selectedProfile = "";
  @state() private _editingWeekday?: Weekday;
  @state() private _copiedSchedule?: {
    weekday: Weekday;
    blocks: TimeBlock[];
    baseTemperature?: number;
  };
  @state() private _loading = true;
  @state() private _saving = false;
  @state() private _error = "";

  // Device schedule editing state
  @state() private _deviceEditingEntry?: SimpleScheduleEntry;
  @state() private _deviceEditingGroupNo?: string;
  @state() private _deviceShowEditor = false;
  @state() private _deviceIsNewEvent = false;

  updated(changedProps: Map<string, unknown>): void {
    if ((changedProps.has("entryId") || changedProps.has("deviceAddress")) && this.entryId) {
      this._fetchDevices();
    }

    // Sync schedule_enabled from entity attributes when hass state changes
    // (e.g., when the schedule card toggles a channel externally)
    if (changedProps.has("hass") && this._selectedDevice && this._deviceData) {
      this._syncScheduleEnabledFromEntity();
    }
  }

  private _scheduleEntityId?: string;

  private _findScheduleEntityId(): string | undefined {
    if (!this._selectedDevice || !this.hass?.states) return undefined;
    const channelAddr = this._selectedDevice.channel_address;
    for (const [entityId, entity] of Object.entries(this.hass.states)) {
      const attrs = entity.attributes as Record<string, unknown>;
      if (attrs.address === channelAddr && "schedule_enabled" in attrs) {
        return entityId;
      }
    }
    return undefined;
  }

  private _syncScheduleEnabledFromEntity(): void {
    if (!this._deviceData || !this.hass?.states) return;

    if (!this._scheduleEntityId) {
      this._scheduleEntityId = this._findScheduleEntityId();
    }
    if (!this._scheduleEntityId) return;

    const entity = this.hass.states[this._scheduleEntityId];
    if (!entity) return;

    const entityEnabled = (entity.attributes as Record<string, unknown>).schedule_enabled as
      | Record<string, boolean>
      | undefined;
    if (
      entityEnabled &&
      JSON.stringify(entityEnabled) !== JSON.stringify(this._deviceData.schedule_enabled)
    ) {
      this._deviceData = { ...this._deviceData, schedule_enabled: entityEnabled };
    }
  }

  private async _fetchDevices(): Promise<void> {
    this._loading = true;
    this._error = "";
    try {
      this._devices = await listScheduleDevices(this.hass, this.entryId);
      let dev: ScheduleDeviceInfo | undefined;
      if (this.deviceAddress) {
        dev = this._devices.find((d) => d.address === this.deviceAddress);
      }
      if (!dev && this._devices.length > 0) {
        dev = this._devices[0];
      }
      if (dev) {
        this._selectedDevice = dev;
        await this._loadSchedule(dev);
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
        let profile = this._selectedProfile || undefined;

        if (!profile) {
          // First load: fetch without profile to discover available profiles,
          // then reload with the active profile to get proper schedule data.
          const initial = await getClimateSchedule(this.hass, this.entryId, device.address);
          profile = initial.active_profile;
          this._selectedProfile = profile;

          // If the initial call returned weekday data, use it directly.
          // Otherwise reload with the explicit profile.
          const hasWeekdayData = Object.keys(initial.schedule_data).some(
            (k) =>
              k === "MONDAY" ||
              k === "TUESDAY" ||
              k === "WEDNESDAY" ||
              k === "THURSDAY" ||
              k === "FRIDAY" ||
              k === "SATURDAY" ||
              k === "SUNDAY",
          );
          if (hasWeekdayData) {
            this._climateData = initial;
          }
        }

        if (!this._climateData) {
          const data = await getClimateSchedule(this.hass, this.entryId, device.address, profile);
          this._climateData = data;
          if (!this._selectedProfile && data.active_profile) {
            this._selectedProfile = data.active_profile;
          }
        }
      } else {
        this._deviceData = await getDeviceSchedule(this.hass, this.entryId, device.address);
      }
    } catch {
      this._error = this._l("device_schedule.load_failed");
    } finally {
      this._loading = false;
    }
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private _handleBack(): void {
    this.dispatchEvent(new CustomEvent("back", { bubbles: true, composed: true }));
  }

  private async _handleDeviceSelect(e: CustomEvent): Promise<void> {
    e.stopPropagation();
    const address = e.detail.value;
    // Ignore programmatic/initial events (empty or same as current)
    if (!address || address === this._selectedDevice?.address) return;
    const dev = this._devices.find((d) => d.address === address);
    if (dev) {
      this._selectedDevice = dev;
      this._scheduleEntityId = undefined;
      this._selectedProfile = "";
      this._editingWeekday = undefined;
      this._copiedSchedule = undefined;
      this._deviceShowEditor = false;
      this._deviceEditingEntry = undefined;
      this._deviceEditingGroupNo = undefined;
      this._deviceIsNewEvent = false;
      await this._loadSchedule(dev);
    }
  }

  private async _handleProfileChange(e: CustomEvent): Promise<void> {
    e.stopPropagation();
    const newProfile = e.detail.value;
    // Ignore programmatic value changes (empty or same as current)
    if (!newProfile || newProfile === this._selectedProfile) return;
    this._selectedProfile = newProfile;
    if (this._selectedDevice) {
      try {
        await setClimateActiveProfile(
          this.hass,
          this.entryId,
          this._selectedDevice.address,
          newProfile,
        );
      } catch {
        showToast(this, { message: this._l("device_schedule.save_failed") });
        return;
      }
      await this._loadSchedule(this._selectedDevice);
    }
  }

  // Grid event handlers
  private _onWeekdayClick(e: CustomEvent<WeekdayClickDetail>): void {
    this._editingWeekday = e.detail.weekday;
  }

  private _onCopySchedule(e: CustomEvent<CopyScheduleDetail>): void {
    const weekday = e.detail.weekday;
    if (!this._climateData) return;

    const scheduleData = this._climateData.schedule_data as SimpleProfileData;
    const weekdayData = scheduleData[weekday];
    if (!weekdayData) return;

    const { blocks, baseTemperature } = parseSimpleWeekdaySchedule(weekdayData);

    this._copiedSchedule = {
      weekday,
      blocks: JSON.parse(JSON.stringify(blocks)),
      baseTemperature,
    };
  }

  private async _onPasteSchedule(e: CustomEvent<PasteScheduleDetail>): Promise<void> {
    const weekday = e.detail.weekday;
    if (!this._selectedDevice || !this._copiedSchedule || !this._climateData) return;

    const baseTemperature =
      this._copiedSchedule.baseTemperature ?? calculateBaseTemperature(this._copiedSchedule.blocks);

    const simpleWeekdayData = timeBlocksToSimpleWeekdayData(
      this._copiedSchedule.blocks,
      baseTemperature,
    );

    const validationError = validateSimpleWeekdayData(
      simpleWeekdayData,
      this._climateData.min_temp ?? 5,
      this._climateData.max_temp ?? 30.5,
    );
    if (validationError) {
      showToast(this, { message: this._l("device_schedule.invalid_schedule") });
      return;
    }

    this._saving = true;
    try {
      const { base_temperature: baseTemp, periods } = simpleWeekdayData;
      await setClimateScheduleWeekday(
        this.hass,
        this.entryId,
        this._selectedDevice.address,
        this._selectedProfile,
        weekday,
        baseTemp,
        periods.map((p) => ({ ...p })),
      );
      showToast(this, { message: this._l("device_schedule.save_success") });
      await this._loadSchedule(this._selectedDevice);
    } catch {
      showToast(this, { message: this._l("device_schedule.save_failed") });
    } finally {
      this._saving = false;
    }
  }

  // Editor event handlers
  private async _onSaveSchedule(e: CustomEvent<SaveScheduleDetail>): Promise<void> {
    if (!this._selectedDevice || !this._climateData) return;

    const { weekday, blocks, baseTemperature } = e.detail;

    const simpleWeekdayData = timeBlocksToSimpleWeekdayData(blocks, baseTemperature);

    const validationError = validateSimpleWeekdayData(
      simpleWeekdayData,
      this._climateData.min_temp ?? 5,
      this._climateData.max_temp ?? 30.5,
    );
    if (validationError) {
      showToast(this, { message: this._l("device_schedule.invalid_schedule") });
      return;
    }

    this._saving = true;
    try {
      const { base_temperature: baseTemp, periods } = simpleWeekdayData;
      await setClimateScheduleWeekday(
        this.hass,
        this.entryId,
        this._selectedDevice.address,
        this._selectedProfile,
        weekday,
        baseTemp,
        periods.map((p) => ({ ...p })),
      );
      showToast(this, { message: this._l("device_schedule.save_success") });
      this._editingWeekday = undefined;
      await this._loadSchedule(this._selectedDevice);
    } catch {
      showToast(this, { message: this._l("device_schedule.save_failed") });
    } finally {
      this._saving = false;
    }
  }

  private _onValidationFailed(e: CustomEvent<ValidationFailedDetail>): void {
    showToast(this, {
      message: this._l("device_schedule.invalid_schedule", { error: e.detail.error }),
    });
  }

  private _onEditorClosed(): void {
    this._editingWeekday = undefined;
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
          this._climateData = {
            ...this._climateData!,
            schedule_data: data,
          };
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

  private _buildGridTranslations(): GridTranslations {
    return {
      weekdayShortLabels: {
        MONDAY: this._l("device_schedule.weekdays").split(",")[0],
        TUESDAY: this._l("device_schedule.weekdays").split(",")[1],
        WEDNESDAY: this._l("device_schedule.weekdays").split(",")[2],
        THURSDAY: this._l("device_schedule.weekdays").split(",")[3],
        FRIDAY: this._l("device_schedule.weekdays").split(",")[4],
        SATURDAY: this._l("device_schedule.weekdays").split(",")[5],
        SUNDAY: this._l("device_schedule.weekdays").split(",")[6],
      } as Record<Weekday, string>,
      weekdayLongLabels: {
        MONDAY: this._l("device_schedule.weekday_monday"),
        TUESDAY: this._l("device_schedule.weekday_tuesday"),
        WEDNESDAY: this._l("device_schedule.weekday_wednesday"),
        THURSDAY: this._l("device_schedule.weekday_thursday"),
        FRIDAY: this._l("device_schedule.weekday_friday"),
        SATURDAY: this._l("device_schedule.weekday_saturday"),
        SUNDAY: this._l("device_schedule.weekday_sunday"),
      } as Record<Weekday, string>,
      clickToEdit: this._l("device_schedule.click_to_edit"),
      copySchedule: this._l("device_schedule.copy_schedule"),
      pasteSchedule: this._l("device_schedule.paste_schedule"),
    };
  }

  private _buildEditorTranslations(): EditorTranslations {
    const weekdayLabels = this._l("device_schedule.weekdays").split(",");
    return {
      weekdayShortLabels: {
        MONDAY: weekdayLabels[0],
        TUESDAY: weekdayLabels[1],
        WEDNESDAY: weekdayLabels[2],
        THURSDAY: weekdayLabels[3],
        FRIDAY: weekdayLabels[4],
        SATURDAY: weekdayLabels[5],
        SUNDAY: weekdayLabels[6],
      } as Record<Weekday, string>,
      weekdayLongLabels: {
        MONDAY: this._l("device_schedule.weekday_monday"),
        TUESDAY: this._l("device_schedule.weekday_tuesday"),
        WEDNESDAY: this._l("device_schedule.weekday_wednesday"),
        THURSDAY: this._l("device_schedule.weekday_thursday"),
        FRIDAY: this._l("device_schedule.weekday_friday"),
        SATURDAY: this._l("device_schedule.weekday_saturday"),
        SUNDAY: this._l("device_schedule.weekday_sunday"),
      } as Record<Weekday, string>,
      edit: this._l("device_schedule.edit"),
      cancel: this._l("common.cancel"),
      save: this._l("device_schedule.save"),
      addTimeBlock: this._l("device_schedule.add_time_block"),
      from: this._l("device_schedule.from"),
      to: this._l("device_schedule.to"),
      baseTemperature: this._l("device_schedule.base_temperature"),
      baseTemperatureDescription: this._l("device_schedule.base_temperature_description"),
      temperaturePeriods: this._l("device_schedule.temperature_periods"),
      editSlot: this._l("device_schedule.edit_slot"),
      saveSlot: this._l("device_schedule.save_slot"),
      cancelSlotEdit: this._l("device_schedule.cancel_slot_edit"),
      removeSlot: this._l("device_schedule.remove_slot"),
      close: this._l("common.close"),
      undoShortcut: this._l("device_schedule.undo_shortcut"),
      redoShortcut: this._l("device_schedule.redo_shortcut"),
      warningsTitle: this._l("device_schedule.warnings_title"),
      validationMessages: {
        blockEndBeforeStart: this._l("device_schedule.validation_block_end_before_start"),
        blockZeroDuration: this._l("device_schedule.validation_block_zero_duration"),
        invalidStartTime: this._l("device_schedule.validation_invalid_start_time"),
        invalidEndTime: this._l("device_schedule.validation_invalid_end_time"),
        temperatureOutOfRange: this._l("device_schedule.validation_temp_out_of_range"),
        invalidSlotCount: this._l("device_schedule.validation_invalid_slot_count"),
        invalidSlotKey: this._l("device_schedule.validation_invalid_slot_key"),
        missingSlot: this._l("device_schedule.validation_missing_slot"),
        slotMissingValues: this._l("device_schedule.validation_slot_missing_values"),
        slotTimeBackwards: this._l("device_schedule.validation_slot_time_backwards"),
        slotTimeExceedsDay: this._l("device_schedule.validation_slot_time_exceeds_day"),
        lastSlotMustEnd: this._l("device_schedule.validation_last_slot_must_end"),
        scheduleMustBeObject: this._l("device_schedule.validation_schedule_must_be_object"),
        missingWeekday: this._l("device_schedule.validation_missing_weekday"),
        invalidWeekdayData: this._l("device_schedule.validation_invalid_weekday_data"),
        weekdayValidationError: this._l("device_schedule.validation_weekday_error"),
      } as Record<ClimateValidationMessageKey, string>,
    };
  }

  render() {
    if (this._loading && this._devices.length === 0) {
      return html`<div class="loading">${this._l("common.loading")}</div>`;
    }
    if (this._error && this._devices.length === 0) {
      return html`<div class="error">
        ${this._error}
        <br />
        <ha-button outlined @click=${this._fetchDevices}> ${this._l("common.retry")} </ha-button>
      </div>`;
    }

    return html`
      <ha-icon-button
        class="back-button"
        .path=${"M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"}
        @click=${this._handleBack}
        .label=${this._l("common.back")}
      ></ha-icon-button>

      <div class="schedule-header">
        <h2>${this._l("device_schedule.title")}</h2>

        <div class="device-selector">
          <ha-select
            .label=${this._l("device_schedule.select_device")}
            .value=${this._selectedDevice?.address ?? ""}
            .options=${[...this._devices]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((d) => ({
                value: d.address,
                label: `${d.name} (${d.model}) - ${this._l(`device_schedule.schedule_type_${d.schedule_type}`)}`,
              }))}
            @selected=${this._handleDeviceSelect}
            @closed=${(e: Event) => e.stopPropagation()}
          ></ha-select>
        </div>
        ${this._selectedDevice && DEVICE_MODE_HINTS[this._selectedDevice.model]
          ? html`<ha-alert alert-type="info">
              ${this._l(DEVICE_MODE_HINTS[this._selectedDevice.model])}
            </ha-alert>`
          : nothing}
      </div>

      ${this._devices.length === 0
        ? html`<div class="empty-state">${this._l("device_schedule.no_devices")}</div>`
        : nothing}
      ${this._selectedDevice && this._loading
        ? html`<div class="loading">${this._l("common.loading")}</div>`
        : nothing}
      ${this._error && this._selectedDevice
        ? html`<div class="error">
            ${this._error}
            <br />
            <ha-button outlined @click=${() => this._loadSchedule(this._selectedDevice!)}>
              ${this._l("common.retry")}
            </ha-button>
          </div>`
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
    const scheduleData = data.schedule_data as SimpleProfileData;

    return html`
      <div class="schedule-content">
        <div class="toolbar">
          <div class="profile-selector">
            <ha-select
              .label=${this._l("device_schedule.profile")}
              .value=${this._selectedProfile}
              .options=${data.available_profiles.map((p, i) => ({
                value: p,
                label:
                  data.device_active_profile_index === i + 1
                    ? `${p} (${this._l("device_schedule.active_profile")})`
                    : p,
              }))}
              @selected=${this._handleProfileChange}
              @closed=${(e: Event) => e.stopPropagation()}
            ></ha-select>
          </div>
          <div class="toolbar-actions">
            <ha-button outlined @click=${this._handleExport}>
              ${this._l("device_schedule.export")}
            </ha-button>
            ${this.editable
              ? html`
                  <ha-button outlined @click=${this._handleImport}>
                    ${this._l("device_schedule.import")}
                  </ha-button>
                  <ha-button outlined @click=${this._handleReload}>
                    ${this._l("device_schedule.reload")}
                  </ha-button>
                `
              : nothing}
          </div>
        </div>

        <div class="climate-grid-container">
          <hmip-schedule-grid
            .scheduleData=${scheduleData}
            .editable=${this.editable}
            .showTemperature=${true}
            .showGradient=${false}
            temperatureUnit="°C"
            hourFormat="24"
            .translations=${this._buildGridTranslations()}
            .copiedWeekday=${this._copiedSchedule?.weekday}
            .editorOpen=${!!this._editingWeekday}
            .currentProfile=${this._selectedProfile}
            @weekday-click=${this._onWeekdayClick}
            @copy-schedule=${this._onCopySchedule}
            @paste-schedule=${this._onPasteSchedule}
          ></hmip-schedule-grid>
        </div>

        <hmip-schedule-editor
          .open=${!!this._editingWeekday}
          .weekday=${this._editingWeekday}
          .scheduleData=${scheduleData}
          .minTemp=${data.min_temp ?? 5}
          .maxTemp=${data.max_temp ?? 30.5}
          .tempStep=${data.step ?? 0.5}
          temperatureUnit="°C"
          hourFormat="24"
          .translations=${this._buildEditorTranslations()}
          @save-schedule=${this._onSaveSchedule}
          @validation-failed=${this._onValidationFailed}
          @editor-closed=${this._onEditorClosed}
        ></hmip-schedule-editor>
      </div>

      ${this._saving
        ? html`<div class="saving-overlay">${this._l("device_schedule.saving")}</div>`
        : nothing}
    `;
  }

  // Device schedule event handlers
  private _onDeviceAddEvent(): void {
    if (!this._deviceData) return;

    const entries = (this._deviceData.schedule_data as { entries?: SimpleSchedule })?.entries ?? {};
    const maxEntries = this._deviceData.max_entries;
    if (maxEntries && Object.keys(entries).length >= maxEntries) {
      showToast(this, {
        message: this._l("device_schedule.max_entries", { max: maxEntries }),
      });
      return;
    }

    const domain = (this._deviceData.schedule_domain ?? undefined) as ScheduleDomain | undefined;
    const newEntry = createEmptyEntry(domain);

    const availableChannels = this._deviceData.available_target_channels as
      | Record<string, TargetChannelInfo>
      | undefined;
    if (availableChannels) {
      const firstChannelKey = Object.keys(availableChannels)[0];
      if (firstChannelKey) {
        newEntry.target_channels = [firstChannelKey];
      }
    }

    const existingGroupNos = Object.keys(entries).map((k) => parseInt(k, 10));
    const maxGroupNo = existingGroupNos.length > 0 ? Math.max(...existingGroupNos) : 0;

    this._deviceEditingGroupNo = String(maxGroupNo + 1);
    this._deviceEditingEntry = { ...newEntry };
    this._deviceIsNewEvent = true;
    this._deviceShowEditor = true;
  }

  private _onDeviceEditEvent(e: CustomEvent<EditEventDetail>): void {
    const entry = e.detail.entry;
    this._deviceEditingGroupNo = entry.groupNo;
    this._deviceEditingEntry = { ...entry };
    this._deviceIsNewEvent = false;
    this._deviceShowEditor = true;
  }

  private async _onDeviceDeleteEvent(e: CustomEvent<DeleteEventDetail>): Promise<void> {
    if (!confirm(this._l("device_schedule.confirm_delete"))) return;

    if (!this._deviceData || !this._selectedDevice) return;

    const entries = {
      ...((this._deviceData.schedule_data as { entries?: SimpleSchedule })?.entries ?? {}),
    };
    delete entries[e.detail.entry.groupNo];

    this._saving = true;
    try {
      await setDeviceSchedule(this.hass, this.entryId, this._selectedDevice.address, {
        entries: scheduleToBackend(entries),
      });
      showToast(this, { message: this._l("device_schedule.save_success") });
      await this._loadSchedule(this._selectedDevice);
    } catch {
      showToast(this, { message: this._l("device_schedule.save_failed") });
    } finally {
      this._saving = false;
    }
  }

  private async _onDeviceSaveEvent(e: CustomEvent<SaveDeviceEventDetail>): Promise<void> {
    if (!this._deviceData || !this._selectedDevice) return;

    const { entry, groupNo } = e.detail;
    const entries = {
      ...((this._deviceData.schedule_data as { entries?: SimpleSchedule })?.entries ?? {}),
      [groupNo]: entry,
    };

    this._saving = true;
    this._deviceShowEditor = false;
    this._deviceEditingEntry = undefined;
    this._deviceEditingGroupNo = undefined;
    this._deviceIsNewEvent = false;

    try {
      await setDeviceSchedule(this.hass, this.entryId, this._selectedDevice.address, {
        entries: scheduleToBackend(entries),
      });
      showToast(this, { message: this._l("device_schedule.save_success") });
      await this._loadSchedule(this._selectedDevice);
    } catch {
      showToast(this, { message: this._l("device_schedule.save_failed") });
    } finally {
      this._saving = false;
    }
  }

  private _onDeviceEditorClosed(): void {
    this._deviceShowEditor = false;
    this._deviceEditingEntry = undefined;
    this._deviceEditingGroupNo = undefined;
    this._deviceIsNewEvent = false;
  }

  private async _handleScheduleEnabledToggle(channelKey: string): Promise<void> {
    if (!this._selectedDevice || !this._deviceData || this._deviceData.schedule_enabled === null) {
      return;
    }

    const newEnabled = !this._deviceData.schedule_enabled[channelKey];
    this._saving = true;
    try {
      await setScheduleEnabled(
        this.hass,
        this.entryId,
        this._selectedDevice.address,
        newEnabled,
        channelKey,
      );
      showToast(this, {
        message: newEnabled
          ? this._l("device_schedule.weekly_program_enabled_toast")
          : this._l("device_schedule.weekly_program_disabled_toast"),
      });
      await this._loadSchedule(this._selectedDevice);
    } catch {
      showToast(this, { message: this._l("device_schedule.weekly_program_enable_failed") });
    } finally {
      this._saving = false;
    }
  }

  private _buildDeviceListTranslations(): DeviceListTranslations {
    const weekdayLabels = this._l("device_schedule.weekdays").split(",");
    return {
      weekdayShortLabels: {
        MONDAY: weekdayLabels[0],
        TUESDAY: weekdayLabels[1],
        WEDNESDAY: weekdayLabels[2],
        THURSDAY: weekdayLabels[3],
        FRIDAY: weekdayLabels[4],
        SATURDAY: weekdayLabels[5],
        SUNDAY: weekdayLabels[6],
      } as Record<Weekday, string>,
      condition: this._l("device_schedule.condition"),
      time: this._l("device_schedule.time"),
      weekdays: this._l("device_schedule.weekdays_label"),
      duration: this._l("device_schedule.duration"),
      state: this._l("device_schedule.level"),
      addEvent: this._l("device_schedule.add_event"),
      editEvent: this._l("device_schedule.edit_event"),
      deleteEvent: this._l("device_schedule.delete_event"),
      slat: this._l("device_schedule.slat"),
      noScheduleEvents: this._l("device_schedule.no_schedule_data"),
      loading: this._l("common.loading"),
      conditionLabels: {
        fixed_time: this._l("device_schedule.condition_fixed_time"),
        astro: this._l("device_schedule.condition_astro"),
        fixed_if_before_astro: this._l("device_schedule.condition_fixed_if_before_astro"),
        astro_if_before_fixed: this._l("device_schedule.condition_astro_if_before_fixed"),
        fixed_if_after_astro: this._l("device_schedule.condition_fixed_if_after_astro"),
        astro_if_after_fixed: this._l("device_schedule.condition_astro_if_after_fixed"),
        earliest: this._l("device_schedule.condition_earliest"),
        latest: this._l("device_schedule.condition_latest"),
      } as Record<ConditionType, string>,
      levelOn: this._l("device_schedule.level_on"),
      levelOff: this._l("device_schedule.level_off"),
      conditionSummaryLabels: {
        sunrise: this._l("device_schedule.astro_sunrise"),
        sunset: this._l("device_schedule.astro_sunset"),
        or: this._l("device_schedule.or"),
        ifBefore: this._l("device_schedule.if_before"),
        ifAfter: this._l("device_schedule.if_after"),
      },
    };
  }

  private _buildDeviceEditorTranslations(): DeviceEditorTranslations {
    const weekdayLabels = this._l("device_schedule.weekdays").split(",");
    return {
      weekdayShortLabels: {
        MONDAY: weekdayLabels[0],
        TUESDAY: weekdayLabels[1],
        WEDNESDAY: weekdayLabels[2],
        THURSDAY: weekdayLabels[3],
        FRIDAY: weekdayLabels[4],
        SATURDAY: weekdayLabels[5],
        SUNDAY: weekdayLabels[6],
      } as Record<Weekday, string>,
      addEvent: this._l("device_schedule.add_event"),
      editEvent: this._l("device_schedule.edit_event"),
      cancel: this._l("common.cancel"),
      save: this._l("device_schedule.save"),
      time: this._l("device_schedule.time"),
      condition: this._l("device_schedule.condition"),
      weekdaysLabel: this._l("device_schedule.weekdays_label"),
      stateLabel: this._l("device_schedule.level"),
      duration: this._l("device_schedule.duration"),
      rampTime: this._l("device_schedule.ramp_time"),
      channels: this._l("device_schedule.target_channel"),
      levelOn: this._l("device_schedule.level_on"),
      levelOff: this._l("device_schedule.level_off"),
      slat: this._l("device_schedule.slat"),
      astroSunrise: this._l("device_schedule.astro_sunrise"),
      astroSunset: this._l("device_schedule.astro_sunset"),
      astroOffset: this._l("device_schedule.astro_offset"),
      confirmDelete: this._l("device_schedule.confirm_delete"),
      conditionLabels: {
        fixed_time: this._l("device_schedule.condition_fixed_time"),
        astro: this._l("device_schedule.condition_astro"),
        fixed_if_before_astro: this._l("device_schedule.condition_fixed_if_before_astro"),
        astro_if_before_fixed: this._l("device_schedule.condition_astro_if_before_fixed"),
        fixed_if_after_astro: this._l("device_schedule.condition_fixed_if_after_astro"),
        astro_if_after_fixed: this._l("device_schedule.condition_astro_if_after_fixed"),
        earliest: this._l("device_schedule.condition_earliest"),
        latest: this._l("device_schedule.condition_latest"),
      } as Record<ConditionType, string>,
    };
  }

  private _renderDeviceSchedule() {
    const data = this._deviceData!;
    const scheduleData = data.schedule_data as { entries?: SimpleSchedule };
    const entries = scheduleData?.entries ?? {};
    const entryCount = Object.keys(entries).length;
    const domain = (data.schedule_domain ?? undefined) as ScheduleDomain | undefined;
    const availableChannels = data.available_target_channels as
      | Record<string, TargetChannelInfo>
      | undefined;

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
            <ha-button outlined @click=${this._handleExport}>
              ${this._l("device_schedule.export")}
            </ha-button>
            ${this.editable
              ? html`
                  <ha-button outlined @click=${this._handleImport}>
                    ${this._l("device_schedule.import")}
                  </ha-button>
                  <ha-button outlined @click=${this._handleReload}>
                    ${this._l("device_schedule.reload")}
                  </ha-button>
                `
              : nothing}
          </div>
        </div>

        ${data.schedule_enabled !== null
          ? html`<div class="schedule-enabled-bar">
              <span class="schedule-enabled-title"
                >${this._l("device_schedule.weekly_program")}:</span
              >
              <div class="channel-chips">
                ${Object.entries(data.schedule_enabled).map(
                  ([channelKey, enabled]) =>
                    html` <button
                      class="channel-chip ${enabled ? "active" : "inactive"}"
                      .disabled=${!this.editable || this._saving}
                      @click=${() => this._handleScheduleEnabledToggle(channelKey)}
                      title="${(
                        data.available_target_channels as Record<string, { name?: string }>
                      )?.[channelKey]?.name ?? channelKey}: ${enabled
                        ? this._l("device_schedule.weekly_program_enabled")
                        : this._l("device_schedule.weekly_program_disabled")}"
                    >
                      ${(data.available_target_channels as Record<string, { name?: string }>)?.[
                        channelKey
                      ]?.name ?? channelKey}
                    </button>`,
                )}
              </div>
            </div>`
          : nothing}

        <div class="device-schedule-container">
          <hmip-device-schedule-list
            .scheduleData=${entries as SimpleSchedule}
            .domain=${domain}
            .editable=${this.editable}
            .translations=${this._buildDeviceListTranslations()}
            @add-event=${this._onDeviceAddEvent}
            @edit-event=${this._onDeviceEditEvent}
            @delete-event=${this._onDeviceDeleteEvent}
          ></hmip-device-schedule-list>
        </div>

        <hmip-device-schedule-editor
          .open=${this._deviceShowEditor}
          .entry=${this._deviceEditingEntry}
          .groupNo=${this._deviceEditingGroupNo}
          .isNewEvent=${this._deviceIsNewEvent}
          .domain=${domain}
          .availableTargetChannels=${availableChannels}
          .translations=${this._buildDeviceEditorTranslations()}
          @save-event=${this._onDeviceSaveEvent}
          @editor-closed=${this._onDeviceEditorClosed}
        ></hmip-device-schedule-editor>
      </div>

      ${this._saving
        ? html`<div class="saving-overlay">${this._l("device_schedule.saving")}</div>`
        : nothing}
    `;
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

      .device-selector ha-select {
        width: 100%;
      }

      .schedule-header ha-alert {
        margin-top: 8px;
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

      .profile-selector ha-select {
        min-width: 150px;
      }

      .toolbar-actions {
        display: flex;
        gap: 8px;
      }

      .schedule-info {
        font-size: 14px;
        color: var(--secondary-text-color);
      }

      .climate-grid-container {
        padding: 16px;
      }

      .saving-overlay {
        text-align: center;
        padding: 12px;
        color: var(--secondary-text-color);
        font-style: italic;
      }

      .schedule-enabled-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
        flex-wrap: wrap;
      }

      .schedule-enabled-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--secondary-text-color);
        white-space: nowrap;
      }

      .channel-chips {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }

      .channel-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        line-height: 1;
        border: none;
        cursor: pointer;
        transition:
          background-color 0.2s,
          opacity 0.2s;
      }

      .channel-chip.active {
        background-color: var(--primary-color);
        color: var(--text-primary-color);
      }

      .channel-chip.inactive {
        background-color: var(--divider-color);
        color: var(--disabled-text-color, var(--secondary-text-color));
        opacity: 0.6;
      }

      .channel-chip:hover:not([disabled]) {
        opacity: 0.8;
      }

      .channel-chip[disabled] {
        cursor: not-allowed;
        opacity: 0.4;
      }

      .device-schedule-container {
        padding: 16px;
      }

      @media (max-width: 600px) {
        .toolbar {
          flex-direction: column;
          align-items: stretch;
        }

        .toolbar-actions {
          flex-wrap: wrap;
        }
      }
    `,
  ];
}
