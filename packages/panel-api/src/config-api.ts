import type {
  HomeAssistant,
  DeviceInfo,
  FormSchema,
  PutResult,
  SessionState,
  SessionUndoRedoResult,
  SessionSaveResult,
  ExportResult,
  ImportResult,
  HistoryResult,
  LinkInfo,
  LinkableChannel,
  LinkProfilesResponse,
  ScheduleDeviceInfo,
  ClimateScheduleData,
  DeviceScheduleData,
  UserPermissions,
} from "./types";

/** Interfaces that support direct links (peerings). */
export const LINKABLE_INTERFACES = new Set(["BidCos-RF", "BidCos-Wired", "HmIP-RF"]);

export function getDeviceIconUrl(entryId: string, filename: string): string {
  return `/api/homematicip_local/${entryId}/device_icon/${filename}`;
}

// --- Device commands ---

export async function listDevices(hass: HomeAssistant, entryId: string): Promise<DeviceInfo[]> {
  const result = await hass.callWS<{ devices: DeviceInfo[] }>({
    type: "homematicip_local/config/list_devices",
    entry_id: entryId,
  });
  return result.devices;
}

export async function getFormSchema(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  channelAddress: string,
  channelType = "",
  paramsetKey = "MASTER",
): Promise<FormSchema> {
  return hass.callWS<FormSchema>({
    type: "homematicip_local/config/get_form_schema",
    entry_id: entryId,
    interface_id: interfaceId,
    channel_address: channelAddress,
    channel_type: channelType,
    paramset_key: paramsetKey,
  });
}

export async function getParamset(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  channelAddress: string,
  paramsetKey = "MASTER",
): Promise<Record<string, unknown>> {
  const result = await hass.callWS<{ values: Record<string, unknown> }>({
    type: "homematicip_local/config/get_paramset",
    entry_id: entryId,
    interface_id: interfaceId,
    channel_address: channelAddress,
    paramset_key: paramsetKey,
  });
  return result.values;
}

export async function putParamset(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  channelAddress: string,
  values: Record<string, unknown>,
  paramsetKey = "MASTER",
  validate = true,
): Promise<PutResult> {
  return hass.callWS<PutResult>({
    type: "homematicip_local/config/put_paramset",
    entry_id: entryId,
    interface_id: interfaceId,
    channel_address: channelAddress,
    paramset_key: paramsetKey,
    values,
    validate,
  });
}

// --- Session commands ---

export async function sessionOpen(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  channelAddress: string,
  paramsetKey = "MASTER",
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/config/session_open",
    entry_id: entryId,
    interface_id: interfaceId,
    channel_address: channelAddress,
    paramset_key: paramsetKey,
  });
}

export async function sessionSet(
  hass: HomeAssistant,
  entryId: string,
  channelAddress: string,
  parameter: string,
  value: unknown,
  paramsetKey = "MASTER",
): Promise<SessionState> {
  return hass.callWS({
    type: "homematicip_local/config/session_set",
    entry_id: entryId,
    channel_address: channelAddress,
    parameter,
    value,
    paramset_key: paramsetKey,
  });
}

export async function sessionUndo(
  hass: HomeAssistant,
  entryId: string,
  channelAddress: string,
  paramsetKey = "MASTER",
): Promise<SessionUndoRedoResult> {
  return hass.callWS({
    type: "homematicip_local/config/session_undo",
    entry_id: entryId,
    channel_address: channelAddress,
    paramset_key: paramsetKey,
  });
}

export async function sessionRedo(
  hass: HomeAssistant,
  entryId: string,
  channelAddress: string,
  paramsetKey = "MASTER",
): Promise<SessionUndoRedoResult> {
  return hass.callWS({
    type: "homematicip_local/config/session_redo",
    entry_id: entryId,
    channel_address: channelAddress,
    paramset_key: paramsetKey,
  });
}

export async function sessionSave(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  channelAddress: string,
  paramsetKey = "MASTER",
): Promise<SessionSaveResult> {
  return hass.callWS({
    type: "homematicip_local/config/session_save",
    entry_id: entryId,
    interface_id: interfaceId,
    channel_address: channelAddress,
    paramset_key: paramsetKey,
  });
}

