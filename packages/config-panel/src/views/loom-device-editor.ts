import { LitElement, html, css, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { localize } from "../localize";
import { createLoomEditorTransport, getLoomEditorManifest } from "@hmip/panel-api";
import type { LoomEditorTransport } from "@hmip/panel-api";
import type { HomeAssistant } from "../types";

/** The properties `<loom-device-editor>` takes (openccu-loom ADR 0089). */
interface LoomDeviceEditorElement extends HTMLElement {
  transport: LoomEditorTransport;
  address: string;
  channel: number | undefined;
  sub: string | undefined;
  locale: string;
  dark: boolean;
  skin: "ha" | "loom";
}

type LoadState = "idle" | "loading" | "ready" | "unavailable" | "failed";

/**
 * Hosts openccu-loom's own device editor for a loom-backed entry.
 *
 * The daemon ships its device page — configuration, channels, direct links,
 * schedule, change log — as the web component `<loom-device-editor>`. The
 * integration serves the module from Home Assistant's origin
 * (`homematicip_local/loom/editor/manifest` names the URL) and relays every
 * REST call the component makes, so this view only loads the module, creates
 * the element and hands it a transport bound to the entry.
 *
 * The element is created once and kept while the view lives: the component's
 * state is module-global, one element per page, and moving to another device
 * only changes `address`. Its `loom-navigate` events bubble out of this view
 * (`composed`), and the panel decides where they lead.
 */
@safeCustomElement("hm-loom-device-editor")
export class HmLoomDeviceEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";
  @property() public address = "";
  @property({ attribute: false }) public channel?: number;
  @property() public sub?: string;

  /**
   * Loads the component module, which defines `<loom-device-editor>` on
   * import. A method so tests can stand in for the daemon's bundle.
   */
  public loadModule(url: string): Promise<unknown> {
    return import(/* @vite-ignore */ url);
  }

  /**
   * The module URL that defined `<loom-device-editor>` on this page. A custom
   * element cannot be defined twice, so after a daemon update the page keeps
   * the old editor while the manifest names a new module; comparing the two
   * is how the view knows a reload would bring the new one. Static, like the
   * element registry it mirrors: one per page.
   */
  static definedFrom?: string;

  @state() private _state: LoadState = "idle";
  /** The page runs an older editor than the daemon now serves. */
  @state() private _stale = false;
  @state() private _error = "";

  private _editor?: LoomDeviceEditorElement;
  private _loadedFor = "";
  private _locale?: string;
  private _dark?: boolean;

  protected updated(changed: PropertyValues): void {
    if (changed.has("entryId") && this.entryId && this.entryId !== this._loadedFor) {
      void this._load(this.entryId);
    }
    this._syncEditor();
  }

  private async _load(entryId: string): Promise<void> {
    this._loadedFor = entryId;
    this._state = "loading";
    this._error = "";
    this._stale = false;
    this._editor?.remove();
    this._editor = undefined;
    try {
      const manifest = await getLoomEditorManifest(this.hass, entryId);
      if (entryId !== this._loadedFor) return;
      if (!manifest.available || !manifest.module_url) {
        this._state = "unavailable";
        return;
      }
      const definedBefore = customElements.get("loom-device-editor") !== undefined;
      await this.loadModule(manifest.module_url);
      if (entryId !== this._loadedFor) return;
      // A module defines the element only if no earlier one did: after a
      // daemon update, or with two loom entries whose daemons run different
      // versions, the page keeps the first module's editor until it reloads.
      if (!customElements.get("loom-device-editor")) {
        throw new Error("the module did not define <loom-device-editor>");
      }
      if (!definedBefore || HmLoomDeviceEditor.definedFrom === undefined) {
        HmLoomDeviceEditor.definedFrom = manifest.module_url;
      }
      this._stale = HmLoomDeviceEditor.definedFrom !== manifest.module_url;
    } catch (err) {
      if (entryId !== this._loadedFor) return;
      this._error = err instanceof Error ? err.message : String(err);
      this._state = "failed";
      return;
    }
    this._mountEditor(entryId);
    this._state = "ready";
  }

  private _mountEditor(entryId: string): void {
    const host = this.renderRoot.querySelector(".editor-host");
    if (!host) return;
    const editor = document.createElement("loom-device-editor") as LoomDeviceEditorElement;
    // The transport goes first: the element starts the editor as soon as it
    // is connected with one, and every property below is read from then on.
    editor.transport = createLoomEditorTransport(() => this.hass, entryId);
    editor.skin = "ha";
    this._editor = editor;
    this._locale = undefined;
    this._dark = undefined;
    this._syncEditor();
    host.append(editor);
  }

  private _syncEditor(): void {
    const editor = this._editor;
    if (!editor) return;
    if (editor.address !== this.address) editor.address = this.address;
    editor.channel = this.channel;
    editor.sub = this.sub;
    // The element maps every language but German to English itself.
    const locale = this.hass.config.language;
    if (locale !== this._locale) {
      editor.locale = locale;
      this._locale = locale;
    }
    const dark = this.hass.themes?.darkMode ?? false;
    if (dark !== this._dark) {
      editor.dark = dark;
      this._dark = dark;
    }
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private _renderStatus() {
    switch (this._state) {
      case "loading":
        return html`<div class="loading">${this._l("loom_editor.loading")}</div>`;
      case "unavailable":
        return html`<div class="empty-state">${this._l("loom_editor.unavailable")}</div>`;
      case "failed":
        return html`<div class="error">
          ${this._l("loom_editor.load_failed", { error: this._error })}
        </div>`;
      case "ready":
        return this._stale
          ? html`<ha-alert alert-type="warning" class="stale">
              ${this._l("loom_editor.reload_hint")}
              <ha-button slot="action" @click=${() => this.reloadPage()}>
                ${this._l("loom_editor.reload")}
              </ha-button>
            </ha-alert>`
          : nothing;
      default:
        return nothing;
    }
  }

  /** Reloads the page; a method so tests can observe it. */
  public reloadPage(): void {
    window.location.reload();
  }

  render() {
    // The element is appended into `.editor-host` by hand; the container has
    // no bindings of its own, so a re-render never touches it.
    return html`${this._renderStatus()}
      <div class="editor-host"></div>`;
  }

  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "hm-loom-device-editor": HmLoomDeviceEditor;
  }
}
