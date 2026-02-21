/**
 * Common type definitions shared across climate and device schedule components.
 */

export const WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HomeAssistant {
  states: { [entity_id: string]: HassEntity };
  callService: (
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ) => Promise<void>;
  callWS: <T = unknown>(message: Record<string, unknown>) => Promise<T>;
  language?: string;
  locale?: { language: string };
  config: { language: string };
}
