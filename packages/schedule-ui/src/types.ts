import type {
  Weekday,
  TimeBlock,
  ClimateValidationMessageKey,
  SimpleScheduleEntry,
  SimpleScheduleEntryUI,
  ConditionType,
  ConditionSummaryLabels,
} from "@hmip/schedule-core";

export interface GridTranslations {
  weekdayShortLabels: Record<Weekday, string>;
  weekdayLongLabels?: Record<Weekday, string>;
  clickToEdit: string;
  copySchedule: string;
  pasteSchedule: string;
  previousDay?: string;
  nextDay?: string;
}

export interface EditorTranslations {
  weekdayShortLabels: Record<Weekday, string>;
  weekdayLongLabels: Record<Weekday, string>;
  edit: string;
  cancel: string;
  save: string;
  addTimeBlock: string;
  from: string;
  to: string;
  baseTemperature: string;
  baseTemperatureDescription: string;
  temperaturePeriods: string;
  editSlot: string;
  saveSlot: string;
  cancelSlotEdit: string;
  undoShortcut: string;
  redoShortcut: string;
  removeSlot: string;
  close: string;
  warningsTitle: string;
  validationMessages: Record<ClimateValidationMessageKey, string>;
}

export interface WeekdayClickDetail {
  weekday: Weekday;
}

export interface CopyScheduleDetail {
  weekday: Weekday;
}

export interface PasteScheduleDetail {
  weekday: Weekday;
}

export interface SaveScheduleDetail {
  weekday: Weekday;
  blocks: TimeBlock[];
  baseTemperature: number;
}

export interface ValidationFailedDetail {
  error: string;
}

// --- Device Schedule Types ---

export interface DeviceListTranslations {
  weekdayShortLabels: Record<Weekday, string>;
  condition: string;
  time: string;
  weekdays: string;
  duration: string;
  state: string;
  addEvent: string;
  editEvent: string;
  deleteEvent: string;
  slat: string;
  noScheduleEvents: string;
  loading: string;
  levelOn: string;
  levelOff: string;
  permanentOn: string;
  showMore: string;
  showLess: string;
  conditionLabels: Record<ConditionType, string>;
  conditionSummaryLabels: ConditionSummaryLabels;
  lockActionLockAutorelockEnd: string;
  lockActionLockAutorelockStart: string;
  lockActionUnlockAutorelockEnd: string;
  lockActionAutorelockEnd: string;
  permissionGranted: string;
  permissionNotGranted: string;
}

export interface DeviceEditorTranslations {
  weekdayShortLabels: Record<Weekday, string>;
  addEvent: string;
  editEvent: string;
  cancel: string;
  save: string;
  time: string;
  condition: string;
  weekdaysLabel: string;
  stateLabel: string;
  duration: string;
  rampTime: string;
  channels: string;
  levelOn: string;
  levelOff: string;
  permanentOn: string;
  slat: string;
  astroSunrise: string;
  astroSunset: string;
  astroOffset: string;
  confirmDelete: string;
  conditionLabels: Record<ConditionType, string>;
  lockMode: string;
  lockModeDoorLock: string;
  lockModeUserPermission: string;
  lockAction: string;
  lockActionLockAutorelockEnd: string;
  lockActionLockAutorelockStart: string;
  lockActionUnlockAutorelockEnd: string;
  lockActionAutorelockEnd: string;
  lockPermission: string;
  permissionGranted: string;
  permissionNotGranted: string;
}

export interface EditEventDetail {
  entry: SimpleScheduleEntryUI;
}

export interface DeleteEventDetail {
  entry: SimpleScheduleEntryUI;
}

export interface SaveDeviceEventDetail {
  entry: SimpleScheduleEntry;
  groupNo: string;
}
