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

export interface HassUser {
  id: string;
  name: string;
  is_owner: boolean;
  is_admin: boolean;
}

export type PermissionScope = "schedule_edit" | "device_config" | "device_links" | "system_admin";

export interface UserPermissions {
  is_admin: boolean;
  permissions: PermissionScope[];
  backend: string | null;
}

export interface HomeAssistant {
  states: { [entity_id: string]: HassEntity };
  callWS: <T = unknown>(message: Record<string, unknown>) => Promise<T>;
  user?: HassUser;
  language?: string;
  locale?: { language: string };
  config: { language: string };
}