export async function sessionDiscard(
  hass: HomeAssistant,
  entryId: string,
  channelAddress: string,
  paramsetKey = "MASTER",
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/config/session_discard",
    entry_id: entryId,
    channel_address: channelAddress,
    paramset_key: paramsetKey,
  });
}

// --- Export/Import ---

export async function exportParamset(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  channelAddress: string,
  paramsetKey = "MASTER",
): Promise<ExportResult> {
  return hass.callWS({
    type: "homematicip_local/config/export_paramset",
    entry_id: entryId,
    interface_id: interfaceId,
    channel_address: channelAddress,
    paramset_key: paramsetKey,
  });
}

export async function importParamset(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  channelAddress: string,
  jsonData: string,
  paramsetKey = "MASTER",
): Promise<ImportResult> {
  return hass.callWS({
    type: "homematicip_local/config/import_paramset",
    entry_id: entryId,
    interface_id: interfaceId,
    channel_address: channelAddress,
    json_data: jsonData,
    paramset_key: paramsetKey,
  });
}

// --- Change history ---

export async function getChangeHistory(
  hass: HomeAssistant,
  entryId: string,
  channelAddress = "",
  limit = 50,
): Promise<HistoryResult> {
  return hass.callWS({
    type: "homematicip_local/config/get_change_history",
    entry_id: entryId,
    channel_address: channelAddress,
    limit,
  });
}

export async function clearChangeHistory(
  hass: HomeAssistant,
  entryId: string,
): Promise<{ success: boolean; cleared: number }> {
  return hass.callWS({
    type: "homematicip_local/config/clear_change_history",
    entry_id: entryId,
  });
}

// --- Direct link commands ---

export async function listDeviceLinks(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  deviceAddress: string,
): Promise<LinkInfo[]> {
  const result = await hass.callWS<{ links: LinkInfo[] }>({
    type: "homematicip_local/config/list_device_links",
    entry_id: entryId,
    interface_id: interfaceId,
    device_address: deviceAddress,
  });
  return result.links;
}

export async function getLinkFormSchema(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  senderAddress: string,
  receiverAddress: string,
): Promise<FormSchema> {
  return hass.callWS<FormSchema>({
    type: "homematicip_local/config/get_link_form_schema",
    entry_id: entryId,
    interface_id: interfaceId,
    sender_channel_address: senderAddress,
    receiver_channel_address: receiverAddress,
  });
}

export async function getLinkParamset(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  senderAddress: string,
  receiverAddress: string,
): Promise<Record<string, unknown>> {
  const result = await hass.callWS<{ values: Record<string, unknown> }>({
    type: "homematicip_local/config/get_link_paramset",
    entry_id: entryId,
    interface_id: interfaceId,
    sender_channel_address: senderAddress,
    receiver_channel_address: receiverAddress,
  });
  return result.values;
}

export async function putLinkParamset(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  senderAddress: string,
  receiverAddress: string,
  values: Record<string, unknown>,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/config/put_link_paramset",
    entry_id: entryId,
    interface_id: interfaceId,
    sender_channel_address: senderAddress,
    receiver_channel_address: receiverAddress,
    values,
  });
}

export async function addLink(
  hass: HomeAssistant,
  entryId: string,
  senderAddress: string,
  receiverAddress: string,
  name?: string,
  description?: string,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/config/add_link",
    entry_id: entryId,
    sender_channel_address: senderAddress,
    receiver_channel_address: receiverAddress,
    ...(name && { name }),
    ...(description && { description }),
  });
}

export async function removeLink(
  hass: HomeAssistant,
  entryId: string,
  senderAddress: string,
  receiverAddress: string,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/config/remove_link",
    entry_id: entryId,
    sender_channel_address: senderAddress,
    receiver_channel_address: receiverAddress,
  });
}

export async function getLinkableChannels(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  channelAddress: string,
  role: "sender" | "receiver",
): Promise<LinkableChannel[]> {
  const result = await hass.callWS<{ channels: LinkableChannel[] }>({
    type: "homematicip_local/config/get_linkable_channels",
    entry_id: entryId,
    interface_id: interfaceId,
    channel_address: channelAddress,
    role,
  });
  return result.channels;
}

export async function getLinkProfiles(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  senderAddress: string,
  receiverAddress: string,
): Promise<LinkProfilesResponse | null> {
  try {
    return await hass.callWS<LinkProfilesResponse>({
      type: "homematicip_local/config/get_link_profiles",
      entry_id: entryId,
      interface_id: interfaceId,
      sender_channel_address: senderAddress,
      receiver_channel_address: receiverAddress,
    });
  } catch {
    return null;
  }
}

