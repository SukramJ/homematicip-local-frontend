/**
 * Validation utilities for climate and device schedules.
 */

import type { TimeBlock, WeekdayData, SimpleWeekdayData } from "../models/climate-types";
import type { SimpleScheduleEntry, ScheduleDomain } from "../models/device-types";
import { DOMAIN_FIELD_CONFIG } from "../models/device-types";
import { timeToMinutes, isValidTime } from "./time";
import { isValidDuration, isAstroCondition } from "./device-helpers";

// --- Climate Validation ---

export type ClimateValidationMessageKey =
  | "blockEndBeforeStart"
  | "blockZeroDuration"
  | "invalidStartTime"
  | "invalidEndTime"
  | "temperatureOutOfRange"
  | "invalidSlotCount"
  | "invalidSlotKey"
  | "missingSlot"
  | "slotMissingValues"
  | "slotTimeBackwards"
  | "slotTimeExceedsDay"
  | "lastSlotMustEnd"
  | "scheduleMustBeObject"
  | "missingWeekday"
  | "invalidWeekdayData"
  | "weekdayValidationError";

export interface ClimateValidationMessage {
  key: ClimateValidationMessageKey;
  params?: Record<string, string>;
  nested?: ClimateValidationMessage;
}

/**
 * Validate time blocks in the editor.
 */
export function validateTimeBlocks(
  blocks: TimeBlock[],
  minTemp: number = 5,
  maxTemp: number = 30.5,
): ClimateValidationMessage[] {
  const warnings: ClimateValidationMessage[] = [];

  if (blocks.length === 0) {
    return warnings;
  }

  for (let i = 0; i < blocks.length - 1; i++) {
    const currentBlock = blocks[i];

    if (currentBlock.endMinutes < currentBlock.startMinutes) {
      warnings.push({ key: "blockEndBeforeStart", params: { block: `${i + 1}` } });
    }

    if (currentBlock.endMinutes === currentBlock.startMinutes) {
      warnings.push({ key: "blockZeroDuration", params: { block: `${i + 1}` } });
    }
  }

  const lastBlock = blocks[blocks.length - 1];
  if (lastBlock.endMinutes < lastBlock.startMinutes) {
    warnings.push({ key: "blockEndBeforeStart", params: { block: `${blocks.length}` } });
  }

  blocks.forEach((block, index) => {
    if (block.startMinutes < 0 || block.startMinutes > 1440) {
      warnings.push({ key: "invalidStartTime", params: { block: `${index + 1}` } });
    }
    if (block.endMinutes < 0 || block.endMinutes > 1440) {
      warnings.push({ key: "invalidEndTime", params: { block: `${index + 1}` } });
    }
    if (block.temperature < minTemp || block.temperature > maxTemp) {
      warnings.push({
        key: "temperatureOutOfRange",
        params: { block: `${index + 1}`, min: `${minTemp}`, max: `${maxTemp}` },
      });
    }
  });

  return warnings;
}

/**
 * Validate weekday data structure.
 */
export function validateWeekdayData(weekdayData: WeekdayData): ClimateValidationMessage | null {
  const keys = Object.keys(weekdayData)
    .map((k) => parseInt(k))
    .filter((n) => !isNaN(n) && n >= 1 && n <= 13)
    .sort((a, b) => a - b);

  let previousEndMinutes = 0;

  for (const i of keys) {
    const slot = weekdayData[i.toString()];
    if (!slot) {
      continue;
    }

    if (!slot.ENDTIME || slot.TEMPERATURE === undefined) {
      return { key: "slotMissingValues", params: { slot: `${i}` } };
    }

    const endMinutes = timeToMinutes(slot.ENDTIME);

    if (endMinutes < previousEndMinutes) {
      return { key: "slotTimeBackwards", params: { slot: `${i}`, time: slot.ENDTIME } };
    }

    if (endMinutes > 1440) {
      return { key: "slotTimeExceedsDay", params: { slot: `${i}`, time: slot.ENDTIME } };
    }

    previousEndMinutes = endMinutes;
  }

  if (keys.length > 0) {
    const lastKey = keys[keys.length - 1].toString();
    const last = weekdayData[lastKey];
    if (last && last.ENDTIME !== "24:00") {
      return { key: "lastSlotMustEnd" };
    }
  }

  return null;
}

/**
 * Validate simple weekday data.
 */
