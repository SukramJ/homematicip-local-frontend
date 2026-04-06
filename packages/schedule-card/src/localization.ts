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

export interface Translations {
  // Weekday labels
  weekdays: {
    short: WeekdayLabels;
    long: WeekdayLabels;
  };
  // Domain labels
  domains: DomainLabels;
  // Condition labels
  conditions: ConditionLabels;
  // UI labels and messages
  ui: {
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
    toggleCompactView: string;
    toggleFullView: string;
    exportSchedule: string;
    importSchedule: string;
    exportTooltip: string;
    importTooltip: string;
    exportSuccess: string;
    importSuccess: string;
    unsavedChanges: string;
    saveAll: string;
    discard: string;
    enableDragDrop: string;
    disableDragDrop: string;
    confirmDiscardChanges: string;
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
    or: string;
    ifBefore: string;
    ifAfter: string;
    maxEntriesReached: string;
    confirmDelete: string;
  };
  // Error messages
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
  };
  // Validation warnings
  warnings: {
    title: string;
    noWarnings: string;
  };
}

const en: Translations = {
  weekdays: {
    short: {
      monday: "Mo",
      tuesday: "Tu",
      wednesday: "We",
      thursday: "Th",
      friday: "Fr",
      saturday: "Sa",
      sunday: "Su",
    },
    long: {
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      sunday: "Sunday",
    },
  },
  domains: {
    switch: "Switch",
    light: "Light",
    cover: "Cover",
    valve: "Valve",
  },
  conditions: {
    fixed_time: "Fixed Time",
    astro: "Astro",
    fixed_if_before_astro: "Fixed if before Astro",
    astro_if_before_fixed: "Astro if before Fixed",
    fixed_if_after_astro: "Fixed if after Astro",
    astro_if_after_fixed: "Astro if after Fixed",
    earliest: "Earliest",
    latest: "Latest",
  },
  ui: {
    schedule: "Schedule",
    loading: "Loading schedule data...",
    entityNotFound: "Entity {entity} not found",
    clickToEdit: "Click on a day to edit its schedule",
    edit: "Edit {weekday}",
    cancel: "Cancel",
    save: "Save",
    addTimeBlock: "+ Add Time Block",
    copySchedule: "Copy schedule",
    pasteSchedule: "Paste schedule",
    undo: "Undo",
    redo: "Redo",
    undoShortcut: "Undo (Ctrl+Z)",
    redoShortcut: "Redo (Ctrl+Y)",
    toggleCompactView: "Compact view",
    toggleFullView: "Full view",
    exportSchedule: "Export",
    importSchedule: "Import",
    exportTooltip: "Export schedule to JSON file",
    importTooltip: "Import schedule from JSON file",
    exportSuccess: "Schedule exported successfully",
    importSuccess: "Schedule imported successfully",
    unsavedChanges: "Unsaved changes",
    saveAll: "Save all",
    discard: "Discard",
    enableDragDrop: "Enable drag & drop mode",
    disableDragDrop: "Disable drag & drop mode",
    confirmDiscardChanges: "You have unsaved changes. Do you want to discard them?",
    level: "Level",
    levelOn: "On",
    levelOff: "Off",
    slat: "Slat Position",
    addEvent: "Add Event",
    editEvent: "Edit Event",
    time: "Time",
    duration: "Duration",
    rampTime: "Ramp Time",
    state: "State",
    weekdays: "Weekdays",
    channels: "Target Channels",
    condition: "Condition",
    astroSunrise: "Sunrise",
    astroSunset: "Sunset",
    astroOffset: "Astro Offset (min)",
    or: "or",
    ifBefore: "if before",
    ifAfter: "if after",
    maxEntriesReached: "Maximum number of entries reached ({max})",
    confirmDelete: "Are you sure you want to delete this event?",
  },
  errors: {
    failedToChangeProfile: "Failed to change profile: {error}",
    failedToSaveSchedule: "Failed to save schedule: {error}",
    failedToPasteSchedule: "Failed to paste schedule: {error}",
    invalidSchedule: "Invalid schedule: {error}",
    failedToExport: "Failed to export schedule: {error}",
    failedToImport: "Failed to import schedule: {error}",
    invalidImportFile: "Invalid file format. Please select a JSON file.",
    invalidImportFormat: "Invalid JSON format in file.",
    invalidImportData: "Invalid schedule data: {error}",
    incompatibleEntity:
      "Entity {entity} is not a compatible schedule entity (requires schedule_type 'default' and schedule_api_version 'v1.0')",
  },
  warnings: {
    title: "Validation Warnings",
    noWarnings: "No issues detected",
  },
};

