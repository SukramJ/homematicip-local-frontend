# Konzept: Granulare Berechtigungen für Nicht-Admin-Benutzer

## Motivation

Aktuell ist die gesamte Bearbeitungsfunktionalität der HomematicIP Local Integration an den HA-Admin-Status gekoppelt — allerdings nur im Frontend (UI-Kosmetik). Das Backend prüft keine Berechtigungen. In Mehrpersonenhaushalten sollen Nicht-Admins Teilfunktionen wie Zeitplanbearbeitung nutzen können, ohne volle Admin-Rechte zu benötigen.

## Ist-Zustand

### Frontend-Prüfungen (nur UI)

| Komponente            | Prüfung                                     | Datei        |
| --------------------- | ------------------------------------------- | ------------ |
| climate-schedule-card | `hass?.user?.is_admin !== false`            | `card.ts:48` |
| schedule-card         | `hass?.user?.is_admin !== false`            | `card.ts:48` |
| config-panel          | Keine Prüfung (Panel ist admin-only via HA) | —            |

### Backend-Prüfungen

**Keine.** Weder Service-Calls noch WebSocket-Endpoints prüfen den User-Context. Ein Nicht-Admin könnte jeden Service über die Entwicklerwerkzeuge aufrufen.

### API-Endpoints (vollständig)

**Service-Calls** (HACS Cards via `hass.callService`):

| Service                        | Typ       | Risiko  |
| ------------------------------ | --------- | ------- |
| `get_schedule_profile`         | Lesen     | Niedrig |
| `get_schedule`                 | Lesen     | Niedrig |
| `set_schedule_weekday`         | Schreiben | Mittel  |
| `set_current_schedule_profile` | Schreiben | Mittel  |
| `set_schedule`                 | Schreiben | Mittel  |
| `reload_device_config`         | Schreiben | Mittel  |

**WebSocket-Endpoints** (Config Panel via `hass.callWS`):

| Endpoint                                  | Typ       | Risiko   |
| ----------------------------------------- | --------- | -------- |
| `list_devices`                            | Lesen     | Niedrig  |
| `get_form_schema`                         | Lesen     | Niedrig  |
| `get_paramset`                            | Lesen     | Niedrig  |
| `list_schedule_devices`                   | Lesen     | Niedrig  |
| `get_climate_schedule`                    | Lesen     | Niedrig  |
| `get_device_schedule`                     | Lesen     | Niedrig  |
| `list_device_links`                       | Lesen     | Niedrig  |
| `get_link_form_schema`                    | Lesen     | Niedrig  |
| `get_link_paramset`                       | Lesen     | Niedrig  |
| `get_linkable_channels`                   | Lesen     | Niedrig  |
| `get_change_history`                      | Lesen     | Niedrig  |
| `get_link_profiles`                       | Lesen     | Niedrig  |
| `export_paramset`                         | Lesen     | Niedrig  |
| `set_climate_schedule_weekday`            | Schreiben | Mittel   |
| `set_climate_active_profile`              | Schreiben | Mittel   |
| `set_device_schedule`                     | Schreiben | Mittel   |
| `reload_device_config`                    | Schreiben | Mittel   |
| `put_paramset`                            | Schreiben | Hoch     |
| `session_open/set/undo/redo/save/discard` | Schreiben | Hoch     |
| `import_paramset`                         | Schreiben | Hoch     |
| `put_link_paramset`                       | Schreiben | Hoch     |
| `add_link`                                | Schreiben | Hoch     |
| `remove_link`                             | Schreiben | Hoch     |
| `clear_change_history`                    | Schreiben | Hoch     |
| Panel-API (install mode, backup, etc.)    | System    | Kritisch |

---

## Berechtigungsmodell

### Permission Scopes

Vier Berechtigungsstufen, aufsteigend nach Risiko:

| Scope           | Beschreibung                   | Enthaltene Operationen                                 |
| --------------- | ------------------------------ | ------------------------------------------------------ |
| `schedule_edit` | Zeitpläne lesen und bearbeiten | `*_schedule*`, `reload_device_config`                  |
| `device_config` | Geräteparameter konfigurieren  | `*_paramset*`, `session_*`, `import/export_paramset`   |
| `device_links`  | Direktverknüpfungen verwalten  | `*_link*`, `get_linkable_channels`                     |
| `system_admin`  | Systemverwaltung               | Install mode, Backup, Firmware, `clear_change_history` |

