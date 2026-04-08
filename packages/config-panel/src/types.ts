export type {
  HomeAssistant,
  DeviceInfo,
  ChannelInfo,
  FormSchema,
  FormSection,
  FormParameter,
  PutResult,
  MaintenanceData,
  SessionState,
  SessionUndoRedoResult,
  SessionSaveResult,
  ExportResult,
  ImportResult,
  HistoryEntry,
  HistoryResult,
  LinkInfo,
  LinkableChannel,
  SubsetGroup,
  SubsetOption,
  ScheduleDeviceInfo,
  ClimateScheduleData,
  DeviceScheduleData,
  UserPermissions,
  ResolvedProfile,
  LinkProfilesResponse,
  SystemHealthData,
  ThrottleStats,
  IncidentSummary,
  IncidentsResult,
  DeviceStatistics,
  InboxDevice,
  ServiceMessage,
  AlarmMessage,
  SystemInformation,
  BackupResult,
  HubData,
  InstallModeInfo,
  InstallModeStatus,
  SignalQualityDevice,
  FirmwareDevice,
  FirmwareOverview,
} from "@hmip/panel-api";

export interface NavigationDetail {
  device?: string;
  interfaceId?: string;
  channel?: string;
  paramsetKey?: string;
}

export interface PanelInfo {
  config: {
    entry_id?: string;
  };
}

export interface EntryInfo {
  entry_id: string;
  title: string;
}
