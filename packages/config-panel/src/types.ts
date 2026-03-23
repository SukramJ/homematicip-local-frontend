export type {
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
} from "./api";

export interface NavigationDetail {
  device?: string;
  interfaceId?: string;
  channel?: string;
  paramsetKey?: string;
}

export interface HomeAssistant {
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  config: { language: string };
  themes: { darkMode: boolean };
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