**Regeln:**

- **Admin-User**: Haben immer alle Scopes — keine Einschränkung möglich.
- **Nicht-Admin-User**: Haben standardmäßig **keine** Scopes. Nur explizit freigegebene Scopes werden gewährt.
- **Lese-Operationen**: Immer erlaubt für alle authentifizierten User (keine Scope-Prüfung). Wer eine Entität oder das Panel sehen kann, darf auch die Daten lesen.
- **Owner**: Wie Admin — alle Scopes.

### Konfiguration

Integration-Level-Einstellung im Config Flow (Options):

```python
# homematicip_local config_flow.py — Options Flow
NON_ADMIN_PERMISSIONS = "non_admin_permissions"

# Possible values: ["schedule_edit", "device_config", "device_links"]
# "system_admin" is NOT selectable — always admin-only.
# Default: [] (no permissions for non-admins)
```

**UI im HA Options-Dialog:**

```
Berechtigungen für Nicht-Admin-Benutzer
☑ Zeitpläne bearbeiten (schedule_edit)
☐ Geräteparameter konfigurieren (device_config)
☐ Direktverknüpfungen verwalten (device_links)
```

Typischer Anwendungsfall: Nur `schedule_edit` wird aktiviert → Haushaltsmitglieder können Heizungszeitpläne ändern, aber keine Gerätekonfiguration manipulieren.

---

## Backend-Implementierung (homematicip_local)

### 1. Permission Helpers

Zwei separate Funktionen für die beiden Aufrufkontexte (Service-Calls und WebSocket), statt eines fragilen Union-Parameters:

```python
# homematicip_local/permissions.py

from homeassistant.core import HomeAssistant
from homeassistant.auth.models import User
from homeassistant.exceptions import Unauthorized

SCOPE_SCHEDULE_EDIT = "schedule_edit"
SCOPE_DEVICE_CONFIG = "device_config"
SCOPE_DEVICE_LINKS = "device_links"
SCOPE_SYSTEM_ADMIN = "system_admin"

ALL_NON_ADMIN_SCOPES = [
    SCOPE_SCHEDULE_EDIT,
    SCOPE_DEVICE_CONFIG,
    SCOPE_DEVICE_LINKS,
]


def _check_user_scope(
    *,
    hass: HomeAssistant,
    user: User,
    entry_id: str,
    required_scope: str,
) -> None:
    """Check whether a user holds the required scope. Raise Unauthorized if not."""
    # Admin/Owner — always permitted
    if user.is_admin or user.is_owner:
        return

    # system_admin — never for non-admins
    if required_scope == SCOPE_SYSTEM_ADMIN:
        raise Unauthorized()

    # Check configured scopes from integration options
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None:
        raise Unauthorized()

    allowed_scopes: list[str] = entry.options.get("non_admin_permissions", [])
    if required_scope not in allowed_scopes:
        raise Unauthorized()


async def check_service_permission(
    *,
    hass: HomeAssistant,
    entry_id: str,
    user_id: str | None,
    required_scope: str,
) -> None:
    """Check permission for a service call context."""
    # System call (automation, script) — always permitted
    if user_id is None:
        return

    user = await hass.auth.async_get_user(user_id)
    if user is None:
        raise Unauthorized()

    _check_user_scope(
        hass=hass,
        user=user,
        entry_id=entry_id,
        required_scope=required_scope,
    )


def check_ws_permission(
    *,
    hass: HomeAssistant,
    entry_id: str,
    user: User,
    required_scope: str,
) -> None:
    """Check permission for a WebSocket connection."""
    _check_user_scope(
        hass=hass,
        user=user,
        entry_id=entry_id,
        required_scope=required_scope,
    )
```

### 2. WebSocket-Decorator

Analog zu HA's `@websocket_api.require_admin`, ein eigener Decorator für Scope-Prüfungen:

