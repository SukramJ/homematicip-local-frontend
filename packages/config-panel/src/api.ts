import type { HomeAssistant } from "./types";

export interface MaintenanceData {
  unreach?: boolean;
  low_bat?: boolean;
  rssi_device?: number;
  rssi_peer?: number;
  dutycycle?: boolean;
  config_pending?: boolean;
}

export interface DeviceInfo {
  address: string;
  interface: string;
  interface_id: string;
  model: string;
  model_description: string;
  name: string;
  firmware: string;
  device_icon?: string;
  channels: ChannelInfo[];
  maintenance: MaintenanceData;
}

export interface ChannelInfo {
  address: string;
  channel_type: string;
  channel_type_label: string;
  paramset_keys: string[];
}

export interface FormSchema {
  channel_address: string;
  channel_type: string;
  channel_type_label: string;
  device_icon?: string;
  sections: FormSection[];
  total_parameters: number;
  writable_parameters: number;
  subset_groups?: SubsetGroup[];
}

export interface FormSection {
  id: string;
  title: string;
  parameters: FormParameter[];
}

export interface FormParameter {
  id: string;
  label: string;
  description?: string;
  type: string;
  widget: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  default?: unknown;
  current_value: unknown;
  writable: boolean;
  modified: boolean;
  options?: string[];
  option_labels?: Record<string, string>;

  // Link parameter metadata (optional, only present for LINK paramsets):
  keypress_group?: "short" | "long" | "common";
  category?: "time" | "level" | "jump_target" | "condition" | "action" | "other";
  display_as_percent?: boolean;
  has_last_value?: boolean;
  hidden_by_default?: boolean;
  time_pair_id?: string;
  time_selector_type?: "timeOnOff" | "delay" | "rampOnOff";
  time_presets?: Array<{ base: number; factor: number; label: string }>;

  // Easymode metadata (optional):
  visible_when?: {
    trigger_param: string;
    trigger_value: unknown;
    invert: boolean;
  };
  presets?: Array<{ value: number; label: string }>;
  allow_custom_value?: boolean;
  subset_group_id?: string;
}

export interface SubsetOption {
  id: number;
  label: string;
  values: Record<string, number | string>;
}

export interface SubsetGroup {
  id: string;
  label: string;
  member_params: string[];
  options: SubsetOption[];
  current_option_id?: number;
}

export interface PutResult {
  success: boolean;
  validated: boolean;
  validation_errors: Record<string, string>;
}

export interface SessionState {
  is_dirty: boolean;
  can_undo: boolean;
  can_redo: boolean;
  validation_errors: Record<string, string>;
}

export interface SessionUndoRedoResult {
  performed: boolean;
  is_dirty: boolean;
  can_undo: boolean;
  can_redo: boolean;
}

export interface SessionSaveResult {
  success: boolean;
  validated: boolean;
  validation_errors: Record<string, string>;
  changes_applied: number;
}

export interface ExportResult {
  json_data: string;
}

export interface ImportResult {
  success: boolean;
  validated: boolean;
  validation_errors: Record<string, string>;
  imported_model: string;
  imported_at: string;
}

export interface HistoryEntry {
  timestamp: string;
  entry_id: string;
  interface_id: string;
  channel_address: string;
  device_name: string;
  device_model: string;
  paramset_key: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  source: "manual" | "import" | "copy";
}

export interface HistoryResult {
  entries: HistoryEntry[];
  total: number;
}

export interface LinkInfo {
  sender_address: string;
  receiver_address: string;
  name: string;
  description: string;
  flags: number;
  sender_device_name: string;
  sender_device_model: string;
  sender_channel_type: string;
  sender_channel_type_label: string;
  receiver_device_name: string;
  receiver_device_model: string;
  receiver_channel_type: string;
  receiver_channel_type_label: string;
  peer_address: string;
  peer_device_name: string;
  peer_device_model: string;
  direction: "outgoing" | "incoming";
}

export interface LinkableChannel {
  address: string;
  channel_type: string;
  channel_type_label: string;
  device_address: string;
  device_name: string;
  device_model: string;
}

export interface ResolvedProfile {
  id: number;
  name: string;
  description: string;
  editable_params: string[];
  fixed_params: Record<string, number>;
  default_values: Record<string, number>;
}

export interface LinkProfilesResponse {
  profiles: ResolvedProfile[] | null;
  active_profile_id: number;
}

/** Interfaces that support direct links (peerings). */
export const LINKABLE_INTERFACES = new Set(["BidCos-RF", "BidCos-Wired", "HmIP-RF"]);

// --- Helper functions ---

export function getDeviceIconUrl(entryId: string, filename: string): string {
  return `/api/homematicip_local/${entryId}/device_icon/${filename}`;
}

// --- Original API functions ---

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

// --- Schedule commands ---

export interface ScheduleDeviceInfo {
  address: string;
  name: string;
  model: string;
  interface_id: string;
  channel_address: string;
  schedule_type: "climate" | "default";
  schedule_domain?: string;
}

export interface ClimateScheduleData {
  schedule_data: Record<string, unknown>;
  available_profiles: string[];
  active_profile: string;
  device_active_profile_index: number | null;
  min_temp: number;
  max_temp: number;
  step: number;
}

export interface DeviceScheduleData {
  schedule_data: Record<string, unknown>;
  max_entries: number;
  available_target_channels: Record<string, unknown>;
  schedule_domain: string | null;
}

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
