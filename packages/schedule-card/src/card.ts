import "./editor";
import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import {
  ScheduleCardConfig,
  HomeAssistant,
  ScheduleEntityAttributes,
  SimpleSchedule,
  SimpleScheduleEntryUI,
  SimpleScheduleEntry,
  ScheduleDomain,
  ConditionType,
  AstroType,
  WEEKDAYS,
  Weekday,
  CONDITION_TYPES,
  DOMAIN_FIELD_CONFIG,
  DURATION_UNITS,
  DurationUnit,
  TargetChannelInfo,
} from "./types";
import {
  scheduleToUIEntries,
  formatLevel,
  formatDurationDisplay,
  createEmptyEntry,
  validateEntry,
  getDeviceAddress,
  isAstroCondition,
  isValidScheduleEntity,
  parseDuration,
  buildDuration,
  scheduleToBackend,
} from "@hmip/schedule-core";
import { getTranslations, formatString, Translations } from "./localization";

@customElement("homematicip-local-schedule-card")
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
  @state() private _availableTargetChannels?: Record<string, TargetChannelInfo>;
  @state() private _maxEntries?: number;

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

    // Set language from config or detect from Home Assistant
    this._updateLanguage();
  }

  private _updateLanguage(): void {
    let language = "en"; // Default to English

    // Priority 1: Explicit language setting in card config
    if (this._config?.language) {
      language = this._config.language;
    }
    // Priority 2: Home Assistant language
    else if (this.hass?.language) {
      language = this.hass.language;
    }
    // Priority 3: Home Assistant locale
    else if (this.hass?.locale?.language) {
      language = this.hass.locale.language;
    }

    this._translations = getTranslations(language);
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has("hass")) {
      const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
      if (this.hass && oldHass) {
        // Check if language changed
        if (
          this.hass.language !== oldHass.language ||
          this.hass.locale?.language !== oldHass.locale?.language
        ) {
          this._updateLanguage();
        }

        // Check if entity state changed
        if (this._activeEntityId) {
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

    // Validate entity compatibility
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

    // Domain from config override or entity attribute
    if (this._config?.schedule_domain) {
      this._domain = this._config.schedule_domain;
    } else if (attributes.schedule_domain) {
      this._domain = attributes.schedule_domain;
    }
  }

  private _getEntityName(entityId: string): string {
    const entity = this.hass?.states?.[entityId];
    return (entity?.attributes?.friendly_name as string) || entityId;
  }

  private _handleEntityChange(e: Event): void {
    const select = e.target as HTMLSelectElement;
    this._activeEntityId = select.value;
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

  private _handleAddEvent(): void {
    // Check max_entries limit
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

    // Pre-select first available target channel if available
    if (this._availableTargetChannels) {
      const firstChannelKey = Object.keys(this._availableTargetChannels)[0];
      if (firstChannelKey) {
        newEntry.target_channels = [firstChannelKey];
      }
    }

    // Find next available group number
    const existingGroupNos = this._scheduleData
      ? Object.keys(this._scheduleData).map((k) => parseInt(k, 10))
      : [];
    const maxGroupNo = existingGroupNos.length > 0 ? Math.max(...existingGroupNos) : 0;
    this._editingGroupNo = String(maxGroupNo + 1);
    this._editingEntry = { ...newEntry };
    this._showEditor = true;
  }

  private _handleEditEvent(entry: SimpleScheduleEntryUI): void {
    this._editingGroupNo = entry.groupNo;
    this._editingEntry = { ...entry };
    this._showEditor = true;
  }

  private _handleDeleteEvent(entry: SimpleScheduleEntryUI): void {
    if (!confirm(this._translations.ui.confirmDelete || "Delete this event?")) {
      return;
    }

    const updatedSchedule = { ...this._scheduleData };
    delete updatedSchedule[entry.groupNo];
    this._saveSchedule(updatedSchedule);
  }

  private _closeEditor(): void {
    this._showEditor = false;
    this._editingEntry = undefined;
    this._editingGroupNo = undefined;
  }

  private _handleSaveEvent(): void {
    if (!this._editingEntry || this._editingGroupNo === undefined) {
      return;
    }

    const errors = validateEntry(this._editingEntry, this._domain);
    if (errors.length > 0) {
      alert(`Validation errors:\n${errors.map((e) => `- ${e.field}: ${e.message}`).join("\n")}`);
      return;
    }

    const updatedSchedule = {
      ...this._scheduleData,
      [this._editingGroupNo]: this._editingEntry,
    };

    this._saveSchedule(updatedSchedule);
    this._closeEditor();
  }

  private async _saveSchedule(scheduleData: SimpleSchedule): Promise<void> {
    if (!this._activeEntityId || !this.hass) {
      return;
    }

    const entityId = this._activeEntityId;
    this._startLoading();

    try {
      const deviceAddress = this._requireDeviceAddress(entityId);

      await this.hass.callService("homematicip_local", "set_schedule", {
        device_address: deviceAddress,
        schedule_data: { entries: scheduleToBackend(scheduleData) },
      });

      // Update local state optimistically
      this._scheduleData = scheduleData;

      // For BidCos-RF/Wired devices, schedule reload after delay
      if (this._needsManualReload(entityId)) {
        this._scheduleReloadDeviceConfig(entityId);
      }
    } catch (error) {
      alert(
        formatString(this._translations.errors.failedToSaveSchedule, {
          error: String(error),
        }),
      );
    } finally {
      this._stopLoading();
    }
  }

  private _startLoading(): void {
    this._isLoading = true;
    // Safety timeout to prevent infinite loading state
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
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate imported data
        if (!data.schedule || typeof data.schedule !== "object") {
          throw new Error(this._translations.errors.invalidImportData);
        }

        // Check if domain matches (optional warning)
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

  /**
   * Check if the device needs manual reload after schedule changes.
   * BidCos-RF, BidCos-Wired, and VirtualDevices don't support CONFIG_PENDING
   * and need manual reload to apply schedule changes.
   */
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

  /**
   * Schedule a device config reload after 5 seconds delay.
   * This is needed for BidCos-RF devices where CONFIG_PENDING doesn't work reliably.
   */
  private _scheduleReloadDeviceConfig(entityId: string): void {
    if (!this.hass) return;
    const deviceAddress = this._getDeviceAddress(entityId);
    if (!deviceAddress) {
      console.warn("Cannot reload device config: address attribute missing");
      return;
    }

    // Schedule reload after 5 seconds delay
    setTimeout(async () => {
      try {
        await this.hass.callService("homematicip_local", "reload_device_config", {
          device_address: deviceAddress,
        });
        console.info("Reloaded device config for BidCos device:", deviceAddress);
      } catch (err) {
        console.error("Failed to reload device config:", err);
      }
    }, 5000);
  }

  private _updateEditingEntry(updates: Partial<SimpleScheduleEntry>): void {
    if (!this._editingEntry) return;
    this._editingEntry = { ...this._editingEntry, ...updates };
    this.requestUpdate();
  }

  private _groupEntriesByWeekday(): Map<Weekday, SimpleScheduleEntryUI[]> {
    const grouped = new Map<Weekday, SimpleScheduleEntryUI[]>();

    if (!this._scheduleData) {
      return grouped;
    }

    const uiEntries = scheduleToUIEntries(this._scheduleData);

    for (const entry of uiEntries) {
      const weekdays = Array.isArray(entry.weekdays) ? entry.weekdays : [];
      for (const weekday of weekdays) {
        if (!grouped.has(weekday)) {
          grouped.set(weekday, []);
        }
        grouped.get(weekday)!.push(entry);
      }
    }

    return grouped;
  }

  private _renderEntitySelector() {
    if (!this._config?.entities || this._config.entities.length <= 1) {
      return html``;
    }

    // Only show entities that are valid schedule entities
    const validEntities = this._config.entities.filter((entityId) =>
      this._isValidScheduleEntity(entityId),
    );

    if (validEntities.length === 0) {
      return html``;
    }

    return html`
      <select
        class="entity-selector-dropdown"
        @change=${this._handleEntityChange}
        .value=${this._activeEntityId || ""}
      >
        ${validEntities.map(
          (entityId) => html`
            <option value=${entityId} ?selected=${entityId === this._activeEntityId}>
              ${this._getEntityName(entityId)}
            </option>
          `,
        )}
      </select>
    `;
  }

  private _renderHeaderControls() {
    const hasMultipleEntities = this._config?.entities && this._config.entities.length > 1;

    return html`
      <div class="header-controls">
        ${hasMultipleEntities ? this._renderEntitySelector() : ""}
        <button
          class="export-btn"
          @click=${this._exportSchedule}
          title="${this._translations.ui.exportTooltip}"
          ?disabled=${!this._scheduleData}
        >
          ⬇️
        </button>
        <button
          class="import-btn"
          @click=${this._importSchedule}
          title="${this._translations.ui.importTooltip}"
        >
          ⬆️
        </button>
      </div>
    `;
  }

  private _renderScheduleList() {
    if (!this._scheduleData) {
      return html`<div class="no-data">${this._translations.ui.loading}</div>`;
    }

    const groupedEntries = this._groupEntriesByWeekday();

    if (groupedEntries.size === 0) {
      return html`
        <div class="no-data">
          <p>No schedule events configured</p>
          ${this._config?.editable
            ? html`<button @click=${this._handleAddEvent} class="add-button">
                ${this._translations.ui.addEvent || "Add Event"}
              </button>`
            : ""}
        </div>
      `;
    }

    return html`
      <div class="schedule-list">
        ${this._config?.editable
          ? html`<div class="toolbar">
              <button @click=${this._handleAddEvent} class="add-button">
                ${this._translations.ui.addEvent || "Add Event"}
              </button>
            </div>`
          : ""}
        ${WEEKDAYS.map((weekday) => {
          const entries = groupedEntries.get(weekday) || [];
          if (entries.length === 0) return html``;

          return html`
            <div class="weekday-section">
              <div class="weekday-header">
                ${this._translations.weekdays.long[
                  weekday.toLowerCase() as keyof typeof this._translations.weekdays.long
                ]}
              </div>
              <div class="events-table">
                <div class="events-header">
                  <div class="col-time">${this._translations.ui.time || "Time"}</div>
                  <div class="col-duration">${this._translations.ui.duration || "Duration"}</div>
                  <div class="col-level">${this._translations.ui.state || "State"}</div>
                  ${this._config?.editable ? html`<div class="col-actions"></div>` : ""}
                </div>
                ${repeat(
                  entries,
                  (entry) => entry.groupNo,
                  (entry) => this._renderEvent(entry),
                )}
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderEvent(entry: SimpleScheduleEntryUI) {
    const levelText = formatLevel(entry.level, this._domain);
    const durationText = formatDurationDisplay(entry.duration);

    return html`
      <div class="event-row ${entry.isActive ? "active" : "inactive"}">
        <div class="col-time">${entry.time}</div>
        <div class="col-duration">${durationText}</div>
        <div class="col-level">
          ${levelText}
          ${entry.level_2 !== null
            ? html`<span class="level-2"
                >, ${this._translations.ui.slat}: ${Math.round(entry.level_2 * 100)}%</span
              >`
            : ""}
        </div>
        ${this._config?.editable
          ? html`<div class="col-actions">
              <button @click=${() => this._handleEditEvent(entry)} class="icon-button" title="Edit">
                ✏️
              </button>
              <button
                @click=${() => this._handleDeleteEvent(entry)}
                class="icon-button"
                title="Delete"
              >
                🗑️
              </button>
            </div>`
          : ""}
      </div>
    `;
  }

  private _renderEditor() {
    if (!this._showEditor || !this._editingEntry) {
      return html``;
    }

    const isNewEvent = !this._scheduleData?.[this._editingGroupNo || ""];

    return html`
      <div class="editor-overlay" @click=${this._closeEditor}>
        <div class="editor-dialog" @click=${(e: Event) => e.stopPropagation()}>
          <div class="editor-header">
            <h3>
              ${isNewEvent ? this._translations.ui.addEvent : this._translations.ui.editEvent}
            </h3>
            <button @click=${this._closeEditor} class="close-button">✕</button>
          </div>
          <div class="editor-content">
            ${this._renderTimeFields()} ${this._renderConditionFields()}
            ${this._renderWeekdayFields()} ${this._renderLevelFields()}
            ${this._renderDurationFields()} ${this._renderRampTimeFields()}
            ${this._renderChannelFields()}
          </div>
          <div class="editor-footer">
            <button @click=${this._closeEditor} class="button-secondary">
              ${this._translations.ui.cancel || "Cancel"}
            </button>
            <button @click=${this._handleSaveEvent} class="button-primary">
              ${this._translations.ui.save || "Save"}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderTimeFields() {
    if (!this._editingEntry) return html``;

    return html`
      <div class="form-group">
        <label>${this._translations.ui.time || "Time"}</label>
        <input
          type="time"
          .value=${this._editingEntry.time}
          @change=${(e: Event) => {
            const target = e.target as HTMLInputElement;
            this._updateEditingEntry({ time: target.value });
          }}
        />
      </div>
    `;
  }

  private _renderConditionFields() {
    if (!this._editingEntry) return html``;

    const showAstroFields = isAstroCondition(this._editingEntry.condition);

    return html`
      <div class="form-group">
        <label>${this._translations.ui.condition || "Condition"}</label>
        <select
          .value=${this._editingEntry.condition}
          @change=${(e: Event) => {
            const value = (e.target as HTMLSelectElement).value as ConditionType;
            const updates: Partial<SimpleScheduleEntry> = { condition: value };
            if (value === "fixed_time") {
              updates.astro_type = null;
              updates.astro_offset_minutes = 0;
            } else if (this._editingEntry!.astro_type === null) {
              updates.astro_type = "sunrise";
            }
            this._updateEditingEntry(updates);
          }}
        >
          ${CONDITION_TYPES.map(
            (ct) => html`
              <option value=${ct} ?selected=${ct === this._editingEntry!.condition}>
                ${this._translations.conditions[ct] || ct}
              </option>
            `,
          )}
        </select>
      </div>
      ${showAstroFields
        ? html`
            <div class="form-group">
              <label
                >${this._translations.ui.astroSunrise}/${this._translations.ui.astroSunset}</label
              >
              <select
                .value=${this._editingEntry.astro_type || "sunrise"}
                @change=${(e: Event) => {
                  const value = (e.target as HTMLSelectElement).value as AstroType;
                  this._updateEditingEntry({ astro_type: value });
                }}
              >
                <option value="sunrise" ?selected=${this._editingEntry.astro_type === "sunrise"}>
                  ${this._translations.ui.astroSunrise}
                </option>
                <option value="sunset" ?selected=${this._editingEntry.astro_type === "sunset"}>
                  ${this._translations.ui.astroSunset}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>${this._translations.ui.astroOffset}</label>
              <input
                type="number"
                min="-720"
                max="720"
                .value=${String(this._editingEntry.astro_offset_minutes)}
                @input=${(e: Event) => {
                  const value = parseInt((e.target as HTMLInputElement).value, 10);
                  if (!isNaN(value)) {
                    this._updateEditingEntry({ astro_offset_minutes: value });
                  }
                }}
              />
            </div>
          `
        : ""}
    `;
  }

  private _renderWeekdayFields() {
    if (!this._editingEntry) return html``;

    return html`
      <div class="form-group">
        <label>${this._translations.ui.weekdays || "Weekdays"}</label>
        <div class="weekday-checkboxes">
          ${WEEKDAYS.map((weekday) => {
            const isChecked = this._editingEntry!.weekdays.includes(weekday);
            return html`
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  .checked=${isChecked}
                  @change=${(e: Event) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    const currentWeekdays = [...this._editingEntry!.weekdays];
                    if (checked && !currentWeekdays.includes(weekday)) {
                      currentWeekdays.push(weekday);
                    } else if (!checked) {
                      const index = currentWeekdays.indexOf(weekday);
                      if (index > -1) currentWeekdays.splice(index, 1);
                    }
                    this._updateEditingEntry({ weekdays: currentWeekdays });
                  }}
                />
                ${this._translations.weekdays.short[
                  weekday.toLowerCase() as keyof typeof this._translations.weekdays.short
                ]}
              </label>
            `;
          })}
        </div>
      </div>
    `;
  }

  private _renderLevelFields() {
    if (!this._editingEntry) return html``;

    const config = this._domain ? DOMAIN_FIELD_CONFIG[this._domain] : undefined;
    const isBinary = config?.levelType === "binary";

    return html`
      <div class="form-group">
        <label>${this._translations.ui.state || "State"}</label>
        ${isBinary
          ? html`
              <select
                .value=${String(this._editingEntry.level)}
                @change=${(e: Event) => {
                  const value = parseInt((e.target as HTMLSelectElement).value, 10);
                  this._updateEditingEntry({ level: value });
                }}
              >
                <option value="0">${this._translations.ui.levelOff}</option>
                <option value="1">${this._translations.ui.levelOn}</option>
              </select>
            `
          : html`
              <input
                type="range"
                min="0"
                max="100"
                .value=${String(Math.round(this._editingEntry.level * 100))}
                @input=${(e: Event) => {
                  const value = parseInt((e.target as HTMLInputElement).value, 10) / 100;
                  this._updateEditingEntry({ level: value });
                }}
              />
              <span>${Math.round(this._editingEntry.level * 100)}%</span>
            `}
      </div>
      ${config?.hasLevel2
        ? html`
            <div class="form-group">
              <label>${this._translations.ui.slat || "Slat Position"}</label>
              <input
                type="range"
                min="0"
                max="100"
                .value=${String(Math.round((this._editingEntry.level_2 || 0) * 100))}
                @input=${(e: Event) => {
                  const value = parseInt((e.target as HTMLInputElement).value, 10) / 100;
                  this._updateEditingEntry({ level_2: value });
                }}
              />
              <span>${Math.round((this._editingEntry.level_2 || 0) * 100)}%</span>
            </div>
          `
        : ""}
    `;
  }

  private _renderDurationFields() {
    if (!this._editingEntry) return html``;
    const config = this._domain ? DOMAIN_FIELD_CONFIG[this._domain] : undefined;
    if (config && !config.hasDuration) return html``;

    const parsed = this._editingEntry.duration ? parseDuration(this._editingEntry.duration) : null;
    const durationValue = parsed?.value ?? 0;
    const durationUnit: DurationUnit = parsed?.unit ?? "s";

    return html`
      <div class="form-group">
        <label>${this._translations.ui.duration || "Duration"}</label>
        <div class="duration-row">
          <input
            type="number"
            min="0"
            .value=${String(durationValue)}
            @input=${(e: Event) => {
              const value = parseFloat((e.target as HTMLInputElement).value);
              if (!isNaN(value) && value > 0) {
                this._updateEditingEntry({ duration: buildDuration(value, durationUnit) });
              } else {
                this._updateEditingEntry({ duration: null });
              }
            }}
          />
          <select
            .value=${durationUnit}
            @change=${(e: Event) => {
              const unit = (e.target as HTMLSelectElement).value as DurationUnit;
              if (durationValue > 0) {
                this._updateEditingEntry({ duration: buildDuration(durationValue, unit) });
              }
            }}
          >
            ${DURATION_UNITS.map(
              (u) => html` <option value=${u} ?selected=${u === durationUnit}>${u}</option> `,
            )}
          </select>
        </div>
      </div>
    `;
  }

  private _renderRampTimeFields() {
    if (!this._editingEntry) return html``;
    const config = this._domain ? DOMAIN_FIELD_CONFIG[this._domain] : undefined;
    if (config && !config.hasRampTime) return html``;

    const parsed = this._editingEntry.ramp_time
      ? parseDuration(this._editingEntry.ramp_time)
      : null;
    const rampValue = parsed?.value ?? 0;
    const rampUnit: DurationUnit = parsed?.unit ?? "s";

    return html`
      <div class="form-group">
        <label>${this._translations.ui.rampTime || "Ramp Time"}</label>
        <div class="duration-row">
          <input
            type="number"
            min="0"
            .value=${String(rampValue)}
            @input=${(e: Event) => {
              const value = parseFloat((e.target as HTMLInputElement).value);
              if (!isNaN(value) && value > 0) {
                this._updateEditingEntry({ ramp_time: buildDuration(value, rampUnit) });
              } else {
                this._updateEditingEntry({ ramp_time: null });
              }
            }}
          />
          <select
            .value=${rampUnit}
            @change=${(e: Event) => {
              const unit = (e.target as HTMLSelectElement).value as DurationUnit;
              if (rampValue > 0) {
                this._updateEditingEntry({ ramp_time: buildDuration(rampValue, unit) });
              }
            }}
          >
            ${DURATION_UNITS.map(
              (u) => html` <option value=${u} ?selected=${u === rampUnit}>${u}</option> `,
            )}
          </select>
        </div>
      </div>
    `;
  }

  private _renderChannelFields() {
    if (!this._editingEntry) return html``;

    // If available_target_channels metadata is present, render checkboxes
    if (this._availableTargetChannels && Object.keys(this._availableTargetChannels).length > 0) {
      return html`
        <div class="form-group">
          <label>${this._translations.ui.channels || "Target Channels"}</label>
          <div class="channel-checkboxes">
            ${Object.entries(this._availableTargetChannels).map(([key, info]) => {
              const isChecked = this._editingEntry!.target_channels.includes(key);
              return html`
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    .checked=${isChecked}
                    @change=${(e: Event) => {
                      const checked = (e.target as HTMLInputElement).checked;
                      const channels = [...this._editingEntry!.target_channels];
                      if (checked && !channels.includes(key)) {
                        channels.push(key);
                      } else if (!checked) {
                        const index = channels.indexOf(key);
                        if (index > -1) channels.splice(index, 1);
                      }
                      this._updateEditingEntry({ target_channels: channels });
                    }}
                  />
                  ${info.name || key}
                </label>
              `;
            })}
          </div>
        </div>
      `;
    }

    // Fallback: text input
    return html`
      <div class="form-group">
        <label>${this._translations.ui.channels || "Target Channels"}</label>
        <input
          type="text"
          .value=${this._editingEntry.target_channels.join(", ")}
          @input=${(e: Event) => {
            const value = (e.target as HTMLInputElement).value;
            const channels = value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            this._updateEditingEntry({ target_channels: channels });
          }}
          placeholder="1_1, 2_1"
        />
      </div>
    `;
  }

  protected render() {
    if (!this._config || !this.hass) {
      return html``;
    }

    const entityState = this._activeEntityId ? this.hass.states?.[this._activeEntityId] : undefined;

    // Header shows: configured name > friendly_name > default
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

    // Check if entity is a compatible schedule entity
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
            ? this._renderScheduleList()
            : html`<div class="loading">${this._translations.ui.loading}</div>`}
          ${this._config?.editable
            ? html`<div class="hint">${this._translations.ui.clickToEdit}</div>`
            : ""}
        </div>
        ${this._isLoading
          ? html`
              <div class="loading-overlay">
                <div class="loading-spinner"></div>
              </div>
            `
          : ""}
      </ha-card>
      ${this._renderEditor()}
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
        padding: 8px 12px;
        font-size: 14px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background-color: var(--card-background-color);
        color: var(--primary-text-color);
        cursor: pointer;
      }

      .export-btn,
      .import-btn {
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background-color: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 18px;
        cursor: pointer;
        transition: background-color 0.2s;
        line-height: 1;
      }

      .export-btn:hover,
      .import-btn:hover {
        background-color: var(--divider-color);
      }

      .export-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .export-btn:disabled:hover {
        background-color: var(--card-background-color);
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

      .no-data {
        text-align: center;
        padding: 32px;
        color: var(--secondary-text-color);
      }

      .toolbar {
        margin-bottom: 16px;
        display: flex;
        justify-content: flex-end;
      }

      .add-button {
        padding: 10px 16px;
        background-color: var(--primary-color);
        color: var(--text-primary-color);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: opacity 0.2s;
      }

      .add-button:hover {
        opacity: 0.9;
      }

      .schedule-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .weekday-section {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        overflow: hidden;
      }

      .weekday-header {
        background-color: var(--primary-color);
        color: var(--text-primary-color);
        padding: 8px 16px;
        font-weight: 500;
      }

      .events-table {
        display: flex;
        flex-direction: column;
      }

      .events-header {
        display: grid;
        grid-template-columns: 80px 100px 1fr 80px;
        gap: 12px;
        padding: 8px 16px;
        background-color: var(--secondary-background-color);
        font-weight: 500;
        font-size: 13px;
        color: var(--secondary-text-color);
        text-transform: uppercase;
      }

      .events-header.no-actions {
        grid-template-columns: 80px 100px 1fr;
      }

      .event-row {
        display: grid;
        grid-template-columns: 80px 100px 1fr 80px;
        gap: 12px;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--divider-color);
        transition: background-color 0.2s;
      }

      .event-row.no-actions {
        grid-template-columns: 80px 100px 1fr;
      }

      .event-row:last-child {
        border-bottom: none;
      }

      .event-row.inactive {
        opacity: 0.5;
      }

      .event-row:hover {
        background-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.05);
      }

      .col-time {
        font-weight: 500;
        font-family: monospace;
        color: var(--primary-text-color);
      }

      .col-duration {
        color: var(--secondary-text-color);
      }

      .col-level {
        color: var(--primary-text-color);
      }

      .col-level .level-2 {
        color: var(--secondary-text-color);
        font-size: 0.9em;
      }

      .col-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .icon-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        font-size: 16px;
        opacity: 0.7;
        transition: opacity 0.2s;
      }

      .icon-button:hover {
        opacity: 1;
      }

      /* Editor Overlay */
      .editor-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .editor-dialog {
        background-color: var(--card-background-color);
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow: auto;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }

      .editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid var(--divider-color);
      }

      .editor-header h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 500;
        color: var(--primary-text-color);
      }

      .close-button {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--secondary-text-color);
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition:
          background-color 0.2s,
          color 0.2s;
      }

      .close-button:hover {
        background-color: var(--divider-color);
        color: var(--primary-text-color);
      }

      .editor-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .form-group label {
        font-weight: 500;
        font-size: 14px;
        color: var(--primary-text-color);
      }

      .form-group input[type="time"],
      .form-group input[type="text"],
      .form-group input[type="number"],
      .form-group select {
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background-color: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
      }

      .form-group input[type="range"] {
        width: 100%;
      }

      .duration-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .duration-row input[type="number"] {
        flex: 1;
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background-color: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
      }

      .duration-row select {
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background-color: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
      }

      .weekday-checkboxes,
      .channel-checkboxes {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        font-size: 14px;
      }

      .checkbox-label input[type="checkbox"] {
        cursor: pointer;
      }

      .editor-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px;
        border-top: 1px solid var(--divider-color);
      }

      .button-primary,
      .button-secondary {
        padding: 10px 24px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: opacity 0.2s;
      }

      .button-primary {
        background-color: var(--primary-color);
        color: var(--text-primary-color);
      }

      .button-primary:hover {
        opacity: 0.9;
      }

      .button-secondary {
        background-color: var(--divider-color);
        color: var(--primary-text-color);
        border: none;
      }

      .button-secondary:hover {
        opacity: 0.9;
      }

      .button-danger {
        background-color: var(--error-color, #e74c3c);
        color: white;
        border: none;
      }

      .button-danger:hover {
        opacity: 0.9;
      }

      /* Validation Warnings */
      .validation-warnings {
        background-color: rgba(255, 152, 0, 0.1);
        border: 1px solid rgba(255, 152, 0, 0.3);
        border-radius: 4px;
        padding: 12px;
        margin: 12px 0;
      }

      .warnings-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-weight: 500;
        color: var(--primary-text-color);
      }

      .warning-icon {
        font-size: 18px;
      }

      .warnings-title {
        font-size: 14px;
      }

      .warnings-list {
        margin: 0;
        padding-left: 28px;
        list-style-type: disc;
      }

      .warning-item {
        color: var(--secondary-text-color);
        font-size: 13px;
        line-height: 1.6;
        margin: 4px 0;
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

      .loading-spinner {
        width: 50px;
        height: 50px;
        border: 5px solid rgba(255, 255, 255, 0.3);
        border-top-color: var(--primary-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .error {
        padding: 20px;
        text-align: center;
        color: var(--error-color, #e74c3c);
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
          min-height: 44px;
          padding: 10px 16px;
          font-size: 16px;
          max-width: none;
          flex: 1 1 100%;
        }

        .export-btn,
        .import-btn {
          min-height: 44px;
          padding: 10px 16px;
          font-size: 16px;
        }

        .add-button {
          min-height: 44px;
          padding: 10px 16px;
          font-size: 16px;
          width: 100%;
        }

        .events-header {
          grid-template-columns: 60px 80px 1fr 60px;
          gap: 8px;
          padding: 8px 12px;
          font-size: 11px;
        }

        .event-row {
          grid-template-columns: 60px 80px 1fr 60px;
          gap: 8px;
          padding: 10px 12px;
        }

        .button-primary,
        .button-secondary {
          min-height: 44px;
          padding: 10px 16px;
        }
      }

      @media (max-width: 480px) {
        .events-header {
          grid-template-columns: 50px 60px 1fr 50px;
          gap: 6px;
          padding: 6px 8px;
          font-size: 10px;
        }

        .event-row {
          grid-template-columns: 50px 60px 1fr 50px;
          gap: 6px;
          padding: 8px;
        }

        .col-time {
          font-size: 12px;
        }

        .col-duration,
        .col-level {
          font-size: 12px;
        }
      }

      /* Touch device optimizations */
      @media (hover: none) and (pointer: coarse) {
        .icon-button {
          padding: 8px;
          font-size: 20px;
        }

        .event-row:hover {
          background-color: transparent;
        }

        .event-row:active {
          background-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.1);
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

// Register custom card
window.customCards = window.customCards || [];
window.customCards.push({
  type: "homematicip-local-schedule-card",
  name: "HomematicIP Local Scheduler Card",
  description: "A custom card for Homematic(IP) Local schedules (switch, valve, cover, light)",
});