export function validateSimpleWeekdayData(
  simpleData: SimpleWeekdayData,
  minTemp: number = 5,
  maxTemp: number = 30.5,
): ClimateValidationMessage | null {
  const { base_temperature: baseTemperature, periods } = simpleData;

  if (baseTemperature < minTemp || baseTemperature > maxTemp) {
    return {
      key: "temperatureOutOfRange",
      params: { block: "base", min: `${minTemp}`, max: `${maxTemp}` },
    };
  }

  let previousEndMinutes = 0;

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];

    if (!period.starttime || !period.endtime || period.temperature === undefined) {
      return { key: "slotMissingValues", params: { slot: `${i + 1}` } };
    }

    const startMinutes = timeToMinutes(period.starttime);
    const endMinutes = timeToMinutes(period.endtime);

    if (endMinutes <= startMinutes) {
      return { key: "blockEndBeforeStart", params: { block: `${i + 1}` } };
    }

    if (startMinutes < previousEndMinutes) {
      return { key: "slotTimeBackwards", params: { slot: `${i + 1}`, time: period.starttime } };
    }

    if (period.temperature < minTemp || period.temperature > maxTemp) {
      return {
        key: "temperatureOutOfRange",
        params: { block: `${i + 1}`, min: `${minTemp}`, max: `${maxTemp}` },
      };
    }

    previousEndMinutes = endMinutes;
  }

  return null;
}

/**
 * Validate imported ProfileData structure.
 */
export function validateProfileData(data: unknown): ClimateValidationMessage | null {
  if (!data || typeof data !== "object") {
    return { key: "scheduleMustBeObject" };
  }

  const profileData = data as Record<string, unknown>;
  const validWeekdays = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ];

  for (const weekday of validWeekdays) {
    if (!(weekday in profileData)) {
      return { key: "missingWeekday", params: { weekday } };
    }

    const weekdayData = profileData[weekday];
    if (!weekdayData || typeof weekdayData !== "object") {
      return { key: "invalidWeekdayData", params: { weekday } };
    }

    const error = validateWeekdayData(weekdayData as WeekdayData);
    if (error) {
      return { key: "weekdayValidationError", params: { weekday }, nested: error };
    }
  }

  return null;
}

/**
 * Validate simple profile data structure.
 */
export function validateSimpleProfileData(data: unknown): ClimateValidationMessage | null {
  if (!data || typeof data !== "object") {
    return { key: "scheduleMustBeObject" };
  }

  const profileData = data as Record<string, unknown>;
  const validWeekdays = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ];

  for (const weekday of validWeekdays) {
    if (!(weekday in profileData)) {
      return { key: "missingWeekday", params: { weekday } };
    }

    const weekdayData = profileData[weekday];
    if (!weekdayData || typeof weekdayData !== "object") {
      return { key: "invalidWeekdayData", params: { weekday } };
    }

    const data = weekdayData as Record<string, unknown>;
    if (!("base_temperature" in data) || !("periods" in data)) {
      return { key: "invalidWeekdayData", params: { weekday } };
    }

    const error = validateSimpleWeekdayData(weekdayData as SimpleWeekdayData);
    if (error) {
      return { key: "weekdayValidationError", params: { weekday }, nested: error };
    }
  }

  return null;
}

// --- Device Validation ---

export interface DeviceValidationError {
  field: string;
  message: string;
}

/**
 * Validate a device schedule entry.
 */
export function validateEntry(
  entry: SimpleScheduleEntry,
  domain?: ScheduleDomain,
): DeviceValidationError[] {
  const errors: DeviceValidationError[] = [];

  if (!isValidTime(entry.time)) {
    errors.push({ field: "time", message: "Time must be in HH:MM format (00:00-23:59)" });
  }

  if (!entry.weekdays || entry.weekdays.length === 0) {
    errors.push({ field: "weekdays", message: "At least one weekday must be selected" });
  }

  // Lock-specific validation
  if (domain === "lock") {
    if (!entry.lock_mode) {
      errors.push({ field: "lock_mode", message: "Lock mode must be selected" });
    } else if (entry.lock_mode === "door_lock") {
      if (!entry.lock_action) {
        errors.push({ field: "lock_action", message: "Lock action must be selected" });
      }
    } else if (entry.lock_mode === "user_permission") {
      if (!entry.permission) {
        errors.push({ field: "permission", message: "Permission must be selected" });
      }
    }
  } else {
    // Non-lock level validation
    const config = domain ? DOMAIN_FIELD_CONFIG[domain] : undefined;
    if (config?.levelType === "binary") {
      if (entry.level !== 0 && entry.level !== 1) {
        errors.push({ field: "level", message: "Level must be 0 or 1 for switch" });
      }
    } else {
      if (entry.level < 0 || entry.level > 1) {
        errors.push({ field: "level", message: "Level must be between 0.0 and 1.0" });
      }
    }
  }

  if (domain === "cover" && entry.level_2 !== null) {
    if (entry.level_2 < 0 || entry.level_2 > 1) {
      errors.push({ field: "level_2", message: "Slat position must be between 0.0 and 1.0" });
    }
  }

  if (isAstroCondition(entry.condition)) {
    if (entry.astro_offset_minutes < -128 || entry.astro_offset_minutes > 127) {
      errors.push({
        field: "astro_offset_minutes",
        message: "Astro offset must be between -128 and +127 minutes",
      });
    }
  }

  if (entry.duration !== null && !isValidDuration(entry.duration)) {
    errors.push({ field: "duration", message: "Invalid duration format" });
  }

  if (entry.ramp_time !== null && !isValidDuration(entry.ramp_time)) {
    errors.push({ field: "ramp_time", message: "Invalid ramp time format" });
  }

  return errors;
}
