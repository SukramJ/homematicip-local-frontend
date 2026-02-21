/**
 * Schedule data conversion utilities.
 */

import type {
  WeekdayData,
  BackendWeekdayData,
  SimpleWeekdayData,
  SimpleSchedulePeriod,
  TimeBlock,
} from "../models/climate-types";
import { timeToMinutes, minutesToTime } from "./time";

// --- Climate Schedule Converters ---

/**
 * Parse weekday schedule data into time blocks.
 */
export function parseWeekdaySchedule(weekdayData: WeekdayData): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  let previousEndTime = "00:00";
  let previousEndMinutes = 0;

  const sortedSlots = Object.entries(weekdayData)
    .map(([slot, data]) => ({ slot: parseInt(slot), data }))
    .sort((a, b) => a.slot - b.slot);

  for (const { slot, data } of sortedSlots) {
    if (!data || typeof data.ENDTIME !== "string" || data.TEMPERATURE === undefined) {
      continue;
    }
    const endTime = data.ENDTIME;
    const endMinutes = timeToMinutes(endTime);

    if (endMinutes > previousEndMinutes && endMinutes <= 1440) {
      blocks.push({
        startTime: previousEndTime,
        startMinutes: previousEndMinutes,
        endTime: endTime,
        endMinutes: endMinutes,
        temperature: data.TEMPERATURE,
        slot: slot,
      });

      previousEndTime = endTime;
      previousEndMinutes = endMinutes;
    }

    if (endMinutes >= 1440) {
      break;
    }
  }

  return blocks;
}

/**
 * Parse simple weekday schedule data into time blocks.
 */
export function parseSimpleWeekdaySchedule(simpleData: SimpleWeekdayData): {
  blocks: TimeBlock[];
  baseTemperature: number;
} {
  const { base_temperature: baseTemperature, periods } = simpleData;
  const blocks: TimeBlock[] = [];

  const sortedPeriods = [...periods].sort((a, b) => {
    const aStart = timeToMinutes(a.starttime);
    const bStart = timeToMinutes(b.starttime);
    return aStart - bStart;
  });

  for (let i = 0; i < sortedPeriods.length; i++) {
    const period = sortedPeriods[i];
    blocks.push({
      startTime: period.starttime,
      startMinutes: timeToMinutes(period.starttime),
      endTime: period.endtime,
      endMinutes: timeToMinutes(period.endtime),
      temperature: period.temperature,
      slot: i + 1,
    });
  }

  return { blocks, baseTemperature };
}

/**
 * Convert time blocks back to weekday data format.
 */
export function timeBlocksToWeekdayData(blocks: TimeBlock[]): WeekdayData {
  const weekdayData: WeekdayData = {};

  const sortedBlocks = [...blocks].sort((a, b) => a.endMinutes - b.endMinutes);

  const renumberedBlocks = sortedBlocks.map((block, index) => ({
    ...block,
    slot: index + 1,
  }));

  if (renumberedBlocks.length > 0) {
    const lastIndex = renumberedBlocks.length - 1;
    const lastBlock = renumberedBlocks[lastIndex];
    if (lastBlock.endMinutes !== 1440) {
      renumberedBlocks[lastIndex] = {
        ...lastBlock,
        endTime: "24:00",
        endMinutes: 1440,
      };
    }
  }

  for (let i = 0; i < renumberedBlocks.length; i++) {
    const block = renumberedBlocks[i];
    weekdayData[(i + 1).toString()] = {
      ENDTIME: block.endTime,
      TEMPERATURE: block.temperature,
    };
  }

  return weekdayData;
}

/**
 * Convert time blocks to simple weekday data format.
 */
export function timeBlocksToSimpleWeekdayData(
  blocks: TimeBlock[],
  baseTemperature: number,
): SimpleWeekdayData {
  const periods: SimpleSchedulePeriod[] = [];

  const sortedBlocks = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes);

  for (const block of sortedBlocks) {
    periods.push({
      starttime: block.startTime,
      endtime: block.endTime,
      temperature: block.temperature,
    });
  }

  return { base_temperature: baseTemperature, periods };
}

/**
 * Convert WeekdayData to backend format with integer keys.
 */
export function convertToBackendFormat(weekdayData: WeekdayData): BackendWeekdayData {
  const backendData: BackendWeekdayData = {};

  const keys = Object.keys(weekdayData)
    .map((k) => parseInt(k))
    .filter((n) => !isNaN(n) && n >= 1 && n <= 13)
    .sort((a, b) => a - b);

  for (const i of keys) {
    const slot = weekdayData[i.toString()];
    if (slot) {
      backendData[i] = {
        ENDTIME: slot.ENDTIME,
        TEMPERATURE: slot.TEMPERATURE,
      };
    }
  }

  return backendData;
}

/**
 * Calculate base temperature from time blocks.
 */
