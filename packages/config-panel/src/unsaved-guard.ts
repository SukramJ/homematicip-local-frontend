import type { ReactiveController, ReactiveControllerHost } from "lit";

/**
 * Returns the in-app navigation target of a click, or undefined if the click is
 * not an in-app navigation (modifier keys, external/download links, mailto, ...).
 *
 * Ported from Home Assistant's `isNavigationClick` (which took it from
 * polymer/pwa-helpers, BSD-3). HA ships no consumable sources for third-party
 * bundles, so the behaviour is mirrored rather than imported — most importantly
 * the `preventDefault()`, which is what makes HA's own router skip the click.
 */
export function isNavigationClick(e: MouseEvent, preventDefault = true): string | undefined {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) {
    return undefined;
  }

  const anchor = e.composedPath().find((n) => (n as HTMLElement).tagName === "A") as
    HTMLAnchorElement | undefined;
  if (
    !anchor ||
    anchor.target ||
    anchor.hasAttribute("download") ||
    anchor.getAttribute("rel") === "external"
  ) {
    return undefined;
  }

  let href = anchor.href;
  if (!href || href.includes("mailto:")) {
    return undefined;
  }

  const origin = window.location.origin;
  if (!href.startsWith(origin)) {
    return undefined;
  }
  href = href.slice(origin.length);

  if (href === "#") {
    return undefined;
  }

  if (preventDefault) {
    e.preventDefault();
  }
  return href;
}

interface UnsavedGuardOptions {
  /** Whether the host currently holds unsaved changes. */
  isDirty: () => boolean;
  /** Ask the user to discard. Resolves true when navigation may proceed. */
  promptDiscard: () => Promise<boolean>;
}

/**
 * Guards against losing unsaved changes when the user leaves the view by means
 * the view itself does not control: a click on HA's sidebar or any other in-app
 * link, and a browser reload/close.
 *
 * The view's own back button is not covered — it handles the prompt itself.
 *
 * The click listener runs in the capture phase and cancels the click while the
 * confirmation dialog is open. When the user discards, the listeners are removed
 * and the original click is replayed on its target so the navigation goes through.
 */
export class UnsavedGuard implements ReactiveController {
  private _host: ReactiveControllerHost;
  private _options: UnsavedGuardOptions;
  private _armed = false;

  constructor(host: ReactiveControllerHost, options: UnsavedGuardOptions) {
    this._host = host;
    this._options = options;
    host.addController(this);
  }

  hostUpdate(): void {
    if (this._options.isDirty()) {
      this._arm();
    } else {
      this._disarm();
    }
  }

  hostDisconnected(): void {
    this._disarm();
  }

  private _arm(): void {
    if (this._armed) return;
    window.addEventListener("click", this._handleClick, true);
    window.addEventListener("beforeunload", this._handleUnload);
    this._armed = true;
  }

  private _disarm(): void {
    if (!this._armed) return;
    window.removeEventListener("click", this._handleClick, true);
    window.removeEventListener("beforeunload", this._handleUnload);
    this._armed = false;
  }

  private _handleClick = async (e: MouseEvent): Promise<void> => {
    const target = e.composedPath()[0];
    if (!isNavigationClick(e)) {
      return;
    }

    if (!(await this._options.promptDiscard())) {
      return;
    }

    this._disarm();
    if (target) {
      target.dispatchEvent(new MouseEvent(e.type, e));
    }
  };

  private _handleUnload = (e: BeforeUnloadEvent): void => {
    e.preventDefault();
  };
}
