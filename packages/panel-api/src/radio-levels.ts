import type { HomeAssistant, HassEntity } from "./types";

export interface RadioLevel {
  name: string;
  dutyCycle: number | null;
  carrierSense: number | null;
}

/**
 * Load entity IDs belonging to a specific config entry from the entity registry.
 */
export async function loadEntryEntityIds(
  hass: HomeAssistant,
  entryId: string,
): Promise<Set<string> | undefined> {
  try {
    const entries = await hass.callWS<Array<{ entity_id: string; config_entry_id: string }>>({
      type: "config/entity_registry/list",
    });
    return new Set(entries.filter((e) => e.config_entry_id === entryId).map((e) => e.entity_id));
  } catch {
    return undefined;
  }
}

/**
 * Extract Duty Cycle and Carrier Sense levels from hass.states,
 * grouped by device. Filters by entryEntityIds if provided.
 */
export function getRadioLevels(
  states: Record<string, HassEntity> | undefined,
  entryEntityIds: Set<string> | undefined,
): RadioLevel[] {
  if (!states) return [];

  const deviceMap = new Map<string, RadioLevel>();

  for (const [entityId, entity] of Object.entries(states)) {
    if (!entityId.startsWith("sensor.")) continue;

    const isDutyCycle = entityId.endsWith("_duty_cycle_level");
    const isCarrierSense = entityId.endsWith("_carrier_sense_level");
    if (!isDutyCycle && !isCarrierSense) continue;

    if (entryEntityIds && !entryEntityIds.has(entityId)) continue;

    const attrs = entity.attributes;
    const name = (attrs?.friendly_name as string) || entityId;
    const deviceKey = entityId.replace(/_(?:duty_cycle|carrier_sense)_level$/, "");
    const deviceName = name
      .replace(/\s*Duty Cycle Level$/i, "")
      .replace(/\s*Carrier Sense Level$/i, "")
      .replace(/\s*DutyCycle Level$/i, "")
      .replace(/\s*CarrierSense Level$/i, "");

    if (!deviceMap.has(deviceKey)) {
      deviceMap.set(deviceKey, { name: deviceName, dutyCycle: null, carrierSense: null });
    }
    const entry = deviceMap.get(deviceKey)!;

    const value = parseFloat(entity.state);
    if (!isNaN(value)) {
      if (isDutyCycle) entry.dutyCycle = value;
      if (isCarrierSense) entry.carrierSense = value;
    }
  }

  return [...deviceMap.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** CSS class for Duty Cycle level severity. */
export function dcLevelClass(value: number | null): string {
  if (value === null) return "";
  if (value >= 80) return "error";
  if (value >= 60) return "warning";
  return "";
}

/** CSS class for Carrier Sense level severity. */
export function csLevelClass(value: number | null): string {
  if (value === null) return "";
  if (value >= 10) return "error";
  return "";
}
