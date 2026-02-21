/**
 * Adapter interfaces for schedule communication.
 * Abstracts away the difference between Service calls (Cards) and WebSocket calls (Panel).
 */

import type { SimpleProfileData, SimpleSchedulePeriod } from "../models/climate-types";
import type { SimpleSchedule } from "../models/device-types";

export interface ClimateScheduleAdapter {
  /**
   * Return schedule data for a specific profile.
   */
  getScheduleProfile(deviceAddress: string, profile: string): Promise<SimpleProfileData>;

  /**
   * Set schedule weekday data.
   */
  setScheduleWeekday(params: {
    deviceAddress: string;
    profile: string;
    weekday: string;
    baseTemperature: number;
    periods: SimpleSchedulePeriod[];
  }): Promise<void>;

  /**
   * Set the active schedule profile.
   */
  setActiveProfile(deviceAddress: string, profile: string): Promise<void>;

  /**
   * Reload device configuration from CCU.
   */
  reloadDeviceConfig(deviceAddress: string): Promise<void>;
}

export interface DeviceScheduleAdapter {
  /**
   * Return schedule data for a device.
   */
  getSchedule(deviceAddress: string): Promise<SimpleSchedule>;

  /**
   * Set schedule data for a device.
   */
  setSchedule(
    deviceAddress: string,
    scheduleData: { entries: Record<string, unknown> },
  ): Promise<void>;

  /**
   * Reload device configuration from CCU.
   */
  reloadDeviceConfig(deviceAddress: string): Promise<void>;
}
