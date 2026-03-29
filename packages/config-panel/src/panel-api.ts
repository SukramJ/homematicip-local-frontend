import type { HomeAssistant } from "./types";

// --- Integration tab types ---

export interface SystemHealthData {
  central_state: string;
  overall_health_score: number;
  [key: string]: unknown;
}

export interface ThrottleStats {
  interval: number;
  is_enabled: boolean;
  queue_size: number;
  throttled_count: number;
  critical_count: number;
  burst_count: number;
  burst_threshold: number;
  burst_window: number;
}

export interface IncidentSummary {
  total_incidents: number;
  incidents_by_type: Record<string, number>;
  incidents_by_severity: Record<string, number>;
}

export interface IncidentsResult {
  incidents: Record<string, unknown>[];
  summary: IncidentSummary;
}

export interface DeviceStatistics {
  total_devices: number;
  unreachable_devices: number;
  firmware_updatable_devices: number;
  by_interface: Record<string, { total: number; unreachable: number; firmware_updatable: number }>;
}

// --- OpenCCU tab types ---

export interface InboxDevice {
  device_id: string;
  address: string;
  name: string;
  device_type: string;
  interface: string;
}

export interface ServiceMessage {
  msg_id: string;
  name: string;
  message_code: string;
  display_name: string;
  timestamp: string;
  msg_type: number;
  msg_type_name: string;
  address: string;
  device_name: string;
  last_timestamp: string;
  counter: number;
  rooms: string[];
  functions: string[];
  quittable: boolean;
}

export interface AlarmMessage {
  alarm_id: string;
  name: string;
  message_code: string;
  display_name: string;
  description: string;
  device_name: string;
  timestamp: string;
  last_timestamp: string;
  counter: number;
  last_trigger: string;
  rooms: string[];
}

export interface SystemInformation {
  name: string;
  model: string | null;
  version: string | null;
  url: string;
  serial: string | null;
  hostname: string;
  ccu_type: string | null;
  auth_enabled: boolean | null;
  https_redirect_enabled: boolean | null;
  available_interfaces: string[];
  has_backup: boolean;
  has_system_update: boolean;
}

export interface BackupResult {
  success: boolean;
  filename: string;
  path: string;
  size: number;
}

export interface HubData {
  service_messages: number | null;
  alarm_messages: number | null;
}

export interface InstallModeInfo {
  remaining_seconds: number | null;
  active: boolean;
  available: boolean;
}

export interface InstallModeStatus {
  hmip: InstallModeInfo;
  bidcos: InstallModeInfo;
}

export interface SignalQualityDevice {
  address: string;
  name: string;
  model: string;
  interface_id: string;
  is_reachable: boolean;
  rssi_device: number | null;
  rssi_peer: number | null;
  signal_strength: number | null;
  low_battery: boolean | null;
}

export interface FirmwareDevice {
  address: string;
  name: string;
  model: string;
  interface_id: string;
  firmware: string;
  available_firmware: string | null;
  firmware_updatable: boolean;
  firmware_update_state: string;
}

export interface FirmwareOverview {
  devices: FirmwareDevice[];
  summary: {
    total_devices: number;
    firmware_updatable: number;
  };
}

// --- Integration tab API ---

export async function getSystemHealth(
  hass: HomeAssistant,
  entryId: string,
): Promise<SystemHealthData> {
  return hass.callWS<SystemHealthData>({
    type: "homematicip_local/integration/get_system_health",
    entry_id: entryId,
  });
}

export async function getCommandThrottleStats(
  hass: HomeAssistant,
  entryId: string,
): Promise<Record<string, ThrottleStats>> {
  const result = await hass.callWS<{ throttle_stats: Record<string, ThrottleStats> }>({
    type: "homematicip_local/integration/get_command_throttle_stats",
    entry_id: entryId,
  });
  return result.throttle_stats;
}

export async function getIncidents(
  hass: HomeAssistant,
  entryId: string,
  limit = 50,
  interfaceId?: string,
): Promise<IncidentsResult> {
  return hass.callWS<IncidentsResult>({
    type: "homematicip_local/integration/get_incidents",
    entry_id: entryId,
    limit,
    ...(interfaceId && { interface_id: interfaceId }),
  });
}

export async function clearIncidents(
  hass: HomeAssistant,
  entryId: string,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/integration/clear_incidents",
    entry_id: entryId,
  });
}

export async function clearCache(
  hass: HomeAssistant,
  entryId: string,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/integration/clear_cache",
    entry_id: entryId,
  });
}

export async function getDeviceStatistics(
  hass: HomeAssistant,
  entryId: string,
): Promise<DeviceStatistics> {
  return hass.callWS<DeviceStatistics>({
    type: "homematicip_local/integration/get_device_statistics",
    entry_id: entryId,
  });
}

// --- OpenCCU tab API ---

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
