import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  HomematicScheduleCardConfig,
  HomeAssistant,
  ScheduleEntityAttributes,
  WEEKDAYS,
  Weekday,
  SimpleProfileData,
  EntityConfigOrString,
  TimeBlock,
  ScheduleApiVersion,
} from "./types";
import "./editor";
import "@hmip/schedule-ui";
import {
  parseSimpleWeekdaySchedule,
  timeBlocksToSimpleWeekdayData,
  calculateBaseTemperature,
  validateSimpleWeekdayData,
  validateSimpleProfileData,
  getProfileFromPresetMode,
  getActiveProfileFromIndex,
  getScheduleApiVersion,
  getDeviceAddress,
} from "@hmip/schedule-core";
import type { ClimateValidationMessage as ValidationMessage } from "@hmip/schedule-core";
import type {
  GridTranslations,
  EditorTranslations,
  WeekdayClickDetail,
  CopyScheduleDetail,
  PasteScheduleDetail,
  SaveScheduleDetail,
  ValidationFailedDetail,
} from "@hmip/schedule-ui";
import { getTranslations, formatString, Translations } from "./localization";

@customElement("homematicip-local-climate-schedule-card")
export class HomematicScheduleCard extends LitElement {
  // Visual editor support
  static getConfigElement() {
    return document.createElement("homematicip-local-climate-schedule-card-editor");
  }

  static getStubConfig(hass: HomeAssistant) {
    const climateEntities = Object.keys(hass.states).filter(
      (eid) =>
        eid.startsWith("climate.") && hass.states[eid].attributes?.schedule_data !== undefined,
    );
    return {
      type: "custom:homematicip-local-climate-schedule-card",
      entities: climateEntities.length > 0 ? [climateEntities[0]] : [],
    };
  }

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: HomematicScheduleCardConfig;
  @state() private _currentProfile?: string;
  @state() private _activeDeviceProfile?: string;
  private _lastScheduleDataHash?: string;
  @state() private _scheduleData?: SimpleProfileData;
  @state() private _availableProfiles: string[] = [];
  private _userSelectedProfile: boolean = false;
  @state() private _activeEntityId?: string;
  @state() private _editingWeekday?: Weekday;
  @state() private _copiedSchedule?: {
    weekday: Weekday;
    blocks: TimeBlock[];
    baseTemperature?: number;
  };
  @state() private _isLoading: boolean = false;
  private _loadingTimeoutId?: number;
  @state() private _translations: Translations = getTranslations("en");
  private _weekdayShortLabelMap?: Record<Weekday, string>;
  private _weekdayLongLabelMap?: Record<Weekday, string>;
  @state() private _minTemp: number = 5.0;
  @state() private _maxTemp: number = 30.5;
  @state() private _tempStep: number = 0.5;

  public setConfig(config: HomematicScheduleCardConfig): void {
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
      config.entities.forEach((entityConfig) => {
        const entityId = typeof entityConfig === "string" ? entityConfig : entityConfig.entity;
        addEntity(entityId);
      });
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
      show_profile_selector: true,
      editable: true,
      show_temperature: true,
      temperature_unit: "\u00B0C",
      hour_format: "24",
      ...config,
      entity: fallbackEntity,
    };

    this._activeEntityId = nextActiveEntity;
    this._copiedSchedule = undefined;
    this._editingWeekday = undefined;