```python
# homematicip_local/permissions.py (continued)

from collections.abc import Callable, Coroutine
from functools import wraps
from typing import Any

from homeassistant.components import websocket_api


def require_scope(scope: str) -> Callable:
    """Decorate a WebSocket handler to require a permission scope."""

    def decorator(
        func: Callable[
            [HomeAssistant, websocket_api.ActiveConnection, dict[str, Any]],
            Coroutine[Any, Any, None],
        ],
    ) -> Callable:
        @wraps(func)
        async def wrapper(
            hass: HomeAssistant,
            connection: websocket_api.ActiveConnection,
            msg: dict[str, Any],
        ) -> None:
            """Check scope before calling the handler."""
            try:
                check_ws_permission(
                    hass=hass,
                    entry_id=msg["entry_id"],
                    user=connection.user,
                    required_scope=scope,
                )
            except Unauthorized:
                connection.send_error(
                    msg["id"], "unauthorized", "Insufficient permissions"
                )
                return
            await func(hass, connection, msg)

        return wrapper

    return decorator
```

### 3. Service-Call-Absicherung

```python
# Example: set_schedule_weekday service handler

async def async_handle_set_schedule_weekday(call: ServiceCall) -> None:
    """Handle set_schedule_weekday service call."""
    entry_id = _resolve_entry_id(call)
    await check_service_permission(
        hass=hass,
        entry_id=entry_id,
        user_id=call.context.user_id,
        required_scope=SCOPE_SCHEDULE_EDIT,
    )
    # ... existing logic ...
```

**Zuordnung Service → Scope:**

| Service                        | Scope                      |
| ------------------------------ | -------------------------- |
| `set_schedule_weekday`         | `schedule_edit`            |
| `set_current_schedule_profile` | `schedule_edit`            |
| `set_schedule`                 | `schedule_edit`            |
| `reload_device_config`         | `schedule_edit`            |
| `get_schedule_profile`         | — (read, always permitted) |
| `get_schedule`                 | — (read, always permitted) |

### 4. WebSocket-Endpoint-Absicherung

```python
# Example: set_climate_schedule_weekday WebSocket handler

@websocket_api.websocket_command({
    vol.Required("type"): "homematicip_local/config/set_climate_schedule_weekday",
    ...
})
@require_scope(SCOPE_SCHEDULE_EDIT)
@callback
async def handle_set_climate_schedule_weekday(hass, connection, msg):
    """Handle set_climate_schedule_weekday WebSocket command."""
    # ... existing logic (permission already checked by decorator) ...
```

**Zuordnung WebSocket → Scope:**

| Endpoint                                  | Scope                |
| ----------------------------------------- | -------------------- |
| `set_climate_schedule_weekday`            | `schedule_edit`      |
| `set_climate_active_profile`              | `schedule_edit`      |
| `set_device_schedule`                     | `schedule_edit`      |
| `reload_device_config`                    | `schedule_edit`      |
| `put_paramset`                            | `device_config`      |
| `session_open/set/undo/redo/save/discard` | `device_config`      |
| `import_paramset`                         | `device_config`      |
| `put_link_paramset`                       | `device_links`       |
| `add_link`                                | `device_links`       |
| `remove_link`                             | `device_links`       |
| `clear_change_history`                    | `system_admin`       |
| Panel-API (install mode, backup, etc.)    | `system_admin`       |
| Alle `get_*` / `list_*` / `export_*`      | — (always permitted) |

### 5. Neuer WebSocket-Endpoint: User-Permissions abfragen

```python
@websocket_api.websocket_command({
    vol.Required("type"): "homematicip_local/config/get_user_permissions",
    vol.Required("entry_id"): str,
})
@callback
async def handle_get_user_permissions(hass, connection, msg):
    """Return the effective permissions for the current user."""
    user = connection.user
    entry = hass.config_entries.async_get_entry(msg["entry_id"])

    if user.is_admin or user.is_owner:
        scopes = [SCOPE_SCHEDULE_EDIT, SCOPE_DEVICE_CONFIG, SCOPE_DEVICE_LINKS, SCOPE_SYSTEM_ADMIN]
    else:
        scopes = list(entry.options.get("non_admin_permissions", []))

    connection.send_result(msg["id"], {
        "is_admin": user.is_admin,
        "permissions": scopes,
    })
```

---

## Frontend-Implementierung

### 1. Permission-Typ und API-Funktion

```typescript
// @hmip/schedule-core — models/common-types.ts

type PermissionScope = "schedule_edit" | "device_config" | "device_links" | "system_admin";

interface UserPermissions {
  is_admin: boolean;
  permissions: PermissionScope[];
}
```

```typescript
// config-panel/src/api.ts

export async function getUserPermissions(
  hass: HomeAssistant,
  entryId: string,
): Promise<UserPermissions> {
  return hass.callWS<UserPermissions>({
    type: "homematicip_local/config/get_user_permissions",
    entry_id: entryId,
  });
}
```

