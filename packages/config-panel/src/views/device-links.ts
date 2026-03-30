import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { listDeviceLinks, removeLink } from "../api";
import { localize } from "../localize";
import { showConfirmationDialog, showToast } from "../ha-helpers";
import type { HomeAssistant, LinkInfo } from "../types";

@safeCustomElement("hm-device-links")
export class HmDeviceLinks extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";
  @property() public interfaceId = "";
  @property() public deviceAddress = "";
  @property() public deviceName = "";

  @state() private _links: LinkInfo[] = [];
  @state() private _loading = true;
  @state() private _error = "";

  updated(changedProps: Map<string, unknown>): void {
    if (
      (changedProps.has("entryId") ||
        changedProps.has("deviceAddress") ||
        changedProps.has("interfaceId")) &&
      this.entryId &&
      this.deviceAddress &&
      this.interfaceId
    ) {
      this._fetchLinks();
    }
  }

  private async _fetchLinks(): Promise<void> {
    this._loading = true;
    this._error = "";
    try {
      this._links = await listDeviceLinks(
        this.hass,
        this.entryId,
        this.interfaceId,
        this.deviceAddress,
      );
    } catch (err) {
      this._error = String(err);
    } finally {
      this._loading = false;
    }
  }

  private _l(key: string, params?: Record<string, string | number>): string {
    return localize(this.hass, key, params);
  }

  private _handleBack(): void {
    this.dispatchEvent(new CustomEvent("back", { bubbles: true, composed: true }));
  }

  private _handleAddLink(): void {
    this.dispatchEvent(
      new CustomEvent("add-link", {
        detail: {
          deviceAddress: this.deviceAddress,
          interfaceId: this.interfaceId,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleConfigure(link: LinkInfo): void {
    this.dispatchEvent(
      new CustomEvent("configure-link", {
        detail: {
          senderAddress: link.sender_address,
          receiverAddress: link.receiver_address,
          interfaceId: this.interfaceId,
          senderDeviceName: link.sender_device_name,
          senderDeviceModel: link.sender_device_model,
          senderChannelTypeLabel: link.sender_channel_type_label,
          receiverDeviceName: link.receiver_device_name,
          receiverDeviceModel: link.receiver_device_model,
          receiverChannelTypeLabel: link.receiver_channel_type_label,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async _handleDelete(link: LinkInfo): Promise<void> {
    const confirmed = await showConfirmationDialog(this, {
      title: this._l("device_links.delete_confirm_title"),
      text: this._l("device_links.delete_confirm_text", {
        sender: link.sender_address,
        receiver: link.receiver_address,
      }),
      confirmText: this._l("device_links.delete"),
      dismissText: this._l("common.cancel"),
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await removeLink(this.hass, this.entryId, link.sender_address, link.receiver_address);
      showToast(this, {
        message: this._l("device_links.delete_success"),
      });
      await this._fetchLinks();
    } catch {
      showToast(this, {
        message: this._l("device_links.delete_failed"),
      });
    }
  }

  /** Group links by the channel belonging to the current device. */
  private _groupByChannel(): Map<string, LinkInfo[]> {
    const groups = new Map<string, LinkInfo[]>();
    for (const link of this._links) {
      // The "local" channel is whichever side belongs to our device
      const localChannel = link.sender_address.startsWith(this.deviceAddress)
        ? link.sender_address
        : link.receiver_address;
      const channelNo = localChannel.split(":").pop() ?? "";
      const groupKey = channelNo;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(link);
    }
    return groups;
  }

  render() {
    return html`
      <ha-icon-button
        class="back-button"
        .path=${"M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"}
        @click=${this._handleBack}
        .label=${this._l("common.back")}
      ></ha-icon-button>

      <div class="links-header">
        <h2>${this._l("device_links.title")}</h2>
        <div class="device-info">
          ${this._l("device_links.subtitle", {
            device: this.deviceName || this.deviceAddress,
          })}
        </div>
      </div>

      <ha-button class="add-link-btn" @click=${this._handleAddLink}>
        <ha-icon slot="icon" .icon=${"mdi:plus"}></ha-icon>
        ${this._l("device_links.add_link")}
      </ha-button>

      ${this._loading
        ? html`<div class="loading">${this._l("common.loading")}</div>`
        : this._error
          ? html`<div class="error">${this._error}</div>`
          : this._links.length === 0
            ? html`<div class="empty-state">${this._l("device_links.empty")}</div>`
            : this._renderGroupedLinks()}
    `;
  }

  private _renderGroupedLinks() {
    const groups = this._groupByChannel();
    const sortedKeys = [...groups.keys()].sort((a, b) => parseInt(a) - parseInt(b));

    return html`
      ${sortedKeys.map((channelNo) => {
        const links = groups.get(channelNo)!;
        return html`
          <div class="link-channel-group">
            <div class="link-channel-header">
              ${this._l("device_links.channel_group", { channel: channelNo })}
            </div>
            ${links.map((link) => this._renderLinkCard(link))}
          </div>
        `;
      })}
    `;
  }

  private _renderLinkCard(link: LinkInfo) {
    const isOutgoing = link.direction === "outgoing";

    return html`
      <div class="link-card ${isOutgoing ? "outgoing" : "incoming"}">
        <div class="link-direction">
          <span class="direction-badge ${link.direction}">
            ${isOutgoing ? this._l("device_links.outgoing") : this._l("device_links.incoming")}
          </span>
        </div>
        <div class="link-info">
          <div class="link-endpoints">
            <div class="link-endpoint-info">
              <span class="link-device-name">${link.sender_device_name}</span>
              <span class="link-device-detail">
                ${link.sender_device_model}${link.sender_channel_type_label
                  ? html` · ${link.sender_channel_type_label}`
                  : nothing}
              </span>
              <span class="link-endpoint-address">${link.sender_address}</span>
            </div>
            <ha-icon class="link-arrow" .icon=${"mdi:arrow-right"}></ha-icon>
            <div class="link-endpoint-info">
              <span class="link-device-name">${link.receiver_device_name}</span>
              <span class="link-device-detail">
                ${link.receiver_device_model}${link.receiver_channel_type_label
                  ? html` · ${link.receiver_channel_type_label}`
                  : nothing}
              </span>
              <span class="link-endpoint-address">${link.receiver_address}</span>
            </div>
          </div>
          ${link.name ? html`<div class="link-name">"${link.name}"</div>` : nothing}
        </div>
        <div class="link-actions">
          <ha-button outlined @click=${() => this._handleConfigure(link)}>
            ${this._l("device_links.configure")}
          </ha-button>
          <ha-button outlined class="destructive" @click=${() => this._handleDelete(link)}>
            ${this._l("device_links.delete")}
          </ha-button>
        </div>
      </div>
    `;
  }

  static styles = [
    sharedStyles,
    css`
      .links-header {
        margin-bottom: 16px;
      }

      .links-header h2 {
        margin: 8px 0 4px;
        font-size: 20px;
        font-weight: 400;
      }

      .add-link-btn {
        margin-bottom: 16px;
      }

      .link-channel-group {
        margin-bottom: 16px;
      }

      .link-channel-header {
        font-size: 14px;
        font-weight: 500;
        color: var(--secondary-text-color);
        padding: 8px 0;
        border-bottom: 1px solid var(--divider-color);
        margin-bottom: 8px;
      }

      .link-card {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 8px;
      }

      .link-card.outgoing {
        border-left: 3px solid var(--primary-color, #03a9f4);
      }

      .link-card.incoming {
        border-left: 3px solid var(--secondary-text-color, #888);
      }

      .direction-badge {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 12px;
        text-transform: uppercase;
      }

      .direction-badge.outgoing {
        background: var(--primary-color, #03a9f4);
        color: #fff;
      }

      .direction-badge.incoming {
        background: var(--secondary-text-color, #888);
        color: #fff;
      }

      .link-endpoints {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 8px 0 4px;
      }

      .link-endpoint-info {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }

      .link-device-name {
        font-size: 14px;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .link-device-detail {
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .link-endpoint-address {
        font-family: monospace;
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .link-arrow {
        --ha-icon-display-size: 20px;
        color: var(--secondary-text-color);
        flex-shrink: 0;
      }

      .link-name {
        font-size: 12px;
        font-style: italic;
        color: var(--secondary-text-color);
        margin-top: 4px;
      }

      .link-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--divider-color, #e0e0e0);
      }

      .destructive {
        --ha-button-color: var(--error-color, #db4437);
      }

      @media (max-width: 600px) {
        .link-endpoints {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .link-arrow {
          align-self: center;
        }

        .link-actions {
          flex-direction: column;
        }

        .link-actions ha-button {
          width: 100%;
        }
      }
    `,
  ];
}
