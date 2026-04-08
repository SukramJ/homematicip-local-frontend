export interface StatusCardTranslations {
  // System Health
  systemHealth: string;
  centralState: string;
  healthScore: string;
  devices: string;
  unreachable: string;
  firmwareUpdates: string;
  incidents: string;
  noIncidents: string;
  throttleActive: string;
  dutyCycle: string;
  carrierSense: string;

  // Device Status
  deviceStatus: string;
  problems: string;
  allDevicesOk: string;
  notReachable: string;
  lowBattery: string;
  configPending: string;
  devicesOk: string;
  noDevices: string;

  // Messages
  messages: string;
  alarms: string;
  serviceMessages: string;
  acknowledge: string;
  noMessages: string;
  noAlarms: string;

  // Common
  loading: string;
  error: string;
  refresh: string;
}

const translations: Record<string, StatusCardTranslations> = {
  en: {
    systemHealth: "System Health",
    centralState: "Status",
    healthScore: "Health",
    devices: "Devices",
    unreachable: "Unreachable",
    firmwareUpdates: "FW Updates",
    incidents: "Incidents",
    noIncidents: "No incidents",
    throttleActive: "Throttle active",
    dutyCycle: "Duty Cycle",
    carrierSense: "Carrier Sense",

    deviceStatus: "Device Status",
    problems: "Problems",
    allDevicesOk: "All devices OK",
    notReachable: "Not reachable",
    lowBattery: "Low battery",
    configPending: "Config pending",
    devicesOk: "{count} devices OK",
    noDevices: "No devices found",

    messages: "Messages",
    alarms: "Alarms",
    serviceMessages: "Service",
    acknowledge: "Acknowledge",
    noMessages: "No service messages",
    noAlarms: "No alarms",

    loading: "Loading...",
    error: "Error loading data",
    refresh: "Refresh",
  },
  de: {
    systemHealth: "Systemstatus",
    centralState: "Status",
    healthScore: "Zustand",
    devices: "Geräte",
    unreachable: "Nicht erreichbar",
    firmwareUpdates: "FW-Updates",
    incidents: "Vorfälle",
    noIncidents: "Keine Vorfälle",
    throttleActive: "Drosselung aktiv",
    dutyCycle: "Duty Cycle",
    carrierSense: "Carrier Sense",

    deviceStatus: "Gerätestatus",
    problems: "Probleme",
    allDevicesOk: "Alle Geräte OK",
    notReachable: "Nicht erreichbar",
    lowBattery: "Batterie niedrig",
    configPending: "Konfiguration ausstehend",
    devicesOk: "{count} Geräte OK",
    noDevices: "Keine Geräte gefunden",

    messages: "Meldungen",
    alarms: "Alarme",
    serviceMessages: "Service",
    acknowledge: "Quittieren",
    noMessages: "Keine Servicemeldungen",
    noAlarms: "Keine Alarme",

    loading: "Laden...",
    error: "Fehler beim Laden",
    refresh: "Aktualisieren",
  },
};

export function getStatusTranslations(language: string): StatusCardTranslations {
  return translations[language] || translations["en"];
}

export function formatString(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? key));
}