### 2. HACS Cards (climate-schedule-card, schedule-card)

Die Cards nutzen Service-Calls, nicht WebSocket. Sie können `get_user_permissions` nicht aufrufen (kein `entry_id`). Stattdessen:

**Optimistischer Ansatz:** Card zeigt Edit-UI immer an (wenn `editable: true`). Wenn der User keine Berechtigung hat, lehnt das Backend den Service-Call ab → Card zeigt Fehlermeldung.

```typescript
// card.ts — simplify _isEditable
private get _isEditable(): boolean {
  return this._config?.editable ?? true;
  // Backend enforces permissions — no frontend check needed
}
```

**Fehlerbehandlung:**

```typescript
try {
  await this._adapter.setScheduleWeekday({ ... });
} catch (err) {
  if (err.message?.includes("Unauthorized")) {
    this._showError(this._translations.errors.insufficientPermissions);
  } else {
    this._showError(formatString(this._translations.errors.failedToSaveSchedule, { error: String(err) }));
  }
}
```

### 3. Config Panel

Das Panel hat Zugriff auf `entry_id` und kann Permissions beim Laden abfragen:

```typescript
// homematic-config.ts

@state() private _permissions?: UserPermissions;

async connectedCallback() {
  super.connectedCallback();
  this._permissions = await getUserPermissions(this.hass, this._entryId);
}
```

**UI-Anpassung pro View:**

| View                  | Scope           | Verhalten ohne Scope                                       |
| --------------------- | --------------- | ---------------------------------------------------------- |
| Device Schedule       | `schedule_edit` | Zeitpläne sichtbar, aber `editable=false` (read-only)      |
| Channel Config        | `device_config` | Paramsets sichtbar, aber keine Speichern-/Import-Buttons   |
| Device Links          | `device_links`  | Links sichtbar, aber keine Add/Remove/Edit-Buttons         |
| Integration Dashboard | `system_admin`  | Incidents/Cache sichtbar, aber keine Clear-/Manage-Buttons |
| OpenCCU Dashboard     | `system_admin`  | Alles read-only (kein Install Mode, kein Backup)           |

**Config Panel Sichtbarkeit:**

Aktuell ist das Config Panel als admin-only Panel registriert. Damit Nicht-Admins es nutzen können, muss das Panel mit `require_admin=False` registriert werden:

```python
# __init__.py
async_register_panel(
    hass,
    frontend_url_path=f"homematicip-local-{entry_id}",
    webcomponent_name="homematic-config",
    config={
        "_panel_custom": {
            "name": "homematic-config",
            "module_url": f"/api/homematicip_local/{entry_id}/frontend/homematic-config.js",
        }
    },
    sidebar_title="HM Geräte",
    sidebar_icon="mdi:chip",
    require_admin=False,
)
```

Die granulare Zugriffskontrolle erfolgt dann im Panel selbst basierend auf `_permissions`.

**Hinweis:** Nicht-Admins ohne jegliche Scopes sehen den Devices-Tab im Read-only-Modus (Geräteinformationen, Paramsets lesen). Ein leeres Panel wird vermieden, da Lese-Operationen immer erlaubt sind.

### 4. Tab-Sichtbarkeit im Config Panel

```typescript
// Tab navigation based on permissions
private _getVisibleTabs(): Tab[] {
  const tabs: Tab[] = [{ id: "devices", label: "Geräte" }];

  if (this._hasPermission("system_admin")) {
    tabs.push({ id: "integration", label: "Integration" });
    tabs.push({ id: "ccu", label: "OpenCCU" });
  }

  return tabs;
}

private _hasPermission(scope: PermissionScope): boolean {
  if (!this._permissions) return false;
  return this._permissions.is_admin || this._permissions.permissions.includes(scope);
}
```

---

## Neue Translations

### schedule-core (en/de)

```typescript
errors: {
  // ...existing...
  insufficientPermissions: "You don't have permission to perform this action.",
  // DE: "Sie haben keine Berechtigung für diese Aktion."
}
```

### config-panel (en.json / de.json)

```json
{
  "permissions": {
    "read_only_notice": "You have read-only access. Contact an admin for edit permissions.",
    "schedule_edit_required": "Schedule editing permission required.",
    "device_config_required": "Device configuration permission required.",
    "device_links_required": "Device link management permission required."
  }
}
```

