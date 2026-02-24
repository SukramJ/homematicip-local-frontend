# Changelog

## Unreleased

### Changed

- **Switch schedule cards to WebSocket API for V2 entities** (`climate-schedule-card`, `schedule-card`):
  V2 backend communication now uses `hass.callWS()` instead of `hass.callService()`.
  V1 entities continue to use service calls unchanged.
  - Climate card (V2): `set_climate_active_profile`, `set_climate_schedule_weekday`,
    `reload_device_config` use WebSocket endpoints
  - Schedule card: `set_device_schedule`, `reload_device_config` use WebSocket endpoints
  - All WebSocket calls require `entry_id` (from entity `config_entry_id` attribute)

- **Read-only mode for non-admin users** (`climate-schedule-card`, `schedule-card`):
  Cards are automatically read-only when `hass.user.is_admin` is `false`.
  Edit UI (weekday click, import button, paste, hint text) is hidden for non-admin users.
  Export and profile selector remain accessible to all users.
  The `editable` config flag continues to work and takes precedence when set to `false`.

- **Add `HassUser` type and `user` property to `HomeAssistant`** (`schedule-core`):
  New `HassUser` interface (`id`, `name`, `is_owner`, `is_admin`) and optional
  `user?: HassUser` on `HomeAssistant` for admin detection in cards.

- **Add `config_entry_id` to entity attribute types** (`schedule-core`):
  Added to both `ClimateScheduleEntityAttributes` and `DeviceScheduleEntityAttributes`
  for WebSocket API calls.
