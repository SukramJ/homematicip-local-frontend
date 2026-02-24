# Changelog

## Unreleased

### Changed

- **Climate card: switch profiles via WebSocket instead of service call** (`climate-schedule-card`):
  For v2 entities, `_callSetActiveProfile` now uses `hass.callWS()` with the
  `homematicip_local/config/set_climate_active_profile` WebSocket endpoint instead of
  `hass.callService("homematicip_local", "set_current_schedule_profile")`.
  The `config_entry_id` is read from the entity attributes. V1 profile switching
  remains unchanged (service call).

- **Add `config_entry_id` to `ClimateScheduleEntityAttributes`** (`schedule-core`):
  New optional attribute used by the climate card to resolve the config entry
  for WebSocket API calls.
