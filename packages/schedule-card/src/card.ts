import "./editor";
import "@hmip/schedule-ui";
import { LitElement, html, css, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import {
  ScheduleCardConfig,
  HomeAssistant,
  ScheduleEntityAttributes,
  SimpleSchedule,
  SimpleScheduleEntry,
  ScheduleDomain,
  Weekday,
  TargetChannelInfo,
} from "./types";
import {
  createEmptyEntry,
  getDeviceAddress,
  isValidScheduleEntity,
  scheduleToBackend,
} from "@hmip/schedule-core";
import { setDeviceSchedule, reloadDeviceConfig } from "@hmip/panel-api";
import { getTranslations, formatString, Translations } from "./localization";
import type {
  DeviceListTranslations,
  DeviceEditorTranslations,
  EditEventDetail,
  DeleteEventDetail,
  SaveDeviceEventDetail,
} from "@hmip/schedule-ui";

export class HomematicScheduleCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: ScheduleCardConfig;
  @state() private _scheduleData?: SimpleSchedule;
  @state() private _activeEntityId?: string;
  @state() private _domain?: ScheduleDomain;
  @state() private _isLoading: boolean = false;
  private _loadingTimeoutId?: number;
  @state() private _translations: Translations = getTranslations("en");
  @state() private _editingEntry?: SimpleScheduleEntry;
  @state() private _editingGroupNo?: string;
  @state() private _showEditor: boolean = false;
  @state() private _isNewEvent: boolean = false;
  @state() private _availableTargetChannels?: Record<string, TargetChannelInfo>;
  @state() private _maxEntries?: number;

  private get _isEditable(): boolean {
    return this._config?.editable ?? true;
  }

  public setConfig(config: ScheduleCardConfig): void {
    const entityIds: string[] = [];
    const addEntity = (entityId?: string) => {
      if (!entityId) return;
      const trimmed = entityId.trim();
      if (!trimmed) return;
      if (!entityIds.includes(trimmed)) {
        entityIds.push(trimmed);
      }
    };

    addEntity(config.entity);
    if (Array.isArray(config.entities)) {
      config.entities.forEach((entityId) => addEntity(entityId));
    }

    if (entityIds.length === 0) {
      throw new Error("You need to define at least one entity");
    }

    entityIds.sort((a, b) => a.localeCompare(b));

    const previousEntity = this._activeEntityId;
    const fallbackEntity = entityIds[0];
    const nextActiveEntity =
      previousEntity && entityIds.includes(previousEntity) ? previousEntity : fallbackEntity;

    this._config = {
      editable: true,
      hour_format: "24",
      ...config,
      entity: fallbackEntity,
      entities: [...entityIds],
    };

    this._activeEntityId = nextActiveEntity;
    this._editingEntry = undefined;
    this._editingGroupNo = undefined;
    this._showEditor = false;

    this._updateLanguage();
  }

  private _updateLanguage(): void {
    let language = "en";

    if (this._config?.language) {
      language = this._config.language;
    } else if (this.hass?.language) {
      language = this.hass.language;
    } else if (this.hass?.locale?.language) {
      language = this.hass.locale.language;
    }

    this._translations = getTranslations(language);
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has("hass")) {
      const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
      if (this.hass && oldHass) {
        if (
          this.hass.language !== oldHass.language ||
          this.hass.locale?.language !== oldHass.locale?.language
        ) {
          this._updateLanguage();
        }

        if (this._activeEntityId && !this._isLoading) {
          const oldState = oldHass.states?.[this._activeEntityId];
          const newState = this.hass.states?.[this._activeEntityId];
          if (oldState !== newState) {
            this._updateScheduleData();
          }
        }
      } else if (this.hass && !oldHass) {
        this._updateLanguage();
        this._updateScheduleData();
      }
    }

    if (changedProps.has("_activeEntityId")) {
      this._updateScheduleData();
    }

    return true;
  }

  private _isValidScheduleEntity(entityId: string): boolean {
    const entity = this.hass?.states?.[entityId];
    if (!entity) return false;
    const attributes = entity.attributes as unknown as ScheduleEntityAttributes;
    return isValidScheduleEntity(attributes);
  }

  private _updateScheduleData(): void {
    if (!this._activeEntityId || !this.hass?.states) {
      this._scheduleData = undefined;
      this._domain = undefined;
      this._availableTargetChannels = undefined;
      this._maxEntries = undefined;
      return;
    }

    const entity = this.hass.states[this._activeEntityId];
    if (!entity) {
      this._scheduleData = undefined;
      this._domain = undefined;
      this._availableTargetChannels = undefined;
      this._maxEntries = undefined;
      return;
    }

    const attributes = entity.attributes as unknown as ScheduleEntityAttributes;

    if (!isValidScheduleEntity(attributes)) {
      this._scheduleData = undefined;
      this._domain = undefined;
      this._availableTargetChannels = undefined;
      this._maxEntries = undefined;
      return;
    }

    this._scheduleData = attributes.schedule_data?.entries;
    this._availableTargetChannels = attributes.available_target_channels;
    this._maxEntries = attributes.max_entries;

    if (attributes.schedule_domain) {
      this._domain = attributes.schedule_domain;
    } else if (this._config?.schedule_domain) {
      this._domain = this._config.schedule_domain;
    } else {
      this._domain = undefined;
    }
  }

  private _getEntityName(entityId: string): string {
    const entity = this.hass?.states?.[entityId];
    return (entity?.attributes?.friendly_name as string) || entityId;
  }

  private _handleEntityChange(e: CustomEvent): void {
    e.stopPropagation();
    this._activeEntityId = e.detail.value;
    this._closeEditor();
  }

  private _getDeviceAddress(entityId: string): string | undefined {
    const entity = this.hass?.states?.[entityId];
    if (!entity) return undefined;
    const attributes = entity.attributes as unknown as ScheduleEntityAttributes;
    return getDeviceAddress(attributes.address);
  }

  private _requireDeviceAddress(entityId: string): string {
    const deviceAddress = this._getDeviceAddress(entityId);
    if (!deviceAddress) {
      throw new Error(`Cannot determine device address for entity ${entityId}`);
    }
    return deviceAddress;
  }

  private _requireConfigEntryId(entityId: string): string {
    const entity = this.hass?.states?.[entityId];
    const configEntryId = (entity?.attributes as unknown as ScheduleEntityAttributes)
      ?.config_entry_id;
    if (!configEntryId) {
      throw new Error(
        `Cannot resolve config_entry_id for entity ${entityId}. ` +
          `Ensure the entity has a valid config_entry_id attribute.`,
      );
    }
    return configEntryId;
  }

  // Event handlers for <hmip-device-schedule-list>
  private _onAddEvent(): void {
    if (this._maxEntries && this._scheduleData) {
      const currentEntries = Object.keys(this._scheduleData).length;
      if (currentEntries >= this._maxEntries) {
        alert(
          formatString(this._translations.ui.maxEntriesReached, {
            max: String(this._maxEntries),
          }),
        );
        return;
      }
    }

    const newEntry = createEmptyEntry(this._domain);

    if (this._availableTargetChannels) {
      const firstChannelKey = Object.keys(this._availableTargetChannels)[0];
      if (firstChannelKey) {
        newEntry.target_channels = [firstChannelKey];
      }
    }

    const existingGroupNos = this._scheduleData
      ? Object.keys(this._scheduleData).map((k) => parseInt(k, 10))
      : [];
    const maxGroupNo = existingGroupNos.length > 0 ? Math.max(...existingGroupNos) : 0;
    this._editingGroupNo = String(maxGroupNo + 1);
    this._editingEntry = { ...newEntry };
    this._isNewEvent = true;
    this._showEditor = true;
  }

  private _onEditEvent(e: CustomEvent<EditEventDetail>): void {
    const entry = e.detail.entry;
    this._editingGroupNo = entry.groupNo;
    this._editingEntry = { ...entry };
    this._isNewEvent = false;
    this._showEditor = true;
  }

  private _onDeleteEvent(e: CustomEvent<DeleteEventDetail>): void {
    if (!confirm(this._translations.ui.confirmDelete || "Delete this event?")) {
      return;
    }

    const updatedSchedule = { ...this._scheduleData };
    delete updatedSchedule[e.detail.entry.groupNo];
    this._saveSchedule(updatedSchedule);
  }

  // Event handler for <hmip-device-schedule-editor>
  private _onSaveEvent(e: CustomEvent<SaveDeviceEventDetail>): void {
    const { entry, groupNo } = e.detail;

    const updatedSchedule = {
      ...this._scheduleData,
      [groupNo]: entry,
    };

    this._saveSchedule(updatedSchedule);
    this._closeEditor();
  }

  private _onEditorClosed(): void {
    this._closeEditor();
  }

  private _closeEditor(): void {
    this._showEditor = false;
    this._editingEntry = undefined;
    this._editingGroupNo = undefined;
    this._isNewEvent = false;
  }

  private async _saveSchedule(scheduleData: SimpleSchedule): Promise<void> {
    if (!this._activeEntityId || !this.hass) {
      return;
    }

    const entityId = this._activeEntityId;
    this._startLoading();

    try {
      const configEntryId = this._requireConfigEntryId(entityId);
      const deviceAddress = this._requireDeviceAddress(entityId);

      await setDeviceSchedule(this.hass, configEntryId, deviceAddress, {
        entries: scheduleToBackend(scheduleData),
      });

      this._scheduleData = scheduleData;

      if (this._needsManualReload(entityId)) {
        this._scheduleReloadDeviceConfig(entityId);
      }
    } catch (error) {
      const message = String(error);
      if (message.includes("unauthorized") || message.includes("Unauthorized")) {
        alert(this._translations.errors.insufficientPermissions);
      } else {
        alert(
          formatString(this._translations.errors.failedToSaveSchedule, {
            error: message,
          }),
        );
      }
    } finally {
      this._stopLoading();
    }
  }

  private _startLoading(): void {
    this._isLoading = true;
    this._loadingTimeoutId = window.setTimeout(() => {
      this._isLoading = false;
    }, 10000);
  }

  private _stopLoading(): void {
    this._isLoading = false;
    if (this._loadingTimeoutId !== undefined) {
      clearTimeout(this._loadingTimeoutId);
      this._loadingTimeoutId = undefined;
    }
  }

  private _exportSchedule(): void {
    if (!this._scheduleData || !this._activeEntityId) {
      return;
    }

    try {
      const entityName = this._getEntityName(this._activeEntityId);
      const exportData = {
        version: "2.0",
        entity: this._activeEntityId,
        schedule_domain: this._domain,
        exportDate: new Date().toISOString(),
        schedule: this._scheduleData,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().split("T")[0];
      a.download = `schedule-${entityName.replace(/[^a-zA-Z0-9]/g, "_")}-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(
        formatString(this._translations.errors.failedToExport, {
          error: String(error),
        }),
      );
    }
  }

  private _importSchedule(): void {
    if (!this._isEditable) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.schedule || typeof data.schedule !== "object") {
          throw new Error(this._translations.errors.invalidImportData);
        }

        if (data.schedule_domain && data.schedule_domain !== this._domain) {
          const proceed = confirm(
            `Warning: The imported schedule is for a ${data.schedule_domain} device, but the current entity is a ${this._domain} device. Continue anyway?`,
          );
          if (!proceed) return;
        }

        await this._saveSchedule(data.schedule as SimpleSchedule);
      } catch (error) {
        if (error instanceof SyntaxError) {
          alert(this._translations.errors.invalidImportFormat);
        } else {
          alert(
            formatString(this._translations.errors.failedToImport, {
              error: String(error),
            }),
          );
        }
      }
    };
    input.click();
  }

  private _needsManualReload(entityId?: string): boolean {
    if (!entityId || !this.hass) return false;
    const entity = this.hass.states[entityId];
    if (!entity?.attributes?.interface_id) return false;
    const interfaceId = entity.attributes.interface_id as string;
    return (
      interfaceId.endsWith("BidCos-RF") ||
      interfaceId.endsWith("BidCos-Wired") ||
      interfaceId.endsWith("VirtualDevices")
    );
  }

  private _scheduleReloadDeviceConfig(entityId: string): void {
    if (!this.hass) return;
    const deviceAddress = this._getDeviceAddress(entityId);
    if (!deviceAddress) {
      console.warn("Cannot reload device config: address attribute missing");
      return;
    }
    const entity = this.hass.states[entityId];
    const configEntryId = (entity?.attributes as unknown as ScheduleEntityAttributes)
      ?.config_entry_id;
    if (!configEntryId) {
      console.warn("Cannot reload device config: config_entry_id missing");
      return;
    }

    setTimeout(async () => {
      try {
        await reloadDeviceConfig(this.hass, configEntryId, deviceAddress);
      } catch {
        // Silently fail — reload is best-effort for BidCos devices
      }
    }, 5000);
  }

  // Translation bridge methods
  private _buildListTranslations(): DeviceListTranslations {
    const t = this._translations;
    return {
      weekdayShortLabels: {
        MONDAY: t.weekdays.short.monday,
        TUESDAY: t.weekdays.short.tuesday,
        WEDNESDAY: t.weekdays.short.wednesday,
        THURSDAY: t.weekdays.short.thursday,
        FRIDAY: t.weekdays.short.friday,
        SATURDAY: t.weekdays.short.saturday,
        SUNDAY: t.weekdays.short.sunday,
      } as Record<Weekday, string>,
      condition: t.ui.condition,
      time: t.ui.time,
      weekdays: t.ui.weekdays,
      duration: t.ui.duration,
      state: t.ui.state,
      addEvent: t.ui.addEvent,
      slat: t.ui.slat,
      noScheduleEvents: "No schedule events configured",
      loading: t.ui.loading,
      conditionLabels: t.conditions,
      levelOn: t.ui.levelOn,
      levelOff: t.ui.levelOff,
      conditionSummaryLabels: {
        sunrise: t.ui.astroSunrise,
        sunset: t.ui.astroSunset,
        or: t.ui.or,
        ifBefore: t.ui.ifBefore,
        ifAfter: t.ui.ifAfter,
      },
    };
  }

  private _buildEditorTranslations(): DeviceEditorTranslations {
    const t = this._translations;
    return {
      weekdayShortLabels: {
        MONDAY: t.weekdays.short.monday,
        TUESDAY: t.weekdays.short.tuesday,
        WEDNESDAY: t.weekdays.short.wednesday,
        THURSDAY: t.weekdays.short.thursday,
        FRIDAY: t.weekdays.short.friday,
        SATURDAY: t.weekdays.short.saturday,
        SUNDAY: t.weekdays.short.sunday,
      } as Record<Weekday, string>,
      addEvent: t.ui.addEvent,
      editEvent: t.ui.editEvent,
      cancel: t.ui.cancel,
      save: t.ui.save,
      time: t.ui.time,
      condition: t.ui.condition,
      weekdaysLabel: t.ui.weekdays,
      stateLabel: t.ui.state,
      duration: t.ui.duration,
      rampTime: t.ui.rampTime,
      channels: t.ui.channels,
      levelOn: t.ui.levelOn,
      levelOff: t.ui.levelOff,
      slat: t.ui.slat,
      astroSunrise: t.ui.astroSunrise,
      astroSunset: t.ui.astroSunset,
      astroOffset: t.ui.astroOffset,
      confirmDelete: t.ui.confirmDelete,
      conditionLabels: t.conditions,
    };
  }

  private _renderEntitySelector() {
    if (!this._config?.entities || this._config.entities.length <= 1) {
      return html``;
    }

    const validEntities = this._config.entities.filter((entityId) =>
      this._isValidScheduleEntity(entityId),
    );

    if (validEntities.length === 0) {
      return html``;
    }

    return html`
      <ha-select
        class="entity-selector-dropdown"
        .value=${this._activeEntityId || ""}
        .options=${validEntities.map((entityId) => ({
          value: entityId,
          label: this._getEntityName(entityId),
        }))}
        @selected=${this._handleEntityChange}
        @closed=${(e: Event) => e.stopPropagation()}
      ></ha-select>
    `;
  }

  private _renderHeaderControls() {
    const hasMultipleEntities = this._config?.entities && this._config.entities.length > 1;

    return html`
      <div class="header-controls">
        ${hasMultipleEntities ? this._renderEntitySelector() : ""}
        <ha-icon-button
          .path=${"M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"}
          @click=${this._exportSchedule}
          .label=${this._translations.ui.exportTooltip}
          .disabled=${!this._scheduleData}
        ></ha-icon-button>
        ${this._isEditable
          ? html`<ha-icon-button
              .path=${"M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z"}
              @click=${this._importSchedule}
              .label=${this._translations.ui.importTooltip}
            ></ha-icon-button>`
          : ""}
      </div>
    `;
  }

  protected render() {
    if (!this._config || !this.hass) {
      return html``;
    }

    const entityState = this._activeEntityId ? this.hass.states?.[this._activeEntityId] : undefined;

    const cardTitle =
      this._config.name || entityState?.attributes?.friendly_name || this._translations.ui.schedule;

    if (!entityState) {
      return html`
        <ha-card>
          <div class="card-header">
            <div class="header-left">
              <div class="card-title">${cardTitle}</div>
            </div>
          </div>
          <div class="card-content">
            <div class="error">
              ${formatString(this._translations.ui.entityNotFound, {
                entity: this._activeEntityId || this._translations.ui.schedule,
              })}
            </div>
          </div>
        </ha-card>
      `;
    }

    if (!this._isValidScheduleEntity(this._activeEntityId!)) {
      return html`
        <ha-card>
          <div class="card-header">
            <div class="header-left">
              <div class="card-title">${cardTitle}</div>
            </div>
          </div>
          ${this._renderHeaderControls()}
          <div class="card-content">
            <div class="error">
              ${formatString(this._translations.errors.incompatibleEntity, {
                entity: this._activeEntityId!,
              })}
            </div>
          </div>
        </ha-card>
      `;
    }

    return html`
      <ha-card>
        <div class="card-header">
          <div class="header-left">
            <div class="card-title">${cardTitle}</div>
          </div>
        </div>
        ${this._renderHeaderControls()}
        <div class="card-content">
          ${this._scheduleData
            ? html`
                <hmip-device-schedule-list
                  .scheduleData=${this._scheduleData}
                  .domain=${this._domain}
                  .editable=${this._isEditable}
                  .translations=${this._buildListTranslations()}
                  @add-event=${this._onAddEvent}
                  @edit-event=${this._onEditEvent}
                  @delete-event=${this._onDeleteEvent}
                ></hmip-device-schedule-list>
              `
            : html`<div class="loading">${this._translations.ui.loading}</div>`}
          ${this._isEditable
            ? html`<div class="hint">${this._translations.ui.clickToEdit}</div>`
            : ""}
        </div>
        ${this._isLoading
          ? html`
              <div class="loading-overlay">
                <ha-circular-progress indeterminate></ha-circular-progress>
              </div>
            `
          : ""}
      </ha-card>
      <hmip-device-schedule-editor
        .open=${this._showEditor}
        .entry=${this._editingEntry}
        .groupNo=${this._editingGroupNo}
        .isNewEvent=${this._isNewEvent}
        .domain=${this._domain}
        .availableTargetChannels=${this._availableTargetChannels}
        .translations=${this._buildEditorTranslations()}
        @save-event=${this._onSaveEvent}
        @editor-closed=${this._onEditorClosed}
      ></hmip-device-schedule-editor>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      ha-card {
        padding: 16px;
        position: relative;
      }

      .card-header {
        display: block;
        margin-bottom: 8px;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .card-title {
        font-size: 24px;
        font-weight: 400;
        color: var(--primary-text-color);
      }

      .header-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 16px;
      }

      .entity-selector-dropdown {
        flex: 1;
        max-width: 300px;
      }

      ha-icon-button[disabled] {
        opacity: 0.3;
      }

      .card-content {
        position: relative;
      }

      .loading {
        padding: 20px;
        text-align: center;
        color: var(--secondary-text-color);
      }

      .hint {
        margin-top: 12px;
        text-align: center;
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .error {
        padding: 20px;
        text-align: center;
        color: var(--error-color, #e74c3c);
      }

      /* Loading Overlay */
      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        border-radius: 4px;
      }

      ha-circular-progress {
        color: var(--primary-color);
      }

      /* Mobile Optimization */
      @media (max-width: 768px) {
        ha-card {
          padding: 12px;
        }

        .card-header {
          margin-bottom: 12px;
        }

        .header-left {
          justify-content: center;
        }

        .card-title {
          font-size: 20px;
        }

        .header-controls {
          flex-wrap: wrap;
          justify-content: center;
        }

        .entity-selector-dropdown {
          max-width: none;
          flex: 1 1 100%;
        }
      }
    `;
  }

  public getCardSize(): number {
    return 4;
  }

  static getConfigElement() {
    return document.createElement("homematicip-local-schedule-card-editor");
  }

  static getStubConfig() {
    return {
      entity: "",
      editable: true,
      hour_format: "24",
    };
  }
}

// Extend window object for custom card registration
declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
    }>;
  }
}

// Register custom element with migration guard
const ELEMENT_NAME = "homematicip-local-schedule-card";
if (customElements.get(ELEMENT_NAME)) {
  console.warn(
    `%c HOMEMATICIP LOCAL %c The standalone HACS card "${ELEMENT_NAME}" is already loaded. ` +
      "This card is now included with the integration and the HACS version can be removed. " +
      "Go to HACS → Frontend → remove the schedule card resource.",
    "color: white; background: #e67e22; font-weight: 700;",
    "color: #e67e22; background: white; font-weight: 700;",
  );
} else {
  customElements.define(ELEMENT_NAME, HomematicScheduleCard);
}

// Register card in HA card picker
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === ELEMENT_NAME)) {
  window.customCards.push({
    type: ELEMENT_NAME,
    name: "HomematicIP Local Scheduler Card",
    description: "A custom card for Homematic(IP) Local schedules (switch, valve, cover, light)",
  });
}
