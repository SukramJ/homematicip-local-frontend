/**
 * Card-specific types for the schedule card.
 * Shared types are re-exported from @hmip/schedule-core.
 */

// Re-export shared types from schedule-core
export type { Weekday, HomeAssistant, HassEntity } from "@hmip/schedule-core";
export { WEEKDAYS } from "@hmip/schedule-core";

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
  DeviceScheduleEntityAttributes as ScheduleEntityAttributes,
} from "@hmip/schedule-core";
export { CONDITION_TYPES, DOMAIN_FIELD_CONFIG, DURATION_UNITS } from "@hmip/schedule-core";

// Card-specific types

export interface HomematicScheduleCardConfig {
  type: string;
  entity?: string;
  entities?: string[];
  name?: string;
  editable?: boolean;
  show_import_export?: boolean;
  collapse_after?: number;
  hour_format?: "12" | "24";
  language?: "en" | "de";
  schedule_domain?: import("@hmip/schedule-core").ScheduleDomain;
}

// Alias for backwards compatibility
export type ScheduleCardConfig = HomematicScheduleCardConfig;
