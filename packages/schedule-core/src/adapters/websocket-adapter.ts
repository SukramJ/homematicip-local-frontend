/**
 * WebSocket-based adapter for the config panel.
 * Uses hass.callWS() for communication.
 */

import type { HomeAssistant } from "../models/common-types";
import type { SimpleProfileData, SimpleSchedulePeriod } from "../models/climate-types";
import type { SimpleSchedule } from "../models/device-types";
import type { ClimateScheduleAdapter, DeviceScheduleAdapter } from "./types";

export class WebSocketClimateScheduleAdapter implements ClimateScheduleAdapter {
  constructor(
    private hass: HomeAssistant,
    private entryId: string,
  ) {}

  async getScheduleProfile(deviceAddress: string, profile: string): Promise<SimpleProfileData> {
    const result = await this.hass.callWS<{ schedule_data: SimpleProfileData }>({
      type: "homematicip_local/config/get_climate_schedule",
      entry_id: this.entryId,
      device_address: deviceAddress,
      profile,
    });
    return result.schedule_data;
  }

  async setScheduleWeekday(params: {
    deviceAddress: string;
    profile: string;
    weekday: string;
    baseTemperature: number;
    periods: SimpleSchedulePeriod[];
  }): Promise<void> {
    await this.hass.callWS({
      type: "homematicip_local/config/set_climate_schedule_weekday",
      entry_id: this.entryId,
      device_address: params.deviceAddress,
      profile: params.profile,
      weekday: params.weekday,
      base_temperature: params.baseTemperature,
      simple_weekday_list: params.periods,
    });
  }

  async setActiveProfile(deviceAddress: string, profile: string): Promise<void> {
    await this.hass.callWS({
      type: "homematicip_local/config/set_climate_active_profile",
      entry_id: this.entryId,
      device_address: deviceAddress,
      profile,
    });
  }

  async reloadDeviceConfig(deviceAddress: string): Promise<void> {
    await this.hass.callWS({
      type: "homematicip_local/config/reload_device_config",
      entry_id: this.entryId,
      device_address: deviceAddress,
    });
  }
}

export class WebSocketDeviceScheduleAdapter implements DeviceScheduleAdapter {
  constructor(
    private hass: HomeAssistant,
    private entryId: string,
  ) {}

  async getSchedule(deviceAddress: string): Promise<SimpleSchedule> {
    const result = await this.hass.callWS<{ schedule_data: SimpleSchedule }>({
      type: "homematicip_local/config/get_device_schedule",
      entry_id: this.entryId,
      device_address: deviceAddress,
    });
    return result.schedule_data;
  }

  async setSchedule(
    deviceAddress: string,
    scheduleData: { entries: Record<string, unknown> },
  ): Promise<void> {
    await this.hass.callWS({
      type: "homematicip_local/config/set_device_schedule",
      entry_id: this.entryId,
      device_address: deviceAddress,
      schedule_data: scheduleData,
    });
  }

  async reloadDeviceConfig(deviceAddress: string): Promise<void> {
    await this.hass.callWS({
      type: "homematicip_local/config/reload_device_config",
      entry_id: this.entryId,
      device_address: deviceAddress,
    });
  }
}
