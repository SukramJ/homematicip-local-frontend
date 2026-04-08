import type { HomeAssistant } from "@hmip/panel-api";

export interface ConfigEntryOption {
  value: string;
  label: string;
}

interface ConfigEntryResult {
  entry_id: string;
  title: string;
  domain: string;
}

/**
 * Fetch HomematicIP Local config entries and return them as select options.
 */
export async function fetchConfigEntryOptions(hass: HomeAssistant): Promise<ConfigEntryOption[]> {
  try {
    const entries = await hass.callWS<ConfigEntryResult[]>({
      type: "config_entries/get",
      domain: "homematicip_local",
    });
    return entries.map((entry) => ({
      value: entry.entry_id,
      label: entry.title,
    }));
  } catch {
    return [];
  }
}