export async function testLinkProfile(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  senderAddress: string,
  receiverAddress: string,
  profileId: number,
): Promise<{ success: boolean; applied_values: Record<string, unknown> }> {
  return hass.callWS({
    type: "homematicip_local/config/test_link_profile",
    entry_id: entryId,
    interface_id: interfaceId,
    sender_channel_address: senderAddress,
    receiver_channel_address: receiverAddress,
    profile_id: profileId,
  });
}

// --- Determine parameter ---

export async function determineParameter(
  hass: HomeAssistant,
  entryId: string,
  interfaceId: string,
  channelAddress: string,
  parameterId: string,
): Promise<{ success: boolean; value: unknown }> {
  return hass.callWS({
    type: "homematicip_local/config/determine_parameter",
    entry_id: entryId,
    interface_id: interfaceId,
    channel_address: channelAddress,
    parameter_id: parameterId,
  });
}

// --- Schedule commands ---

export async function listScheduleDevices(
  hass: HomeAssistant,
  entryId: string,
): Promise<ScheduleDeviceInfo[]> {
  const result = await hass.callWS<{ devices: ScheduleDeviceInfo[] }>({
    type: "homematicip_local/config/list_schedule_devices",
    entry_id: entryId,
  });
  return result.devices;
}

export async function getClimateSchedule(
  hass: HomeAssistant,
  entryId: string,
  deviceAddress: string,
  profile?: string,
): Promise<ClimateScheduleData> {
  return hass.callWS<ClimateScheduleData>({
    type: "homematicip_local/config/get_climate_schedule",
    entry_id: entryId,
    device_address: deviceAddress,
    ...(profile && { profile }),
  });
}

export async function setClimateScheduleWeekday(
  hass: HomeAssistant,
  entryId: string,
  deviceAddress: string,
  profile: string,
  weekday: string,
  baseTemperature: number,
  periods: Array<Record<string, unknown>>,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/config/set_climate_schedule_weekday",
    entry_id: entryId,
    device_address: deviceAddress,
    profile,
    weekday,
    base_temperature: baseTemperature,
    simple_weekday_list: periods,
  });
}

export async function setClimateActiveProfile(
  hass: HomeAssistant,
  entryId: string,
  deviceAddress: string,
  profile: string,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/config/set_climate_active_profile",
    entry_id: entryId,
    device_address: deviceAddress,
    profile,
  });
}

export async function getDeviceSchedule(
  hass: HomeAssistant,
  entryId: string,
  deviceAddress: string,
): Promise<DeviceScheduleData> {
  return hass.callWS<DeviceScheduleData>({
    type: "homematicip_local/config/get_device_schedule",
    entry_id: entryId,
    device_address: deviceAddress,
  });
}

export async function setDeviceSchedule(
  hass: HomeAssistant,
  entryId: string,
  deviceAddress: string,
  scheduleData: Record<string, unknown>,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/config/set_device_schedule",
    entry_id: entryId,
    device_address: deviceAddress,
    schedule_data: scheduleData,
  });
}

export async function setScheduleEnabled(
  hass: HomeAssistant,
  entryId: string,
  deviceAddress: string,
  enabled: boolean,
  channelKey?: string,
): Promise<{ success: boolean }> {
  const msg: Record<string, unknown> = {
    type: "homematicip_local/config/set_schedule_enabled",
    entry_id: entryId,
    device_address: deviceAddress,
    enabled,
  };
  if (channelKey !== undefined) {
    msg.channel_key = channelKey;
  }
  return hass.callWS(msg);
}

export async function reloadDeviceConfig(
  hass: HomeAssistant,
  entryId: string,
  deviceAddress: string,
): Promise<{ success: boolean }> {
  return hass.callWS({
    type: "homematicip_local/config/reload_device_config",
    entry_id: entryId,
    device_address: deviceAddress,
  });
}

// --- Permissions ---

export async function getUserPermissions(
  hass: HomeAssistant,
  entryId: string,
): Promise<UserPermissions> {
  return hass.callWS<UserPermissions>({
    type: "homematicip_local/config/get_user_permissions",
    entry_id: entryId,
  });
}
