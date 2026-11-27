/**
 * Where a `loom-navigate` event of `<loom-device-editor>` leads in this panel.
 *
 * The component does not follow its own links; it reports the daemon UI's
 * hash route and leaves the decision to the host (openccu-loom ADR 0089). The
 * grammar is the daemon SPA's router (`assets/ui/src/App.svelte`):
 * `#/devices`, `#/devices/<address>[/channels/<n>][?tab=<sub>]`, and the
 * link pages `#/links/<sender>/<receiver>` and `#/links/new?…`
 * (`assets/ui/src/lib/links/link-routes.ts`).
 *
 * The component ships the device page only — configuration, channels, links,
 * schedule, change log. The link profile page and the link wizard are not part
 * of it, so a route to either lands on the links tab of the device it starts
 * from, and the caller tells the user why.
 */

export type LoomTarget =
  | { kind: "device-list" }
  | {
      kind: "device";
      address: string;
      channel?: number;
      sub?: string;
      /** Set when the route named a page the component does not ship. */
      fallbackFrom?: "link-profile" | "link-wizard";
    }
  | { kind: "unsupported"; route: string };

/** Device address of a channel address (`ADDR:3` → `ADDR`). */
function deviceOf(channelAddress: string): string {
  const i = channelAddress.lastIndexOf(":");
  return i < 0 ? channelAddress : channelAddress.slice(0, i);
}

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function resolveLoomRoute(route: string): LoomTarget {
  const unsupported: LoomTarget = { kind: "unsupported", route };
  const raw = route.startsWith("#") ? route.slice(1) : route;
  const q = raw.indexOf("?");
  const path = q < 0 ? raw : raw.slice(0, q);
  const params = new URLSearchParams(q < 0 ? "" : raw.slice(q + 1));

  if (/^\/devices\/?$/.test(path)) return { kind: "device-list" };

  const device = /^\/devices\/([^/]+)(?:\/channels\/(\d+))?\/?$/.exec(path);
  if (device) {
    const address = decode(device[1]);
    if (!address) return unsupported;
    const target: LoomTarget = { kind: "device", address };
    if (device[2] !== undefined) target.channel = Number(device[2]);
    const sub = params.get("tab");
    if (sub) target.sub = sub;
    return target;
  }

  if (/^\/links\/new\/?$/.test(path)) {
    const anchor = params.get("device") ?? params.get("sender") ?? params.get("receiver");
    if (!anchor) return unsupported;
    return { kind: "device", address: deviceOf(anchor), sub: "links", fallbackFrom: "link-wizard" };
  }

  const link = /^\/links\/([^/]+)\/([^/]+)\/?$/.exec(path);
  if (link) {
    const sender = decode(link[1]);
    if (!sender) return unsupported;
    return {
      kind: "device",
      address: deviceOf(sender),
      sub: "links",
      fallbackFrom: "link-profile",
    };
  }

  return unsupported;
}
