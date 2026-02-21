/**
 * Card-specific types for the climate schedule card.
 * Shared types are re-exported from @hmip/schedule-core.
 */

// Re-export shared types from schedule-core
export type { Weekday, HomeAssistant, HassEntity } from "@hmip/schedule-core";
export { WEEKDAYS } from "@hmip/schedule-core";

export type {
  ScheduleSlot,
  WeekdayData,
  BackendWeekdayData,
  ProfileData,
  SimpleSchedulePeriod,
  SimpleWeekdayData,
  SimpleProfileData,
  ClimateScheduleEntityAttributes as ScheduleEntityAttributes,
  TimeBlock,
  ScheduleApiVersion,
} from "@hmip/schedule-core";

// Card-specific types

export interface EntityConfig {
  entity: string;
  name?: string;
  profile_names?: Record<string, string>;
}

export type EntityConfigOrString = string | EntityConfig;

export interface HomematicScheduleCardConfig {
  type: string;
  entity?: string;
  entities?: EntityConfigOrString[];
  name?: string;
  profile?: string;
  show_profile_selector?: boolean;
  editable?: boolean;
  show_temperature?: boolean;
  temperature_unit?: string;
  hour_format?: "12" | "24";
  language?: "en" | "de";
  show_gradient?: boolean;
}

export const WEEKDAY_LABELS: Record<import("@hmip/schedule-core").Weekday, string> = {
  MONDAY: "Mo",
  TUESDAY: "Tu",
  WEDNESDAY: "We",
  THURSDAY: "Th",
  FRIDAY: "Fr",
  SATURDAY: "Sa",
  SUNDAY: "Su",
};

export const WEEKDAY_LABELS_DE: Record<import("@hmip/schedule-core").Weekday, string> = {
  MONDAY: "Mo",
  TUESDAY: "Di",
  WEDNESDAY: "Mi",
  THURSDAY: "Do",
  FRIDAY: "Fr",
  SATURDAY: "Sa",
  SUNDAY: "So",
};
