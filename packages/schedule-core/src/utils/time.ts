/**
 * Time conversion and formatting utilities.
 */

/**
 * Convert time string (HH:MM) to minutes.
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to time string (HH:MM).
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Round time to nearest 15 minutes.
 */
export function roundTimeToQuarter(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

/**
 * Format time for display based on hour format preference.
 */
export function formatTime(time: string, hourFormat: "12" | "24" = "24"): string {
  if (hourFormat === "24") {
    return time;
  }

  const [hoursStr, minutesStr] = time.split(":");
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr || "00";

  if (hours === 24) {
    return "12:00 AM";
  }

  const period = hours >= 12 ? "PM" : "AM";

  if (hours === 0) {
    hours = 12;
  } else if (hours > 12) {
    hours = hours - 12;
  }

  return `${hours}:${minutes} ${period}`;
}

/**
 * Parse time string (HH:MM) to hour and minute.
 */
export function parseTime(timeStr: string): { hour: number; minute: number } {
  const parts = timeStr.split(":");
  if (parts.length !== 2) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);

  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid time values: ${timeStr}`);
  }

  return { hour, minute };
}

/**
 * Validate a time string (HH:MM).
 */
export function isValidTime(time: string): boolean {
  try {
    parseTime(time);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format hour and minute to time string (HH:MM).
 */
export function formatTimeFromParts(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}
