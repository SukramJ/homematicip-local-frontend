/**
 * Minimal HomeAssistant interface for WebSocket API calls.
 */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface HomeAssistant {
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  states?: Record<string, HassEntity>;
  config: { language: string };
  themes?: { darkMode: boolean };
}

// --- Device & Configuration types ---

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
  channel_name?: string;
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
  keypress_group?: "short" | "long" | "common";
  category?: "time" | "level" | "jump_target" | "condition" | "action" | "other";
  display_as_percent?: boolean;
  has_last_value?: boolean;
  hidden_by_default?: boolean;
  time_pair_id?: string;
  time_selector_type?: "timeOnOff" | "delay" | "rampOnOff";
  time_presets?: Array<{ base: number; factor: number; label: string }>;
  visible_when?: {
    trigger_param: string;
    trigger_value: unknown;
    invert: boolean;
  };
  presets?: Array<{ value: number; label: string }>;
  allow_custom_value?: boolean;
  subset_group_id?: string;
  operations?: number;
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

// --- Link types ---

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
  sender_channel_name?: string;
  receiver_device_name: string;
  receiver_device_model: string;
  receiver_channel_type: string;
  receiver_channel_type_label: string;
  receiver_channel_name?: string;
  peer_address: string;
  peer_device_name: string;
  peer_device_model: string;
  direction: "outgoing" | "incoming";
}

export interface LinkableChannel {
  address: string;
  channel_type: string;
  channel_type_label: string;
  channel_name?: string;
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

// --- Schedule types ---

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
  schedule_enabled: Record<string, boolean> | null;
}

// --- Permissions ---

export interface UserPermissions {
  is_admin: boolean;
  permissions: string[];
  backend: string | null;
}

// --- Integration dashboard types ---

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

// --- CCU types ---

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