const de: Translations = {
  weekdays: {
    short: {
      monday: "Mo",
      tuesday: "Di",
      wednesday: "Mi",
      thursday: "Do",
      friday: "Fr",
      saturday: "Sa",
      sunday: "So",
    },
    long: {
      monday: "Montag",
      tuesday: "Dienstag",
      wednesday: "Mittwoch",
      thursday: "Donnerstag",
      friday: "Freitag",
      saturday: "Samstag",
      sunday: "Sonntag",
    },
  },
  domains: {
    switch: "Schalter",
    light: "Licht",
    cover: "Rollladen",
    valve: "Ventil",
  },
  conditions: {
    fixed_time: "Feste Zeit",
    astro: "Astro",
    fixed_if_before_astro: "Fest wenn vor Astro",
    astro_if_before_fixed: "Astro wenn vor Fest",
    fixed_if_after_astro: "Fest wenn nach Astro",
    astro_if_after_fixed: "Astro wenn nach Fest",
    earliest: "Frühester",
    latest: "Spätester",
  },
  ui: {
    schedule: "Zeitplan",
    loading: "Zeitplandaten werden geladen...",
    entityNotFound: "Entität {entity} nicht gefunden",
    clickToEdit: "Klicken Sie auf einen Tag, um den Zeitplan zu bearbeiten",
    edit: "{weekday} bearbeiten",
    cancel: "Abbrechen",
    save: "Speichern",
    addTimeBlock: "+ Zeitblock hinzufügen",
    copySchedule: "Zeitplan kopieren",
    pasteSchedule: "Zeitplan einfügen",
    undo: "Rückgängig",
    redo: "Wiederholen",
    undoShortcut: "Rückgängig (Strg+Z)",
    redoShortcut: "Wiederholen (Strg+Y)",
    toggleCompactView: "Kompaktansicht",
    toggleFullView: "Vollansicht",
    exportSchedule: "Exportieren",
    importSchedule: "Importieren",
    exportTooltip: "Zeitplan als JSON-Datei exportieren",
    importTooltip: "Zeitplan aus JSON-Datei importieren",
    exportSuccess: "Zeitplan erfolgreich exportiert",
    importSuccess: "Zeitplan erfolgreich importiert",
    unsavedChanges: "Ungespeicherte Änderungen",
    saveAll: "Alle speichern",
    discard: "Verwerfen",
    enableDragDrop: "Drag & Drop Modus aktivieren",
    disableDragDrop: "Drag & Drop Modus deaktivieren",
    confirmDiscardChanges: "Sie haben ungespeicherte Änderungen. Möchten Sie diese verwerfen?",
    level: "Stufe",
    levelOn: "Ein",
    levelOff: "Aus",
    slat: "Lamellenposition",
    addEvent: "Ereignis hinzufügen",
    editEvent: "Ereignis bearbeiten",
    time: "Zeit",
    duration: "Dauer",
    rampTime: "Rampenzeit",
    state: "Zustand",
    weekdays: "Wochentage",
    channels: "Zielkanäle",
    condition: "Bedingung",
    astroSunrise: "Sonnenaufgang",
    astroSunset: "Sonnenuntergang",
    astroOffset: "Astro-Offset (Min.)",
    or: "oder",
    ifBefore: "wenn vor",
    ifAfter: "wenn nach",
    maxEntriesReached: "Maximale Anzahl an Einträgen erreicht ({max})",
    confirmDelete: "Möchten Sie dieses Ereignis wirklich löschen?",
  },
  errors: {
    failedToChangeProfile: "Fehler beim Wechseln des Profils: {error}",
    failedToSaveSchedule: "Fehler beim Speichern des Zeitplans: {error}",
    failedToPasteSchedule: "Fehler beim Einfügen des Zeitplans: {error}",
    invalidSchedule: "Ungültiger Zeitplan: {error}",
    failedToExport: "Fehler beim Exportieren des Zeitplans: {error}",
    failedToImport: "Fehler beim Importieren des Zeitplans: {error}",
    invalidImportFile: "Ungültiges Dateiformat. Bitte wählen Sie eine JSON-Datei.",
    invalidImportFormat: "Ungültiges JSON-Format in der Datei.",
    invalidImportData: "Ungültige Zeitplandaten: {error}",
    incompatibleEntity:
      "Entität {entity} ist keine kompatible Zeitplan-Entität (erfordert schedule_type 'default' und schedule_api_version 'v1.0')",
  },
  warnings: {
    title: "Validierungswarnungen",
    noWarnings: "Keine Probleme erkannt",
  },
};

const translations: Record<string, Translations> = {
  en,
  de,
};

export type SupportedLanguage = "en" | "de";

export function getTranslations(language: string): Translations {
  // Normalize language code (e.g., "en-US" -> "en", "de-DE" -> "de")
  const lang = language.toLowerCase().split("-")[0];

  // Return specific language or fallback to English
  return translations[lang] || translations.en;
}

export function formatString(template: string, params: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, value);
  }
  return result;
}

export function getDomainLabel(
  domain: import("@hmip/schedule-core").ScheduleDomain | undefined,
  lang: string,
): string {
  if (!domain) return "";
  const t = getTranslations(lang);
  return t.domains[domain] || domain;
}
