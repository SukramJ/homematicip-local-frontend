/**
 * Device schedule type definitions.
 * Used by switch, light, cover, valve schedule editors.
 */

import type { Weekday } from "./common-types";

/**
 * Schedule domains (lowercase, matching Pydantic context).
 */
export type ScheduleDomain = "switch" | "light" | "cover" | "valve";

/**
 * Condition types (from Pydantic model).
 */
export type ConditionType =
  | "fixed_time"
  | "astro"
  | "fixed_if_before_astro"
  | "astro_if_before_fixed"
  | "fixed_if_after_astro"
  | "astro_if_after_fixed"
  | "earliest"
  | "latest";

export const CONDITION_TYPES: ConditionType[] = [
  "fixed_time",
  "astro",
  "fixed_if_before_astro",
  "astro_if_before_fixed",
  "fixed_if_after_astro",
  "astro_if_after_fixed",
  "earliest",
  "latest",
];

/**
 * Astro event types.
 */
export type AstroType = "sunrise" | "sunset";

/**
 * SimpleScheduleEntry - central data type (Pydantic model).
 */
export interface SimpleScheduleEntry {
  weekdays: Weekday[];
  time: string;
  condition: ConditionType;
  astro_type: AstroType | null;
  astro_offset_minutes: number;
  target_channels: string[];
  level: number;
  level_2: number | null;
  duration: string | null;
  ramp_time: string | null;
}

/**
 * Schedule = Dict with string keys "1"-"24".
 */
export type SimpleSchedule = Record<string, SimpleScheduleEntry>;

/**
 * Schedule data wrapper as returned by entity attribute.
 */
export interface ScheduleData {
  entries: SimpleSchedule;
}

/**
 * UI extension for schedule entries.
 */
export interface SimpleScheduleEntryUI extends SimpleScheduleEntry {
  groupNo: string;
  isActive: boolean;
}

/**
 * Target channel metadata.
 */
export interface TargetChannelInfo {
  channel_no: number;
  channel_address: string;
  name: string;
  channel_type: string;
}

/**
 * Domain-specific field configuration.
 */
export interface DomainFieldConfig {
  levelType: "binary" | "percentage";
  hasLevel2: boolean;
  hasDuration: boolean;
  hasRampTime: boolean;
}

export const DOMAIN_FIELD_CONFIG: Record<ScheduleDomain, DomainFieldConfig> = {
  switch: {
    levelType: "binary",
    hasLevel2: false,
    hasDuration: true,
    hasRampTime: false,
  },
  light: {
    levelType: "percentage",
    hasLevel2: false,
    hasDuration: true,
    hasRampTime: true,
  },
  cover: {
    levelType: "percentage",
    hasLevel2: true,
    hasDuration: false,
    hasRampTime: false,
  },
  valve: {
    levelType: "percentage",
    hasLevel2: false,
    hasDuration: true,
    hasRampTime: false,
  },
};

/**
 * Duration units.
 */
export const DURATION_UNITS = ["ms", "s", "min", "h"] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

/**
 * Device schedule entity attributes.
 */
export interface DeviceScheduleEntityAttributes {
  schedule_data?: ScheduleData;
  schedule_api_version?: string;
  schedule_domain?: ScheduleDomain;
  max_entries?: number;
  available_target_channels?: Record<string, TargetChannelInfo>;
  schedule_type?: string;
  schedule_channel_address?: string;
  schedule_enabled?: Record<string, boolean>;
  friendly_name?: string;
  address?: string;
  interface_id?: string;
  config_entry_id?: string;
  model?: string;
}
