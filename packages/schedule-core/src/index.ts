/**
 * @hmip/schedule-core - Shared library for Homematic(IP) Local schedule components.
 *
 * Provides types, utilities, localization, and adapters shared between
 * the climate-schedule-card, schedule-card, and config-panel packages.
 */

// --- Models ---
export type { Weekday, HomeAssistant, HassEntity } from "./models/common-types";
export { WEEKDAYS } from "./models/common-types";

export type {
  ScheduleSlot,
  WeekdayData,
  BackendWeekdayData,
  ProfileData,
  SimpleSchedulePeriod,
  SimpleWeekdayData,
  SimpleProfileData,
  ClimateScheduleEntityAttributes,
  TimeBlock,
  ScheduleApiVersion,
} from "./models/climate-types";

export type {
  ScheduleDomain,
  ConditionType,
  AstroType,
  SimpleScheduleEntry,
  SimpleSchedule,
  ScheduleData,
  SimpleScheduleEntryUI,
  TargetChannelInfo,
  DomainFieldConfig,
  DurationUnit,
  DeviceScheduleEntityAttributes,
} from "./models/device-types";
export { CONDITION_TYPES, DOMAIN_FIELD_CONFIG, DURATION_UNITS } from "./models/device-types";

// --- Utils ---
export {
  timeToMinutes,
  minutesToTime,
  roundTimeToQuarter,
  formatTime,
  parseTime,
  isValidTime,
  formatTimeFromParts,
} from "./utils/time";

export { getTemperatureColor, getTemperatureGradient, formatTemperature } from "./utils/colors";

export { getDeviceAddress } from "./utils/device-address";

export { UndoRedoHistory } from "./utils/history";

export {
  parseWeekdaySchedule,
  parseSimpleWeekdaySchedule,
  timeBlocksToWeekdayData,
  timeBlocksToSimpleWeekdayData,
  convertToBackendFormat,
  calculateBaseTemperature,
  mergeConsecutiveBlocks,
  insertBlockWithSplitting,
  fillGapsWithBaseTemperature,
  sortBlocksChronologically,
  getScheduleApiVersion,
  getProfileFromPresetMode,
  getActiveProfileFromIndex,
} from "./utils/converters";

export type {
  ClimateValidationMessageKey,
  ClimateValidationMessage,
  DeviceValidationError,
} from "./utils/validation";
export {
  validateTimeBlocks,
  validateWeekdayData,
  validateSimpleWeekdayData,
  validateProfileData,
  validateSimpleProfileData,
  validateEntry,
} from "./utils/validation";

export {
  isEntryActive,
  scheduleToUIEntries,
  createEmptyEntry,
  isAstroCondition,
  parseDuration,
  buildDuration,
  formatDurationDisplay,
  isValidDuration,
  formatLevel,
  formatAstroTime,
  entryToBackend,
  scheduleToBackend,
  isValidScheduleEntity,
} from "./utils/device-helpers";

export { downloadJson, readJsonFile } from "./utils/import-export";

// --- Localization ---
export type { ScheduleTranslations, SupportedLanguage } from "./localization/types";
export { getTranslations, formatString, getDomainLabel } from "./localization/index";

// --- Adapters ---
export type { ClimateScheduleAdapter, DeviceScheduleAdapter } from "./adapters/types";
export {
  ServiceClimateScheduleAdapter,
  ServiceDeviceScheduleAdapter,
} from "./adapters/service-adapter";
export {
  WebSocketClimateScheduleAdapter,
  WebSocketDeviceScheduleAdapter,
} from "./adapters/websocket-adapter";
