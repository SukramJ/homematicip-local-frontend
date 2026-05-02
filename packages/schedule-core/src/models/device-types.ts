/**
 * Device schedule type definitions.
 * Used by switch, light, cover, valve schedule editors.
 */

import type { Weekday } from "./common-types";

/**
 * Schedule domains (lowercase, matching Pydantic context).
 */
export type ScheduleDomain = "switch" | "light" | "cover" | "valve" | "lock";

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
 * Lock schedule entry mode.
 */
export type LockMode = "door_lock" | "user_permission";

/**
 * Lock schedule action (for door_lock mode).
 */
export type LockAction =
  | "lock_autorelock_end"
  | "lock_autorelock_start"
  | "unlock_autorelock_end"
  | "autorelock_end";

export const LOCK_ACTIONS: LockAction[] = [
  "lock_autorelock_end",
  "lock_autorelock_start",
  "unlock_autorelock_end",
  "autorelock_end",
];

/**
 * Lock permission value (for user_permission mode).
 */
export type LockPermission = "granted" | "not_granted";

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
  lock_mode: LockMode | null;
  lock_action: LockAction | null;
  permission: LockPermission | null;
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
 * Schedule field names as advertised by the device MASTER paramset.
 *
 * Mirrors `aiohomematic.const.ScheduleField`. The backend exposes the subset of
 * fields a given device actually supports via
 * `DeviceScheduleEntityAttributes.supported_schedule_fields`. Rendering must be
 * gated by `isScheduleFieldSupported()` so devices like HmIP-DLD (which omit
 * CONDITION, ASTRO_*, LEVEL_2, RAMP_TIME_*) don't expose non-functional inputs.
 */
export type ScheduleFieldName =
  | "ASTRO_OFFSET"
  | "ASTRO_TYPE"
  | "CONDITION"
  | "DURATION_BASE"
  | "DURATION_FACTOR"
  | "FIXED_HOUR"
  | "FIXED_MINUTE"
  | "LEVEL"
  | "LEVEL_2"
  | "RAMP_TIME_BASE"
  | "RAMP_TIME_FACTOR"
  | "TARGET_CHANNELS"
  | "WEEKDAY";

/**
 * Check whether a schedule field is supported by the current device.
 *
 * An empty/undefined `supported_schedule_fields` list means the backend didn't
 * advertise capabilities — fall back to permissive rendering so older backends
 * keep working. A non-empty list is treated as a strict allow-list.
 */
export function isScheduleFieldSupported(
  field: ScheduleFieldName,
  supportedFields: readonly string[] | undefined,
): boolean {
  if (!supportedFields || supportedFields.length === 0) {
    return true;
  }
  return supportedFields.includes(field);
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
    levelType: "binary",
    hasLevel2: false,
    hasDuration: true,
    hasRampTime: false,
  },
  lock: {
    levelType: "binary",
    hasLevel2: false,
    hasDuration: false,
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
  /**
   * Schedule fields actually supported by the device (subset of `ScheduleFieldName`).
   * If omitted/empty, the editor falls back to permissive rendering based on domain only.
   */
  supported_schedule_fields?: string[];
  friendly_name?: string;
  address?: string;
  interface_id?: string;
  config_entry_id?: string;
  model?: string;
}
