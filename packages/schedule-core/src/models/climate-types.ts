/**
 * Climate schedule type definitions.
 * Used by thermostat/climate device schedule editors.
 */

/**
 * Schedule slot with end time and temperature (internal format).
 */
export interface ScheduleSlot {
  ENDTIME: string;
  TEMPERATURE: number;
}

/**
 * WeekdayData stores schedule slots for a single day (frontend representation).
 * Keys are numeric strings ('1' through '13') representing slot numbers.
 */
export interface WeekdayData {
  [slot: string]: ScheduleSlot;
}

/**
 * Backend representation of WeekdayData with integer keys.
 */
export type BackendWeekdayData = Record<number, ScheduleSlot>;

export interface ProfileData {
  [weekday: string]: WeekdayData;
}

/**
 * Simple schedule period with start time, end time, and temperature.
 * Uses lowercase keys for JSON serialization (v2.0.0+ format).
 */
export interface SimpleSchedulePeriod {
  starttime: string;
  endtime: string;
  temperature: number;
}

/**
 * Simple weekday data: base_temperature and periods array.
 * Simplified format from aiohomematic (v2.0.0+).
 */
export interface SimpleWeekdayData {
  base_temperature: number;
  periods: SimpleSchedulePeriod[];
}

/**
 * Simple profile data mapping weekdays to simple weekday data.
 */
export interface SimpleProfileData {
  [weekday: string]: SimpleWeekdayData;
}

/**
 * Climate schedule entity attributes.
 */
export interface ClimateScheduleEntityAttributes {
  active_profile: string;
  available_profiles: string[];
  preset_mode?: string;
  schedule_data?: SimpleProfileData;
  schedule_type?: string;
  schedule_api_version?: string;
  current_schedule_profile?: string;
  device_active_profile_index?: number;
  friendly_name?: string;
  min_temp?: number;
  max_temp?: number;
  target_temp_step?: number;
  interface_id?: string;
  address?: string;
}

/**
 * Time block representation for the schedule grid editor.
 */
export interface TimeBlock {
  startTime: string;
  startMinutes: number;
  endTime: string;
  endMinutes: number;
  temperature: number;
  slot: number;
}

export type ScheduleApiVersion = "v1" | "v2";