---

## Migrationspfad

### Phase 1: Backend-Absicherung (homematicip_local)

1. `permissions.py` mit `check_service_permission()`, `check_ws_permission()` und `@require_scope` Decorator erstellen
2. Alle schreibenden Service-Calls mit `check_service_permission()` absichern
3. Alle schreibenden WebSocket-Endpoints mit `@require_scope` Decorator absichern
4. `get_user_permissions` Endpoint hinzufügen
5. Config-Flow Options um `non_admin_permissions` erweitern
6. Default: `[]` — bestehende Installationen sind nicht betroffen

**Ergebnis:** Backend ist abgesichert. Nicht-Admins bekommen `Unauthorized` bei Schreibzugriffen. Frontend zeigt noch die alte Admin-Prüfung.

### Phase 2: Frontend-Anpassung (dieses Repo)

1. Admin-Check in Cards entfernen (`_isEditable` vereinfachen)
2. Fehlerbehandlung für `Unauthorized` in Cards hinzufügen
3. `getUserPermissions()` API-Funktion im Config Panel
4. Config Panel Views: Read-only-Modus basierend auf Permissions
5. Panel-Registrierung auf `require_admin=False` ändern
6. Translations für Berechtigungsmeldungen

**Ergebnis:** Nicht-Admins mit `schedule_edit` Scope können Zeitpläne bearbeiten. Alle anderen Funktionen bleiben gesperrt.

---

## Sequenzdiagramm: Nicht-Admin editiert Zeitplan

```
User (Non-Admin)          Frontend (Card)           Backend (HA)
     │                         │                         │
     │  Öffnet Dashboard       │                         │
     │────────────────────────>│                         │
     │                         │  Card rendert mit       │
     │                         │  editable=true          │
     │                         │  (kein Admin-Check)     │
     │                         │                         │
     │  Ändert Zeitplan        │                         │
     │────────────────────────>│                         │
     │                         │  callService(           │
     │                         │    "set_schedule_weekday")
     │                         │────────────────────────>│
     │                         │                         │  check_service_permission(
     │                         │                         │    user_id, "schedule_edit")
     │                         │                         │
     │                         │                         │  ✅ Scope erlaubt
     │                         │                         │  → Zeitplan gespeichert
     │                         │  success                │
     │                         │<────────────────────────│
     │  "Gespeichert"          │                         │
     │<────────────────────────│                         │
```

```
User (Non-Admin)          Frontend (Card)           Backend (HA)
     │                         │                         │
     │  Ändert Zeitplan        │                         │
     │────────────────────────>│                         │
     │                         │  callService(           │
     │                         │    "set_schedule_weekday")
     │                         │────────────────────────>│
     │                         │                         │  check_service_permission(
     │                         │                         │    user_id, "schedule_edit")
     │                         │                         │
     │                         │                         │  ❌ Scope nicht erlaubt
     │                         │                         │  → Unauthorized
     │                         │  error: Unauthorized    │
     │                         │<────────────────────────│
     │  "Keine Berechtigung"   │                         │
     │<────────────────────────│                         │
```

---

## Zusammenfassung

| Aspekt                                        | Lösung                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| **Wo werden Rechte geprüft?**                 | Backend (Service-Calls + WebSocket) — nicht umgehbar                           |
| **Wie werden WebSocket-Endpoints geschützt?** | `@require_scope` Decorator (analog zu HA's `@require_admin`)                   |
| **Wie werden Service-Calls geschützt?**       | `check_service_permission()` mit explizitem `user_id`                          |
| **Wo werden Rechte konfiguriert?**            | Integration Options (Config Flow) — pro Integration-Instanz                    |
| **Was ist der Default?**                      | Nicht-Admins haben keine Schreibrechte (kein Breaking Change)                  |
| **Wie erfährt das Frontend die Rechte?**      | Cards: optimistisch + Fehlerbehandlung. Panel: `get_user_permissions` Endpoint |
| **Welche Scopes gibt es?**                    | `schedule_edit`, `device_config`, `device_links`, `system_admin`               |
| **Was ist immer erlaubt?**                    | Alle Lese-Operationen für authentifizierte User                                |
| **Was ist nie für Nicht-Admins?**             | `system_admin` (Install Mode, Backup, etc.)                                    |