export function calculateBaseTemperature(blocks: TimeBlock[]): number {
  if (blocks.length === 0) {
    return 20.0;
  }

  const tempMinutes = new Map<number, number>();

  for (const block of blocks) {
    const duration = block.endMinutes - block.startMinutes;
    const current = tempMinutes.get(block.temperature) || 0;
    tempMinutes.set(block.temperature, current + duration);
  }

  let maxMinutes = 0;
  let baseTemp = 20.0;

  for (const [temp, minutes] of tempMinutes.entries()) {
    if (minutes > maxMinutes) {
      maxMinutes = minutes;
      baseTemp = temp;
    }
  }

  return baseTemp;
}

/**
 * Merge consecutive time blocks with the same temperature.
 */
export function mergeConsecutiveBlocks(blocks: TimeBlock[]): TimeBlock[] {
  if (blocks.length === 0) return [];

  const sortedBlocks = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes);
  const result: TimeBlock[] = [];

  let currentBlock = { ...sortedBlocks[0] };

  for (let i = 1; i < sortedBlocks.length; i++) {
    const nextBlock = sortedBlocks[i];

    if (
      currentBlock.endMinutes === nextBlock.startMinutes &&
      currentBlock.temperature === nextBlock.temperature
    ) {
      currentBlock = {
        ...currentBlock,
        endTime: nextBlock.endTime,
        endMinutes: nextBlock.endMinutes,
      };
    } else {
      result.push(currentBlock);
      currentBlock = { ...nextBlock };
    }
  }

  result.push(currentBlock);

  return result.map((block, index) => ({
    ...block,
    slot: index + 1,
  }));
}

/**
 * Insert a new time block, splitting existing blocks as needed.
 */
export function insertBlockWithSplitting(
  existingBlocks: TimeBlock[],
  newBlock: TimeBlock,
  _baseTemperature: number,
): TimeBlock[] {
  const result: TimeBlock[] = [];
  const newStart = newBlock.startMinutes;
  const newEnd = newBlock.endMinutes;

  const sortedBlocks = [...existingBlocks].sort((a, b) => a.startMinutes - b.startMinutes);

  for (const block of sortedBlocks) {
    const blockStart = block.startMinutes;
    const blockEnd = block.endMinutes;

    if (blockEnd <= newStart) {
      result.push(block);
      continue;
    }

    if (blockStart >= newEnd) {
      result.push(block);
      continue;
    }

    if (blockStart < newStart) {
      result.push({
        ...block,
        endTime: minutesToTime(newStart),
        endMinutes: newStart,
        slot: result.length + 1,
      });
    }

    if (blockEnd > newEnd) {
      result.push({
        ...block,
        startTime: minutesToTime(newEnd),
        startMinutes: newEnd,
        slot: result.length + 1,
      });
    }
  }

  result.push({
    ...newBlock,
    slot: result.length + 1,
  });

  const sorted = result.sort((a, b) => a.startMinutes - b.startMinutes);
  const merged = mergeConsecutiveBlocks(sorted);

  return merged;
}

/**
 * Fill gaps in schedule with base temperature blocks.
 */
export function fillGapsWithBaseTemperature(
  blocks: TimeBlock[],
  baseTemperature: number,
): TimeBlock[] {
  if (blocks.length === 0) {
    return [
      {
        startTime: "00:00",
        startMinutes: 0,
        endTime: "24:00",
        endMinutes: 1440,
        temperature: baseTemperature,
        slot: 1,
      },
    ];
  }

  const sortedBlocks = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes);
  const result: TimeBlock[] = [];
  let currentMinutes = 0;

  for (const block of sortedBlocks) {
    if (block.startMinutes > currentMinutes) {
      result.push({
        startTime: minutesToTime(currentMinutes),
        startMinutes: currentMinutes,
        endTime: block.startTime,
        endMinutes: block.startMinutes,
        temperature: baseTemperature,
        slot: result.length + 1,
      });
    }

    result.push({
      ...block,
      slot: result.length + 1,
    });

    currentMinutes = block.endMinutes;
  }

  if (currentMinutes < 1440) {
    result.push({
      startTime: minutesToTime(currentMinutes),
      startMinutes: currentMinutes,
      endTime: "24:00",
      endMinutes: 1440,
      temperature: baseTemperature,
      slot: result.length + 1,
    });
  }

  return mergeConsecutiveBlocks(result);
}

/**
 * Sort blocks chronologically by start time and renumber slots.
 */
export function sortBlocksChronologically(blocks: TimeBlock[]): TimeBlock[] {
  return [...blocks]
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map((block, index) => ({
      ...block,
      slot: index + 1,
    }));
}

/**
 * Determine the schedule API version from the entity attribute value.
 */
export function getScheduleApiVersion(scheduleApiVersion?: string): "v1" | "v2" {
  return scheduleApiVersion === "v2.0" ? "v2" : "v1";
}

/**
 * Convert preset_mode value to profile name.
 */
export function getProfileFromPresetMode(presetMode?: string): string | undefined {
  if (!presetMode) return undefined;
  const match = presetMode.match(/^week_pro(?:gram|file)_(\d+)$/);
  if (match && match[1]) {
    return `P${match[1]}`;
  }
  return undefined;
}

/**
 * Convert device_active_profile_index (1-based) to profile name.
 */
export function getActiveProfileFromIndex(index?: number | null): string | undefined {
  if (index === undefined || index === null) return undefined;
  return `P${index}`;
}
