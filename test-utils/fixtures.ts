/**
 * Typed builders for the payloads the backend sends over the WebSocket API.
 *
 * Each builder returns a complete, valid object and merges the overrides a test
 * cares about, so a test states only what is relevant to it. Because the return
 * types come from `@hmip/panel-api`, a backend contract change breaks the
 * fixtures at compile time instead of producing silently wrong test data.
 */
import type {
  ChannelInfo,
  DeviceInfo,
  FormParameter,
  FormSchema,
  FormSection,
  MaintenanceData,
  UserPermissions,
} from "@hmip/panel-api";

export function maintenance(overrides: Partial<MaintenanceData> = {}): MaintenanceData {
  return {
    unreach: false,
    low_bat: false,
    dutycycle: false,
    config_pending: false,
    ...overrides,
  };
}

export function channelInfo(overrides: Partial<ChannelInfo> = {}): ChannelInfo {
  return {
    address: "VCU0000001:1",
    channel_type: "SWITCH_VIRTUAL_RECEIVER",
    channel_type_label: "Switch",
    paramset_keys: ["MASTER", "VALUES"],
    ...overrides,
  };
}

export function deviceInfo(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    address: "VCU0000001",
    interface: "HmIP-RF",
    interface_id: "ccu-HmIP-RF",
    model: "HmIP-BSM",
    model_description: "Brand Switch and Meter Actuator",
    name: "Living Room Switch",
    firmware: "1.16.6",
    channels: [channelInfo()],
    maintenance: maintenance(),
    ...overrides,
  };
}

export function formParameter(overrides: Partial<FormParameter> = {}): FormParameter {
  return {
    id: "GLOBAL_BUTTON_LOCK",
    label: "Global button lock",
    type: "boolean",
    widget: "switch",
    current_value: false,
    writable: true,
    modified: false,
    ...overrides,
  };
}

export function formSection(overrides: Partial<FormSection> = {}): FormSection {
  return {
    id: "general",
    title: "General",
    parameters: [formParameter()],
    ...overrides,
  };
}

export function formSchema(overrides: Partial<FormSchema> = {}): FormSchema {
  const sections = overrides.sections ?? [formSection()];
  const parameters = sections.flatMap((section) => section.parameters);
  return {
    channel_address: "VCU0000001:1",
    channel_type: "SWITCH_VIRTUAL_RECEIVER",
    channel_type_label: "Switch",
    total_parameters: parameters.length,
    writable_parameters: parameters.filter((parameter) => parameter.writable).length,
    ...overrides,
    sections,
  };
}

export function userPermissions(overrides: Partial<UserPermissions> = {}): UserPermissions {
  return {
    is_admin: true,
    permissions: [],
    backend: "CCU",
    ...overrides,
  };
}
