/**
 * Service-based adapter for standalone HACS cards.
 * Uses hass.callService() for communication.
 */

import type { HomeAssistant } from "../models/common-types";
import type { SimpleProfileData, SimpleSchedulePeriod } from "../models/climate-types";
import type { SimpleSchedule } from "../models/device-types";
import type { ClimateScheduleAdapter, DeviceScheduleAdapter } from "./types";

const DOMAIN = "homematicip_local";

export class ServiceClimateScheduleAdapter implements ClimateScheduleAdapter {
  constructor(private hass: HomeAssistant) {}

  async getScheduleProfile(deviceAddress: string, profile: string): Promise<SimpleProfileData> {
    const result = await this.hass.callService(DOMAIN, "get_schedule_profile", {
      device_address: deviceAddress,
      profile,
    });
    return result as unknown as SimpleProfileData;
  }

  async setScheduleWeekday(params: {
    deviceAddress: string;
    profile: string;
    weekday: string;
    baseTemperature: number;
    periods: SimpleSchedulePeriod[];
  }): Promise<void> {
    await this.hass.callService(DOMAIN, "set_schedule_weekday", {
      device_address: params.deviceAddress,
      profile: params.profile,
      weekday: params.weekday,
      base_temperature: params.baseTemperature,
      simple_weekday_list: params.periods,
    });
  }

  async setActiveProfile(deviceAddress: string, profile: string): Promise<void> {
    await this.hass.callService(DOMAIN, "set_current_schedule_profile", {
      device_address: deviceAddress,
      profile,
    });
  }

  async reloadDeviceConfig(deviceAddress: string): Promise<void> {
    await this.hass.callService(DOMAIN, "reload_device_config", {
      device_address: deviceAddress,
    });
  }
}

export class ServiceDeviceScheduleAdapter implements DeviceScheduleAdapter {
  constructor(private hass: HomeAssistant) {}

  async getSchedule(deviceAddress: string): Promise<SimpleSchedule> {
    const result = await this.hass.callService(DOMAIN, "get_schedule", {
      device_address: deviceAddress,
    });
    return result as unknown as SimpleSchedule;
  }

  async setSchedule(
    deviceAddress: string,
    scheduleData: { entries: Record<string, unknown> },
  ): Promise<void> {
    await this.hass.callService(DOMAIN, "set_schedule", {
      device_address: deviceAddress,
      schedule_data: scheduleData,
    });
  }

  async reloadDeviceConfig(deviceAddress: string): Promise<void> {
    await this.hass.callService(DOMAIN, "reload_device_config", {
      device_address: deviceAddress,
    });
  }
}
