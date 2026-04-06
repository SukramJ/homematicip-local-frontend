/**
 * Device schedule helper utilities.
 */

import { DOMAIN_FIELD_CONFIG } from "../models/device-types";
import type {
  SimpleScheduleEntry,
  SimpleSchedule,
  SimpleScheduleEntryUI,
  ScheduleDomain,
  ConditionType,
  AstroType,
  DurationUnit,
  DeviceScheduleEntityAttributes,
} from "../models/device-types";

/**
 * Check if a schedule entry is active (has weekdays and target channels).
 */
export function isEntryActive(entry: SimpleScheduleEntry): boolean {
  return Boolean(
    Array.isArray(entry.weekdays) &&
    entry.weekdays.length > 0 &&
    Array.isArray(entry.target_channels) &&
    entry.target_channels.length > 0,
  );
}

/**
 * Convert SimpleSchedule to sorted list of UI entries.
 */
export function scheduleToUIEntries(schedule: SimpleSchedule): SimpleScheduleEntryUI[] {
  const entries: SimpleScheduleEntryUI[] = [];

  for (const [groupNo, entry] of Object.entries(schedule)) {
    entries.push({
      ...entry,
      groupNo,
      isActive: isEntryActive(entry),
    });
  }

  entries.sort((a, b) => a.time.localeCompare(b.time));

  return entries;
}

/**
 * Create an empty/default schedule entry.
 */
export function createEmptyEntry(domain?: ScheduleDomain): SimpleScheduleEntry {
  const base: SimpleScheduleEntry = {
    weekdays: [],
    time: "00:00",
    condition: "fixed_time",
    astro_type: null,
    astro_offset_minutes: 0,
    target_channels: [],
    level: 0,
    level_2: null,
    duration: null,
    ramp_time: null,
  };

  if (domain === "cover") {
    base.level_2 = 0;
  }

  return base;
}

/**
 * Check if a condition type involves astro settings.
 */
export function isAstroCondition(condition: ConditionType): boolean {
  return condition !== "fixed_time";
}

// --- Duration Helpers ---

const DURATION_REGEX = /^(\d+(?:\.\d+)?)\s*(ms|s|min|h)$/;

/**
 * Parse a duration string like "4h", "10s", "5min", "500ms".
 */
export function parseDuration(duration: string): { value: number; unit: DurationUnit } | null {
  const match = duration.trim().match(DURATION_REGEX);
  if (!match) return null;
  return { value: parseFloat(match[1]), unit: match[2] as DurationUnit };
}

/**
 * Build a duration string from value and unit.
 */
export function buildDuration(value: number, unit: DurationUnit): string {
  return `${value}${unit}`;
}

/**
 * Format duration for display.
 */
export function formatDurationDisplay(duration: string | null): string {
  if (!duration) return "-";
  const parsed = parseDuration(duration);
  if (!parsed) return duration;

  const unitLabels: Record<DurationUnit, string> = {
    ms: "ms",
    s: "s",
    min: "min",
    h: "h",
  };

  return `${parsed.value}${unitLabels[parsed.unit]}`;
}

/**
 * Validate a duration string.
 */
export function isValidDuration(duration: string): boolean {
  return DURATION_REGEX.test(duration.trim());
}

/**
 * Format level for display based on domain.
 */
export function formatLevel(level: number, domain?: ScheduleDomain): string {
  const config = domain ? DOMAIN_FIELD_CONFIG[domain] : undefined;
  if (config?.levelType === "binary") {
    return level === 0 ? "Off" : "On";
  }
  const percentage = level * 100;
  return `${Math.round(percentage)}%`;
}

/**
 * Format astro time for display.
 */
export function formatAstroTime(astroType: AstroType, offsetMinutes: number): string {
  const baseLabel = astroType === "sunrise" ? "Sunrise" : "Sunset";

  if (offsetMinutes === 0) {
    return baseLabel;
  } else if (offsetMinutes > 0) {
    return `${baseLabel} +${offsetMinutes}m`;
  } else {
    return `${baseLabel} ${offsetMinutes}m`;
  }
}

/**
 * Labels needed to build a localized condition summary.
 */
export interface ConditionSummaryLabels {
  sunrise: string;
  sunset: string;
  or: string;
}

/**
 * Format an astro label with optional offset, using translated labels.
 */
function formatAstroLabel(
  astroType: AstroType | null,
  offsetMinutes: number,
  labels: ConditionSummaryLabels,
): string {
  const baseLabel = astroType === "sunset" ? labels.sunset : labels.sunrise;
  if (offsetMinutes === 0) return baseLabel;
  const sign = offsetMinutes > 0 ? "+" : "";
  return `${baseLabel} ${sign}${offsetMinutes}min`;
}

/**
 * Build a human-readable condition summary from a schedule entry.
 *
 * Examples (EN): "17:30", "Sunrise +20min", "Earliest: Sunrise -20min or 06:30"
 * Examples (DE): "17:30", "Sonnenaufgang +20min", "Frühestens: Sonnenaufgang -20min oder 06:30"
 */
export function formatConditionSummary(
  entry: Pick<SimpleScheduleEntry, "time" | "condition" | "astro_type" | "astro_offset_minutes">,
  conditionLabel: string,
  labels: ConditionSummaryLabels,
): string {
  const astro = formatAstroLabel(entry.astro_type, entry.astro_offset_minutes, labels);
  const time = entry.time;

  switch (entry.condition) {
    case "fixed_time":
      return time;
    case "astro":
      return astro;
    case "earliest":
      return `${conditionLabel}: ${astro} ${labels.or} ${time}`;
    case "latest":
      return `${conditionLabel}: ${astro} ${labels.or} ${time}`;
    case "fixed_if_before_astro":
      return `${time} / ${astro}`;
    case "astro_if_before_fixed":
      return `${astro} / ${time}`;
    case "fixed_if_after_astro":
      return `${time} / ${astro}`;
    case "astro_if_after_fixed":
      return `${astro} / ${time}`;
    default:
      return time;
  }
}

/**
 * Strip null values and default optional fields from a schedule entry
 * for the backend Pydantic model (extra="forbid").
 */
export function entryToBackend(entry: SimpleScheduleEntry): Record<string, unknown> {
  const result: Record<string, unknown> = {
    weekdays: entry.weekdays,
    time: entry.time,
    target_channels: entry.target_channels,
    level: entry.level,
  };

  if (entry.condition !== "fixed_time") {
    result.condition = entry.condition;
  }
  if (entry.astro_type !== null) {
    result.astro_type = entry.astro_type;
  }
  if (entry.astro_offset_minutes !== 0) {
    result.astro_offset_minutes = entry.astro_offset_minutes;
  }
  if (entry.level_2 !== null) {
    result.level_2 = entry.level_2;
  }
  if (entry.duration !== null) {
    result.duration = entry.duration;
  }
  if (entry.ramp_time !== null) {
    result.ramp_time = entry.ramp_time;
  }

  return result;
}

/**
 * Convert a full SimpleSchedule to the backend format.
 */
export function scheduleToBackend(
  schedule: SimpleSchedule,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const [key, entry] of Object.entries(schedule)) {
    result[key] = entryToBackend(entry);
  }
  return result;
}

/**
 * Check if entity attributes indicate a valid v1.0 non-climate schedule entity.
 */
export function isValidScheduleEntity(attributes: DeviceScheduleEntityAttributes): boolean {
  return attributes.schedule_type === "default" && attributes.schedule_api_version === "v1.0";
}
