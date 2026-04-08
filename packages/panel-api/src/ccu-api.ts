import type {
  HomeAssistant,
  SystemInformation,
  BackupResult,
  HubData,
  InstallModeStatus,
  SignalQualityDevice,
  FirmwareOverview,
  InboxDevice,
  ServiceMessage,
  AlarmMessage,
} from "./types";

export async function getSystemInformation(
  hass: HomeAssistant,
  entryId: string,
): Promise<SystemInformation> {
  return hass.callWS<SystemInformation>({
    type: "homematicip_local/ccu/get_system_information",
    entry_id: entryId,
  });
}

export async function createBackup(hass: HomeAssistant, entryId: string): Promise<BackupResult> {
  return hass.callWS<BackupResult>({
    type: "homematicip_local/ccu/create_backup",
    entry_id: entryId,
  });
}

export async function getHubData(hass: HomeAssistant, entryId: string): Promise<HubData> {
  return hass.callWS<HubData>({
    type: "homematicip_local/ccu/get_hub_data",
    entry_id: entryId,
  });
}

export async function getInstallModeStatus(
  hass: HomeAssistant,
  entryId: string,
): Promise<InstallModeStatus> {
  return hass.callWS<InstallModeStatus>({
    type: "homematicip_local/ccu/get_install_mode_status",
    entry_id: entryId,
  });
}

export async function triggerInstallMode(
  hass: HomeAssistant,
  entryId: string,
  iface: "hmip" | "bidcos",
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/ccu/trigger_install_mode",
    entry_id: entryId,
    interface: iface,
  });
}

export async function getSignalQuality(
  hass: HomeAssistant,
  entryId: string,
): Promise<SignalQualityDevice[]> {
  const result = await hass.callWS<{ devices: SignalQualityDevice[] }>({
    type: "homematicip_local/ccu/get_signal_quality",
    entry_id: entryId,
  });
  return result.devices;
}

export async function getFirmwareOverview(
  hass: HomeAssistant,
  entryId: string,
): Promise<FirmwareOverview> {
  return hass.callWS<FirmwareOverview>({
    type: "homematicip_local/ccu/get_firmware_overview",
    entry_id: entryId,
  });
}

export async function refreshFirmwareData(
  hass: HomeAssistant,
  entryId: string,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/ccu/refresh_firmware_data",
    entry_id: entryId,
  });
}

export async function getInboxDevices(
  hass: HomeAssistant,
  entryId: string,
): Promise<InboxDevice[]> {
  const result = await hass.callWS<{ devices: InboxDevice[] }>({
    type: "homematicip_local/ccu/get_inbox_devices",
    entry_id: entryId,
  });
  return result.devices;
}

export async function acceptInboxDevice(
  hass: HomeAssistant,
  entryId: string,
  deviceAddress: string,
  deviceName?: string,
  deviceId?: string,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/ccu/accept_inbox_device",
    entry_id: entryId,
    device_address: deviceAddress,
    ...(deviceName && deviceId ? { device_name: deviceName, device_id: deviceId } : {}),
  });
}

export async function getServiceMessages(
  hass: HomeAssistant,
  entryId: string,
): Promise<ServiceMessage[]> {
  const result = await hass.callWS<{ messages: ServiceMessage[] }>({
    type: "homematicip_local/ccu/get_service_messages",
    entry_id: entryId,
  });
  return result.messages;
}

export async function acknowledgeServiceMessage(
  hass: HomeAssistant,
  entryId: string,
  msgId: string,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/ccu/acknowledge_service_message",
    entry_id: entryId,
    msg_id: msgId,
  });
}

export async function getAlarmMessages(
  hass: HomeAssistant,
  entryId: string,
): Promise<AlarmMessage[]> {
  const result = await hass.callWS<{ alarms: AlarmMessage[] }>({
    type: "homematicip_local/ccu/get_alarm_messages",
    entry_id: entryId,
  });
  return result.alarms;
}

export async function acknowledgeAlarmMessage(
  hass: HomeAssistant,
  entryId: string,
  alarmId: string,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/ccu/acknowledge_alarm_message",
    entry_id: entryId,
    alarm_id: alarmId,
  });
}

export async function panelReloadDeviceConfig(
  hass: HomeAssistant,
  entryId: string,
  deviceAddress: string,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/ccu/reload_device_config",
    entry_id: entryId,
    device_address: deviceAddress,
  });
}