    this._updateLanguage();
  }

  private _getPreferredLanguage(hassInstance?: HomeAssistant): string | undefined {
    return hassInstance?.language || hassInstance?.locale?.language;
  }

  private _updateLanguage(): void {
    let language = "en";

    if (this._config?.language) {
      language = this._config.language;
    } else {
      const hassLanguage = this._getPreferredLanguage(this.hass);
      if (hassLanguage) {
        language = hassLanguage;
      }
    }

    this._translations = getTranslations(language);
    this._weekdayShortLabelMap = this._createWeekdayLabelMap("short");
    this._weekdayLongLabelMap = this._createWeekdayLabelMap("long");
  }

  private _createWeekdayLabelMap(format: "short" | "long"): Record<Weekday, string> {
    const labels =
      format === "short" ? this._translations.weekdays.short : this._translations.weekdays.long;
    return {
      MONDAY: labels.monday,
      TUESDAY: labels.tuesday,
      WEDNESDAY: labels.wednesday,
      THURSDAY: labels.thursday,
      FRIDAY: labels.friday,
      SATURDAY: labels.saturday,
      SUNDAY: labels.sunday,
    };
  }

  private _getWeekdayLabel(weekday: Weekday, format: "short" | "long" = "short"): string {
    if (format === "long") {
      if (!this._weekdayLongLabelMap) {
        this._weekdayLongLabelMap = this._createWeekdayLabelMap("long");
      }
      return this._weekdayLongLabelMap[weekday];
    }

    if (!this._weekdayShortLabelMap) {
      this._weekdayShortLabelMap = this._createWeekdayLabelMap("short");
    }
    return this._weekdayShortLabelMap[weekday];
  }

  private _getEntityId(entityConfig: EntityConfigOrString): string {
    return typeof entityConfig === "string" ? entityConfig : entityConfig.entity;
  }

  private _getEntityOptions(): string[] {
    if (!this._config) {
      return [];
    }
    if (this._config.entities?.length) {
      return this._config.entities
        .map((e) => this._getEntityId(e))
        .sort((a, b) => a.localeCompare(b));
    }
    return this._config.entity ? [this._config.entity] : [];
  }

  private _getEntityDisplayName(entityId: string): string {
    if (this._config?.entities?.length) {
      const entityConfig = this._config.entities.find((e) => this._getEntityId(e) === entityId);
      if (entityConfig && typeof entityConfig !== "string" && entityConfig.name) {
        return entityConfig.name;
      }
    }
    return (this.hass?.states?.[entityId]?.attributes.friendly_name as string) || entityId;
  }

  private _getProfileDisplayName(profileId: string): string {
    const activeEntityId = this._getActiveEntityId();
    if (activeEntityId && this._config?.entities?.length) {
      const entityConfig = this._config.entities.find(
        (e) => this._getEntityId(e) === activeEntityId,
      );
      if (
        entityConfig &&
        typeof entityConfig !== "string" &&
        entityConfig.profile_names?.[profileId]
      ) {
        return `${profileId} - ${entityConfig.profile_names[profileId]}`;
      }
    }
    return profileId;
  }

  private _getActiveEntityId(): string | undefined {
    const entities = this._getEntityOptions();
    if (entities.length === 0) {
      return undefined;
    }
    if (this._activeEntityId && entities.includes(this._activeEntityId)) {
      return this._activeEntityId;
    }
    return entities[0];
  }

  private _getProfileFromPresetMode(presetMode?: string): string | undefined {
    return getProfileFromPresetMode(presetMode);
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

  private _getScheduleApiVersion(entityId: string): ScheduleApiVersion {
    const entity = this.hass?.states[entityId];
    return getScheduleApiVersion(entity?.attributes?.schedule_api_version as string | undefined);
  }

  private _getDeviceAddress(entityId: string): string | undefined {
    const entity = this.hass?.states[entityId];
    return getDeviceAddress(entity?.attributes?.address as string | undefined);
  }

  private _requireDeviceAddress(entityId: string): string {
    const deviceAddress = this._getDeviceAddress(entityId);
    if (!deviceAddress) {
      throw new Error(
        `Cannot resolve device_address for entity ${entityId}. ` +
          `Ensure the entity has a valid address attribute (format: "device_address:channel").`,
      );
    }
    return deviceAddress;
  }

  private async _callSetActiveProfile(entityId: string, profile: string): Promise<void> {
    const apiVersion = this._getScheduleApiVersion(entityId);
    if (apiVersion === "v2") {
      const deviceAddress = this._requireDeviceAddress(entityId);
      const entity = this.hass.states[entityId];
      const configEntryId = entity?.attributes?.config_entry_id as string | undefined;
      if (!configEntryId) {
        throw new Error(
          `Cannot resolve config_entry_id for entity ${entityId}. ` +
            `Ensure the entity has a valid config_entry_id attribute.`,
        );
      }
      await this.hass.callWS({
        type: "homematicip_local/config/set_climate_active_profile",
        entry_id: configEntryId,
        device_address: deviceAddress,
        profile,
      });
    } else {
      await this.hass.callService("homematicip_local", "set_schedule_active_profile", {
        entity_id: entityId,
        profile: profile,
      });
    }
  }

  private async _callSetScheduleWeekday(
    entityId: string,
    profile: string,
    weekday: string,
    baseTemperature: number,
    periods: { starttime: string; endtime: string; temperature: number }[],
  ): Promise<void> {
    const apiVersion = this._getScheduleApiVersion(entityId);
    if (apiVersion === "v2") {
      const deviceAddress = this._requireDeviceAddress(entityId);
      await this.hass.callService("homematicip_local", "set_schedule_weekday", {
        device_address: deviceAddress,
        profile: profile,
        weekday: weekday,
        base_temperature: baseTemperature,
        simple_weekday_list: periods,
      });
    } else {
      await this.hass.callService("homematicip_local", "set_schedule_simple_weekday", {
        entity_id: entityId,
        profile: profile,
        weekday: weekday,
        base_temperature: baseTemperature,
        simple_weekday_list: periods,
      });
    }
  }

  private _scheduleReloadDeviceConfig(entityId: string): void {
    if (!this.hass) return;
    const deviceAddress = this._getDeviceAddress(entityId);
    if (!deviceAddress) {
      console.warn("Cannot reload device config: address attribute missing or invalid format");
      return;
    }

    setTimeout(async () => {
      try {
        await this.hass.callService("homematicip_local", "reload_device_config", {
          device_address: deviceAddress,
        });
        console.info("Reloaded device config for BidCos-RF device:", deviceAddress);
      } catch (err) {
        console.error("Failed to reload device config:", err);
      }
    }, 5000);
  }

  private _formatValidationParams(params?: Record<string, string>): Record<string, string> {
    if (!params) {
      return {};
    }
    const formatted: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (key === "weekday" && (WEEKDAYS as readonly Weekday[]).includes(value as Weekday)) {
        formatted.weekday = this._getWeekdayLabel(value as Weekday, "long");
      } else {
        formatted[key] = value;
      }
    }
    return formatted;
  }

  private _translateValidationMessage(message: ValidationMessage): string {
    const template = this._translations.validationMessages[message.key] || message.key;
    const params = this._formatValidationParams(message.params);

    if (message.nested) {
      params.details = this._translateValidationMessage(message.nested);
    }

    return formatString(template, params);
  }

  public getCardSize(): number {
    return 12;
  }

  protected willUpdate(changedProps: PropertyValues): void {
    super.willUpdate(changedProps);

    if (changedProps.has("hass") && this._config) {
      this._updateFromEntity();

      const oldHass = changedProps.get("hass") as HomeAssistant | undefined;
      const newLanguage = this._getPreferredLanguage(this.hass);
      const oldLanguage = this._getPreferredLanguage(oldHass);

      if (newLanguage !== oldLanguage) {
        this._updateLanguage();
      }
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._loadingTimeoutId !== undefined) {
      clearTimeout(this._loadingTimeoutId);
      this._loadingTimeoutId = undefined;
    }
  }

  private _updateFromEntity(): void {
    if (!this.hass || !this._config) return;

    const entityId = this._getActiveEntityId();
    if (!entityId) {
      this._currentProfile = undefined;
      this._activeDeviceProfile = undefined;
      this._scheduleData = undefined;
      this._availableProfiles = [];
      return;
    }

    const entityState = this.hass.states?.[entityId];
    if (!entityState) {
      this._currentProfile = undefined;
      this._activeDeviceProfile = undefined;
      this._scheduleData = undefined;
      this._availableProfiles = [];
      return;
    }

    const attrs = entityState.attributes as unknown as ScheduleEntityAttributes;

    if (entityId.startsWith("sensor.") && attrs.schedule_type !== "climate") {
      this._currentProfile = undefined;
      this._activeDeviceProfile = undefined;
      this._scheduleData = undefined;
      this._availableProfiles = [];
      return;
    }

    if (!attrs.schedule_data) {
      this._currentProfile = undefined;
      this._activeDeviceProfile = undefined;
      this._scheduleData = undefined;
      this._availableProfiles = [];
      return;
    }

    const apiVersion = this._getScheduleApiVersion(entityId);
    const deviceProfile =
      apiVersion === "v2"
        ? getActiveProfileFromIndex(attrs.device_active_profile_index)
        : this._getProfileFromPresetMode(attrs.preset_mode);

    const deviceProfileChanged =
      deviceProfile !== undefined &&
      this._activeDeviceProfile !== undefined &&
      deviceProfile !== this._activeDeviceProfile;

    if (deviceProfileChanged) {
      this._userSelectedProfile = false;
      this._reloadScheduleData(entityId, deviceProfile);
    }

    this._activeDeviceProfile = deviceProfile;

    const activeProfile =
      apiVersion === "v2" ? attrs.current_schedule_profile : attrs.active_profile;
    if (!this._userSelectedProfile) {
      this._currentProfile = this._config.profile || deviceProfile || activeProfile;
    }
    this._scheduleData = attrs.schedule_data;
    this._availableProfiles = (attrs.available_profiles || [])
      .slice()
      .sort((a, b) => a.localeCompare(b));

    this._minTemp = attrs.min_temp ?? 5.0;
    this._maxTemp = attrs.max_temp ?? 30.5;
    this._tempStep = attrs.target_temp_step ?? 0.5;

    this._lastScheduleDataHash = attrs.schedule_data
      ? JSON.stringify(attrs.schedule_data)
      : undefined;
  }

  private _reloadScheduleData(entityId: string, profile: string): void {
    if (!this.hass) return;
    this._callSetActiveProfile(entityId, profile).catch(() => {
      // Silently ignore errors
    });
  }

  private async _handleProfileChange(e: Event): Promise<void> {
    const select = e.target as HTMLSelectElement;
    const newProfile = select.value;

    const entityId = this._getActiveEntityId();
    if (!this._config || !this.hass || !entityId) return;

    this._userSelectedProfile = true;

    try {
      await this._callSetActiveProfile(entityId, newProfile);
      this._currentProfile = newProfile;
    } catch (err) {
      console.error("Failed to load profile data:", err);
      alert(formatString(this._translations.errors.failedToChangeProfile, { error: String(err) }));
    }
  }

  // Grid event handlers
  private _onWeekdayClick(e: CustomEvent<WeekdayClickDetail>): void {
    if (!this._config?.editable) return;
    if (!this._scheduleData) return;
    this._editingWeekday = e.detail.weekday;
  }

  private _onCopySchedule(e: CustomEvent<CopyScheduleDetail>): void {
    const weekday = e.detail.weekday;
    if (!this._scheduleData) return;

    const blocks = this._getParsedBlocks(weekday);

    let baseTemperature: number | undefined;
    const weekdayData = this._scheduleData[weekday];
    if (weekdayData) {
      baseTemperature = parseSimpleWeekdaySchedule(weekdayData).baseTemperature;
    } else {
      baseTemperature = calculateBaseTemperature(blocks);
    }

    this._copiedSchedule = {
      weekday,
      blocks: JSON.parse(JSON.stringify(blocks)),
      baseTemperature,
    };

    console.info(`Copied schedule from ${weekday}`);
  }

  private async _onPasteSchedule(e: CustomEvent<PasteScheduleDetail>): Promise<void> {
    const weekday = e.detail.weekday;
    if (!this._config || !this.hass || !this._currentProfile || !this._copiedSchedule) {
      return;
    }

    const entityId = this._getActiveEntityId();
    if (!entityId) return;

    const baseTemperature =
      this._copiedSchedule.baseTemperature ?? calculateBaseTemperature(this._copiedSchedule.blocks);

    const simpleWeekdayData = timeBlocksToSimpleWeekdayData(
      this._copiedSchedule.blocks,
      baseTemperature,
    );

    const validationError = validateSimpleWeekdayData(
      simpleWeekdayData,
      this._minTemp,
      this._maxTemp,
    );
    if (validationError) {
      const localizedError = this._translateValidationMessage(validationError);
      alert(formatString(this._translations.errors.invalidSchedule, { error: localizedError }));
      return;
    }

    this._isLoading = true;
    this._loadingTimeoutId = window.setTimeout(() => {
      this._isLoading = false;
      this._loadingTimeoutId = undefined;
    }, 10000);

    try {
      const { base_temperature: baseTemp, periods } = simpleWeekdayData;
      await this._callSetScheduleWeekday(
        entityId,
        this._currentProfile,
        weekday,
        baseTemp,
        periods,
      );

      if (this._scheduleData) {
        this._scheduleData = {
          ...this._scheduleData,
          [weekday]: simpleWeekdayData,
        };
      }

      this._updateFromEntity();
      this.requestUpdate();

      console.info(`Pasted schedule to ${weekday}`);

      if (this._needsManualReload(entityId)) {
        this._scheduleReloadDeviceConfig(entityId);
      }
    } catch (err) {
      console.error("Failed to paste schedule:", err);
      alert(formatString(this._translations.errors.failedToPasteSchedule, { error: String(err) }));
    } finally {
      if (this._loadingTimeoutId !== undefined) {
        clearTimeout(this._loadingTimeoutId);
        this._loadingTimeoutId = undefined;
      }
      this._isLoading = false;
    }
  }

  // Editor event handlers
  private async _onSaveSchedule(e: CustomEvent<SaveScheduleDetail>): Promise<void> {
    if (!this._config || !this.hass || !this._currentProfile) return;

    const entityId = this._getActiveEntityId();
    if (!entityId) return;

    const { weekday, blocks, baseTemperature } = e.detail;

    const simpleWeekdayData = timeBlocksToSimpleWeekdayData(blocks, baseTemperature);

    const validationError = validateSimpleWeekdayData(
      simpleWeekdayData,
      this._minTemp,
      this._maxTemp,
    );
    if (validationError) {
      const localizedError = this._translateValidationMessage(validationError);
      alert(formatString(this._translations.errors.invalidSchedule, { error: localizedError }));
      return;
    }

    this._isLoading = true;
    this._loadingTimeoutId = window.setTimeout(() => {
      this._isLoading = false;
      this._loadingTimeoutId = undefined;
    }, 10000);

    try {
      const { base_temperature: baseTemp, periods } = simpleWeekdayData;
      await this._callSetScheduleWeekday(
        entityId,
        this._currentProfile,
        weekday,
        baseTemp,
        periods,
      );

      if (this._scheduleData) {
        this._scheduleData = {
          ...this._scheduleData,
          [weekday]: simpleWeekdayData,
        };
      }

      this._updateFromEntity();
      this.requestUpdate();

      this._editingWeekday = undefined;

      if (this._needsManualReload(entityId)) {
        this._scheduleReloadDeviceConfig(entityId);
      }
    } catch (err) {
      console.error("Failed to save schedule:", err);
      alert(formatString(this._translations.errors.failedToSaveSchedule, { error: String(err) }));
    } finally {
      if (this._loadingTimeoutId !== undefined) {
        clearTimeout(this._loadingTimeoutId);
        this._loadingTimeoutId = undefined;
      }
      this._isLoading = false;
    }
  }

  private _onValidationFailed(e: CustomEvent<ValidationFailedDetail>): void {
    alert(formatString(this._translations.errors.invalidSchedule, { error: e.detail.error }));
  }

  private _onEditorClosed(): void {
    this._editingWeekday = undefined;
  }

  private _getParsedBlocks(weekday: Weekday): TimeBlock[] {
    if (this._scheduleData) {
      const weekdayData = this._scheduleData[weekday];
      if (!weekdayData) return [];
      const { blocks } = parseSimpleWeekdaySchedule(weekdayData);
      return blocks;
    }
    return [];
  }

  private _exportSchedule(): void {
    if (!this._currentProfile) return;
    if (!this._scheduleData) return;

    try {
      const exportData = {
        version: "2.0",
        profile: this._currentProfile,
        exported: new Date().toISOString(),
        scheduleData: this._scheduleData,
        format: "simple",
      };

      const jsonString = JSON.stringify(exportData, null, 2);

      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `schedule-${this._currentProfile}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.info("Schedule exported successfully");
    } catch (err) {
      console.error("Failed to export schedule:", err);
      alert(formatString(this._translations.errors.failedToExport, { error: String(err) }));
    }
  }

  private _importSchedule(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";

    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (!file.name.endsWith(".json") && file.type !== "application/json") {
        alert(this._translations.errors.invalidImportFile);
        return;
      }

      try {
        const text = await file.text();
        let importData: unknown;

        try {
          importData = JSON.parse(text);
        } catch {
          alert(this._translations.errors.invalidImportFormat);
          return;
        }

        if (!importData || typeof importData !== "object") {
          alert(this._translations.errors.invalidImportFormat);
          return;
        }

        const data = importData as Record<string, unknown>;

        let scheduleData: unknown;
        if ("scheduleData" in data) {
          scheduleData = data.scheduleData;
        } else {
          scheduleData = importData;
        }

        const validationError = validateSimpleProfileData(scheduleData);

        if (validationError) {
          const localizedError = this._translateValidationMessage(validationError);
          alert(
            formatString(this._translations.errors.invalidImportData, { error: localizedError }),
          );
          return;
        }

        const entityId = this._getActiveEntityId();
        if (!this._config || !this.hass || !this._currentProfile || !entityId) return;

        this._isLoading = true;
        this._loadingTimeoutId = window.setTimeout(() => {
          this._isLoading = false;
          this._loadingTimeoutId = undefined;
        }, 10000);

        try {
          const importedSchedule = scheduleData as SimpleProfileData;
          for (const weekday of WEEKDAYS) {
            const simpleWeekdayData = importedSchedule[weekday];
            if (simpleWeekdayData) {
              const { base_temperature: baseTemperature, periods } = simpleWeekdayData;
              await this._callSetScheduleWeekday(
                entityId,
                this._currentProfile,
                weekday,
                baseTemperature,
                periods,
              );
            }
          }

          this._scheduleData = importedSchedule;

          this._updateFromEntity();
          this.requestUpdate();

          console.info("Schedule imported successfully");
          alert(this._translations.ui.importSuccess);

          if (this._needsManualReload(entityId)) {
            this._scheduleReloadDeviceConfig(entityId);
          }
        } catch (err) {
          console.error("Failed to import schedule:", err);
          alert(formatString(this._translations.errors.failedToImport, { error: String(err) }));
        } finally {
          if (this._loadingTimeoutId !== undefined) {
            clearTimeout(this._loadingTimeoutId);
            this._loadingTimeoutId = undefined;
          }
          this._isLoading = false;
        }
      } catch (err) {
        console.error("Failed to read import file:", err);
        alert(formatString(this._translations.errors.failedToImport, { error: String(err) }));
      }
    };

    input.click();
  }

  private _buildGridTranslations(): GridTranslations {
    if (!this._weekdayShortLabelMap) {
      this._weekdayShortLabelMap = this._createWeekdayLabelMap("short");
    }
    return {
      weekdayShortLabels: this._weekdayShortLabelMap,
      clickToEdit: this._translations.ui.clickToEdit,
      copySchedule: this._translations.ui.copySchedule,
      pasteSchedule: this._translations.ui.pasteSchedule,
    };
  }

  private _buildEditorTranslations(): EditorTranslations {
    if (!this._weekdayShortLabelMap) {
      this._weekdayShortLabelMap = this._createWeekdayLabelMap("short");
    }
    if (!this._weekdayLongLabelMap) {
      this._weekdayLongLabelMap = this._createWeekdayLabelMap("long");
    }
    return {
      weekdayShortLabels: this._weekdayShortLabelMap,
      weekdayLongLabels: this._weekdayLongLabelMap,
      edit: this._translations.ui.edit,
      cancel: this._translations.ui.cancel,
      save: this._translations.ui.save,
      addTimeBlock: this._translations.ui.addTimeBlock,
      from: this._translations.ui.from,
      to: this._translations.ui.to,
      baseTemperature: this._translations.ui.baseTemperature,
      baseTemperatureDescription: this._translations.ui.baseTemperatureDescription,
      temperaturePeriods: this._translations.ui.temperaturePeriods,
      editSlot: this._translations.ui.editSlot,
      saveSlot: this._translations.ui.saveSlot,
      cancelSlotEdit: this._translations.ui.cancelSlotEdit,
      undoShortcut: this._translations.ui.undoShortcut,
      redoShortcut: this._translations.ui.redoShortcut,
      warningsTitle: this._translations.warnings.title,
      validationMessages: this._translations.validationMessages,
    };
  }

  private _renderEntitySelector(entityIds: string[], activeEntityId?: string) {
    const selected =
      activeEntityId && entityIds.includes(activeEntityId) ? activeEntityId : entityIds[0];
    return html`
      <select
        class="profile-selector entity-selector"
        @change=${this._handleEntitySelection}
        .value=${selected}
      >
        ${[...entityIds]
          .sort((a, b) => a.localeCompare(b))
          .map((entityId) => {
            const label = this._getEntityDisplayName(entityId);
            return html`<option value=${entityId}>${label}</option>`;
          })}
      </select>
    `;
  }

  private _handleEntitySelection(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const entityId = select.value;
    if (!entityId || entityId === this._getActiveEntityId()) {
      return;
    }

    this._activeEntityId = entityId;
    this._editingWeekday = undefined;
    this._copiedSchedule = undefined;
    this._userSelectedProfile = false;
    this._updateFromEntity();
  }

  protected render() {
    if (!this._config || !this.hass) {
      return html``;
    }

    const entityOptions = this._getEntityOptions();
    const multipleEntities = entityOptions.length > 1;
    const activeEntityId = this._getActiveEntityId();
    const entityState = activeEntityId ? this.hass.states?.[activeEntityId] : undefined;

    const headerTitle =
      this._config.name ||
      (activeEntityId ? this._getEntityDisplayName(activeEntityId) : null) ||
      this._translations.ui.schedule;

    if (!entityState) {
      return html`
        <ha-card>
          <div class="card-header">
            <div class="name">${headerTitle}</div>
          </div>
          <div class="card-content">
            <div class="error">
              ${formatString(this._translations.ui.entityNotFound, {
                entity: activeEntityId || this._translations.ui.schedule,
              })}
            </div>
          </div>
        </ha-card>
      `;
    }

    if (activeEntityId?.startsWith("sensor.")) {
      const sensorAttrs = entityState.attributes as unknown as ScheduleEntityAttributes;
      if (sensorAttrs.schedule_type !== "climate") {
        return html`
          <ha-card>
            <div class="card-header">
              <div class="name">${headerTitle}</div>
            </div>
            <div class="card-content">
              <div class="error">
                ${formatString(this._translations.ui.sensorNotSupported, {
                  entity: activeEntityId,
                })}
              </div>
            </div>
          </ha-card>
        `;
      }
    }

    const currentAttrs = entityState.attributes as unknown as ScheduleEntityAttributes;
    if (!currentAttrs.schedule_data) {
      return html`
        <ha-card>
          <div class="card-header">
            <div class="name">${headerTitle}</div>
          </div>
          <div class="card-content">
            <div class="error">
              ${formatString(this._translations.ui.noScheduleData, {
                entity: activeEntityId || "",
              })}
            </div>
          </div>
        </ha-card>
      `;
    }

    return html`
      <ha-card>
        <div class="card-header">
          <div class="name">${headerTitle}</div>
        </div>
        <div class="header-controls">
          ${multipleEntities ? this._renderEntitySelector(entityOptions, activeEntityId) : ""}
          ${this._config.show_profile_selector && this._availableProfiles.length > 0
            ? html`
                <select
                  class="profile-selector"
                  @change=${this._handleProfileChange}
                  .value=${this._currentProfile || ""}
                >
                  ${this._availableProfiles.map(
                    (profile) => html`
                      <option
                        value=${profile}
                        ?selected=${profile === this._currentProfile}
                        class=${profile === this._activeDeviceProfile
                          ? "active-profile-option"
                          : ""}
                      >
                        ${profile === this._activeDeviceProfile
                          ? "* "
                          : ""}${this._getProfileDisplayName(profile)}
                      </option>
                    `,
                  )}
                </select>
              `
            : ""}
          ${activeEntityId
            ? html`<span class="api-version-badge"
                >${this._getScheduleApiVersion(activeEntityId)}</span
              >`
            : ""}
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

        <div class="card-content">
          ${this._scheduleData
            ? html`
                <hmip-schedule-grid
                  .scheduleData=${this._scheduleData}
                  .editable=${this._config.editable ?? true}
                  .showTemperature=${this._config.show_temperature ?? true}
                  .showGradient=${this._config.show_gradient ?? false}
                  .temperatureUnit=${this._config.temperature_unit || "\u00B0C"}
                  .hourFormat=${this._config.hour_format || "24"}
                  .translations=${this._buildGridTranslations()}
                  .copiedWeekday=${this._copiedSchedule?.weekday}
                  .editorOpen=${!!this._editingWeekday}
                  .currentProfile=${this._currentProfile}
                  .scheduleDataHash=${this._lastScheduleDataHash}
                  @weekday-click=${this._onWeekdayClick}
                  @copy-schedule=${this._onCopySchedule}
                  @paste-schedule=${this._onPasteSchedule}
                ></hmip-schedule-grid>
              `
            : html`<div class="loading">${this._translations.ui.loading}</div>`}
        </div>

        ${this._isLoading
          ? html`
              <div class="loading-overlay">
                <div class="loading-spinner"></div>
              </div>
            `
          : ""}
      </ha-card>

      <hmip-schedule-editor
        .open=${!!this._editingWeekday}
        .weekday=${this._editingWeekday}
        .scheduleData=${this._scheduleData}
        .minTemp=${this._minTemp}
        .maxTemp=${this._maxTemp}
        .tempStep=${this._tempStep}
        .temperatureUnit=${this._config.temperature_unit || "\u00B0C"}
        .hourFormat=${this._config.hour_format || "24"}
        .translations=${this._buildEditorTranslations()}
        @save-schedule=${this._onSaveSchedule}
        @validation-failed=${this._onValidationFailed}
        @editor-closed=${this._onEditorClosed}
      ></hmip-schedule-editor>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      ha-card {
        padding: 16px;
        overflow: hidden;
      }

      .card-header {
        display: block;
        margin-bottom: 8px;
      }

      .name {
        font-size: 24px;
        font-weight: 400;
        color: var(--primary-text-color);
        margin-bottom: 8px;
      }

      .header-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 24px;
        flex-wrap: wrap;
        max-width: 100%;
      }

      .profile-selector {
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background-color: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
        cursor: pointer;
        flex-shrink: 0;
        max-width: 200px;
      }

      .profile-selector .active-profile-option {
        color: var(--success-color, #4caf50);
        font-weight: 500;
      }

      .entity-selector {
        flex: 1 1 auto;
        min-width: 150px;
        max-width: 100%;
        font-size: 16px;
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
        flex-shrink: 0;
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

      .api-version-badge {
        font-size: 10px;
        color: var(--secondary-text-color);
        opacity: 0.6;
        flex-shrink: 0;
        user-select: none;
      }

      .card-content {
        position: relative;
        overflow: hidden;
      }

      .loading,
      .error {
        padding: 20px;
        text-align: center;
        color: var(--secondary-text-color);
      }

      .error {
        color: var(--error-color);
      }

      /* Loading overlay */
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

      /* Mobile Optimization */
      @media (max-width: 768px) {
        ha-card {
          padding: 12px;
        }

        .card-header {
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
          margin-bottom: 12px;
        }

        .name {
          font-size: 20px;
          text-align: center;
        }

        .header-controls {
          justify-content: center;
          flex-wrap: wrap;
        }

        .profile-selector,
        .export-btn,
        .import-btn {
          min-height: 44px;
          padding: 10px 16px;
          font-size: 16px;
        }
      }

      /* Small mobile devices (portrait phones) */
      @media (max-width: 480px) {
        ha-card {
          padding: 8px;
        }

        .name {
          font-size: 18px;
        }
      }

      /* Touch-specific optimizations */
      @media (hover: none) and (pointer: coarse) {
        .export-btn:hover,
        .import-btn:hover {
          opacity: 1;
          background-color: transparent;
        }

        .export-btn:active:not(:disabled),
        .import-btn:active {
          background-color: var(--divider-color);
        }
      }
    `;
  }
}

// Declare the custom element for Home Assistant
declare global {
  interface HTMLElementTagNameMap {
    "homematicip-local-climate-schedule-card": HomematicScheduleCard;
  }
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
    }>;
  }
}

// Register the card with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: "homematicip-local-climate-schedule-card",
  name: "Homematic(IP) Local Climate Schedule Card",
  description: "Display and edit Homematic thermostat schedules",
  preview: true,
});

console.info(
  "%c HOMEMATICIP-LOCAL-CLIMATE-SCHEDULE-CARD %c v0.10.0 ",
  "color: white; background: #3498db; font-weight: 700;",
  "color: #3498db; background: white; font-weight: 700;",
);
