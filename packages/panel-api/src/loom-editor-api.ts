/**
 * The integration's relay for openccu-loom's device editor component.
 *
 * On the loom backend the panel hosts the daemon's own editor, the
 * `<loom-device-editor>` web component (openccu-loom ADR 0089). The component
 * makes no network call of its own: the panel hands it a transport, and every
 * REST call it makes travels as `homematicip_local/loom/editor/request`. The
 * integration forwards it with the entry's stored credential, so neither the
 * daemon's address nor its token reaches the browser.
 *
 * Both commands are admin-only and accept loom entries only
 * (homematicip_local `loom_editor.py`).
 */
import type { HomeAssistant } from "./types";

/** `homematicip_local/loom/editor/manifest`: whether the entry's daemon serves the editor. */
export interface LoomEditorManifest {
  available: boolean;
  /** Served from Home Assistant's own origin, one URL per entry and module hash. */
  module_url: string | null;
}

/** One REST call of the editor, as the component hands it to its transport. */
export interface LoomEditorRequest {
  method: string;
  /** Below `/api/v1`, without a query string. */
  path: string;
  query: Record<string, string>;
  /** Carries the edit lock (`X-Edit-Token`) a MASTER write needs; must reach the daemon. */
  headers: Record<string, string>;
  /** Decoded JSON; the shape belongs to the daemon route, so it is forwarded undecided. */
  body?: unknown;
}

/** The daemon's answer, for every HTTP status. */
export interface LoomEditorResponse {
  status: number;
  body?: unknown;
}

/**
 * The transport `<loom-device-editor>` takes. `subscribe` (the daemon's raw
 * event stream) is optional in the component's contract and not offered yet:
 * without it the editor shows what it loaded and what its own writes return.
 */
export interface LoomEditorTransport {
  request(req: LoomEditorRequest): Promise<LoomEditorResponse>;
}

export async function getLoomEditorManifest(
  hass: HomeAssistant,
  entryId: string,
): Promise<LoomEditorManifest> {
  return hass.callWS<LoomEditorManifest>({
    type: "homematicip_local/loom/editor/manifest",
    entry_id: entryId,
  });
}

/**
 * Relays one editor call. Resolves with the daemon's status and body whatever
 * the status is — a 409, 422 or 423 is something the editor shows. Rejects
 * only with the relay's own errors: the daemon was not reached, or the relay
 * refused the call (route outside the manifest, foreign central).
 */
export async function loomEditorRequest(
  hass: HomeAssistant,
  entryId: string,
  req: LoomEditorRequest,
): Promise<LoomEditorResponse> {
  const message: Record<string, unknown> = {
    type: "homematicip_local/loom/editor/request",
    entry_id: entryId,
    method: req.method,
    path: req.path,
    query: req.query,
    headers: req.headers,
  };
  // A GET carries no body; sending `body: undefined` would serialise as a
  // missing key anyway, but an explicit `null` would reach the daemon as one.
  if (req.body !== undefined) message.body = req.body;
  return hass.callWS<LoomEditorResponse>(message);
}

/**
 * A transport bound to one config entry. `hass` is read on every call: Home
 * Assistant replaces the object on each state change, and the component keeps
 * the transport for its whole life.
 */
export function createLoomEditorTransport(
  hass: () => HomeAssistant,
  entryId: string,
): LoomEditorTransport {
  return {
    request: (req) => loomEditorRequest(hass(), entryId, req),
  };
}
