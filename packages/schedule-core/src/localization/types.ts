/**
 * Translation interface types for schedule components.
 */

import type { ClimateValidationMessageKey } from "../utils/validation";

type WeekdayLabels = {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
};

type DomainLabels = {
  switch: string;
  light: string;
  cover: string;
  valve: string;
};

type ConditionLabels = {
  fixed_time: string;
  astro: string;
  fixed_if_before_astro: string;
  astro_if_before_fixed: string;
  fixed_if_after_astro: string;
  astro_if_after_fixed: string;
  earliest: string;
  latest: string;
};

export interface ScheduleTranslations {
  weekdays: {
    short: WeekdayLabels;
    long: WeekdayLabels;
  };
  domains: DomainLabels;
  conditions: ConditionLabels;
  common: {
    schedule: string;
    loading: string;
    entityNotFound: string;
    clickToEdit: string;
    edit: string;
    cancel: string;
    save: string;
    addTimeBlock: string;
    copySchedule: string;
    pasteSchedule: string;
    undo: string;
    redo: string;
    undoShortcut: string;
    redoShortcut: string;
    exportSchedule: string;
    importSchedule: string;
    exportTooltip: string;
    importTooltip: string;
    exportSuccess: string;
    importSuccess: string;
    unsavedChanges: string;
    saveAll: string;
    discard: string;
    confirmDiscardChanges: string;
  };
  climate: {
    from: string;
    to: string;
    baseTemperature: string;
    baseTemperatureDescription: string;
    temperaturePeriods: string;
    editSlot: string;
    saveSlot: string;
    cancelSlotEdit: string;
    sensorNotSupported: string;
    noScheduleData: string;
  };
  device: {
    toggleCompactView: string;
    toggleFullView: string;
    enableDragDrop: string;
    disableDragDrop: string;
    level: string;
    levelOn: string;
    levelOff: string;
    slat: string;
    addEvent: string;
    editEvent: string;
    time: string;
    duration: string;
    rampTime: string;
    state: string;
    weekdays: string;
    channels: string;
    condition: string;
    astroSunrise: string;
    astroSunset: string;
    astroOffset: string;
    maxEntriesReached: string;
    confirmDelete: string;
  };
  errors: {
    failedToChangeProfile: string;
    failedToSaveSchedule: string;
    failedToPasteSchedule: string;
    invalidSchedule: string;
    failedToExport: string;
    failedToImport: string;
    invalidImportFile: string;
    invalidImportFormat: string;
    invalidImportData: string;
    incompatibleEntity: string;
    insufficientPermissions: string;
  };
  warnings: {
    title: string;
    noWarnings: string;
  };
  validationMessages: Record<ClimateValidationMessageKey, string>;
}

export type SupportedLanguage = "en" | "de";
