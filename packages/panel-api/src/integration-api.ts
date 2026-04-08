import type {
  HomeAssistant,
  SystemHealthData,
  ThrottleStats,
  IncidentsResult,
  DeviceStatistics,
} from "./types";

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
