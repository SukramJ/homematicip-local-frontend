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
  @property({ type: Boolean }) public editable = true;

  @state() private _links: LinkInfo[] = [];
  @state() private _loading = true;
  @state() private _error = "";
  @state() private _sortColumn: "sender" | "receiver" | "channel" = "channel";
  @state() private _sortAsc = true;

  // Swipe-to-delete state
  @state() private _swipingLinkKey?: string;
  @state() private _swipeX = 0;
  private _touchStartX = 0;
  private _touchStartY = 0;
  private _isSwiping = false;
  private _isScrolling = false;

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

  private _onTouchStart(e: TouchEvent, linkKey: string): void {
    if (!this.editable) return;
    const touch = e.touches[0];
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
    this._isSwiping = false;
    this._isScrolling = false;
    this._swipingLinkKey = linkKey;
    this._swipeX = 0;
  }

  private _onTouchMove(e: TouchEvent): void {
    if (!this._swipingLinkKey) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - this._touchStartX;
    const deltaY = touch.clientY - this._touchStartY;

    // Determine intent on first significant movement
    if (!this._isSwiping && !this._isScrolling) {
      if (Math.abs(deltaY) > 10) {
        this._isScrolling = true;
        this._swipingLinkKey = undefined;
        this._swipeX = 0;
        return;
      }
      if (Math.abs(deltaX) > 10) {
        this._isSwiping = true;
      }
    }

    if (this._isScrolling) return;

    if (this._isSwiping) {
      e.preventDefault();
      // Only allow left swipe (negative deltaX)
      this._swipeX = Math.min(0, deltaX);
    }
  }

  private _onTouchEnd(link: LinkInfo): void {
    if (!this._swipingLinkKey || !this._isSwiping) {
      this._resetSwipe();
      return;
    }

    if (Math.abs(this._swipeX) >= 120) {
      // Past dismiss threshold — trigger delete
      this._handleDelete(link);
      this._resetSwipe();
    } else {
      // Animate back
      this._swipeX = 0;
      setTimeout(() => this._resetSwipe(), 200);
    }
  }

  private _resetSwipe(): void {
    this._swipingLinkKey = undefined;
    this._swipeX = 0;
    this._isSwiping = false;
    this._isScrolling = false;
  }

  private _setSortColumn(column: "sender" | "receiver" | "channel"): void {
    if (this._sortColumn === column) {
      this._sortAsc = !this._sortAsc;
    } else {
      this._sortColumn = column;
      this._sortAsc = true;
    }
  }

  private get _sortedLinks(): LinkInfo[] {
    const dir = this._sortAsc ? 1 : -1;
    return [...this._links].sort((a, b) => {
      switch (this._sortColumn) {
        case "sender":
          return dir * a.sender_device_name.localeCompare(b.sender_device_name);
        case "receiver":
          return dir * a.receiver_device_name.localeCompare(b.receiver_device_name);
        case "channel": {
          const aLocal = a.sender_address.startsWith(this.deviceAddress)
            ? a.sender_address
            : a.receiver_address;
          const bLocal = b.sender_address.startsWith(this.deviceAddress)
            ? b.sender_address
            : b.receiver_address;
          const aNo = parseInt(aLocal.split(":").pop() ?? "0");
          const bNo = parseInt(bLocal.split(":").pop() ?? "0");
          return dir * (aNo - bNo);
        }
        default:
          return 0;
      }
    });
  }

  /** Group links by the channel belonging to the current device. */
  private _groupByChannel(): Map<string, LinkInfo[]> {
    const groups = new Map<string, LinkInfo[]>();
    for (const link of this._sortedLinks) {
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

      ${this.editable
        ? html`
            <ha-button class="add-link-btn" @click=${this._handleAddLink}>
              <ha-icon slot="icon" .icon=${"mdi:plus"}></ha-icon>
              ${this._l("device_links.add_link")}
            </ha-button>
          `
        : nothing}
      ${this._links.length > 0
        ? html`
            <div class="sort-bar">
              <span class="sort-label">${this._l("device_links.sort_by")}:</span>
              <button
                class="sort-button ${this._sortColumn === "channel" ? "active" : ""}"
                @click=${() => this._setSortColumn("channel")}
              >
                ${this._l("device_links.sort_channel")}
                ${this._sortColumn === "channel"
                  ? html`<ha-icon
                      .icon=${this._sortAsc ? "mdi:arrow-up" : "mdi:arrow-down"}
                    ></ha-icon>`
                  : nothing}
              </button>
              <button
                class="sort-button ${this._sortColumn === "sender" ? "active" : ""}"
                @click=${() => this._setSortColumn("sender")}
              >
                ${this._l("device_links.sort_sender")}
                ${this._sortColumn === "sender"
                  ? html`<ha-icon
                      .icon=${this._sortAsc ? "mdi:arrow-up" : "mdi:arrow-down"}
                    ></ha-icon>`
                  : nothing}
              </button>
              <button
                class="sort-button ${this._sortColumn === "receiver" ? "active" : ""}"
                @click=${() => this._setSortColumn("receiver")}
              >
                ${this._l("device_links.sort_receiver")}
                ${this._sortColumn === "receiver"
                  ? html`<ha-icon
                      .icon=${this._sortAsc ? "mdi:arrow-up" : "mdi:arrow-down"}
                    ></ha-icon>`
                  : nothing}
              </button>
            </div>
          `
        : nothing}
      ${this._loading
        ? html`<div class="loading">${this._l("common.loading")}</div>`
        : this._error
          ? html`<div class="error">
              ${this._error}
              <br />
              <ha-button outlined @click=${this._fetchLinks}>
                ${this._l("common.retry")}
              </ha-button>
            </div>`
          : this._links.length === 0
            ? html`<div class="empty-state">
                <ha-icon class="empty-icon" .icon=${"mdi:link-off"}></ha-icon>
                <div class="empty-message">${this._l("device_links.empty")}</div>
                <span class="empty-hint">${this._l("device_links.empty_hint")}</span>
                ${this.editable
                  ? html`
                      <ha-button class="empty-action" @click=${this._handleAddLink}>
                        <ha-icon slot="icon" .icon=${"mdi:plus"}></ha-icon>
                        ${this._l("device_links.add_link")}
                      </ha-button>
                    `
                  : nothing}
              </div>`
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
    const linkKey = `${link.sender_address}-${link.receiver_address}`;
    const isSwiping = this._swipingLinkKey === linkKey;
    const swipeX = isSwiping ? this._swipeX : 0;
    const showDeleteBg = isSwiping && swipeX < -40;

    return html`
      <div class="link-card-wrapper">
        ${showDeleteBg
          ? html`<div class="swipe-delete-bg">
              <ha-icon .icon=${"mdi:delete"}></ha-icon>
            </div>`
          : ""}
        <div
          class="link-card ${isOutgoing ? "outgoing" : "incoming"} ${isSwiping && this._isSwiping
            ? "swiping"
            : ""}"
          style=${isSwiping && this._isSwiping ? `transform: translateX(${swipeX}px)` : ""}
          @touchstart=${(e: TouchEvent) => this._onTouchStart(e, linkKey)}
          @touchmove=${(e: TouchEvent) => this._onTouchMove(e)}
          @touchend=${() => this._onTouchEnd(link)}
        >
          <div class="link-direction">
            <span class="direction-badge ${link.direction}">
              ${isOutgoing ? this._l("device_links.outgoing") : this._l("device_links.incoming")}
            </span>
          </div>
          <div class="link-info">
            <div class="link-endpoints">
              <div class="link-endpoint-info">
                <span class="link-device-name">
                  ${link.sender_channel_name ||
                  link.sender_channel_type_label ||
                  link.sender_device_name}
                </span>
                <span class="link-device-detail">
                  ${link.sender_device_name} · ${link.sender_device_model}
                </span>
                <span class="link-endpoint-address">${link.sender_address}</span>
              </div>
              <ha-icon class="link-arrow" .icon=${"mdi:arrow-right"}></ha-icon>
              <div class="link-endpoint-info">
                <span class="link-device-name">
                  ${link.receiver_channel_name ||
                  link.receiver_channel_type_label ||
                  link.receiver_device_name}
                </span>
                <span class="link-device-detail">
                  ${link.receiver_device_name} · ${link.receiver_device_model}
                </span>
                <span class="link-endpoint-address">${link.receiver_address}</span>
              </div>
            </div>
            ${link.name ? html`<div class="link-name">"${link.name}"</div>` : nothing}
          </div>
          ${this.editable
            ? html`
                <div class="link-actions">
                  <ha-button outlined @click=${() => this._handleConfigure(link)}>
                    ${this._l("device_links.configure")}
                  </ha-button>
                  <ha-button outlined class="destructive" @click=${() => this._handleDelete(link)}>
                    ${this._l("device_links.delete")}
                  </ha-button>
                </div>
              `
            : nothing}
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

      .sort-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .sort-label {
        font-size: 13px;
        color: var(--secondary-text-color);
      }

      .sort-button {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 12px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 16px;
        background: none;
        color: var(--primary-text-color);
        font-size: 13px;
        cursor: pointer;
        transition:
          background-color 0.1s,
          border-color 0.1s;
      }

      .sort-button:hover {
        background-color: var(--secondary-background-color, #f5f5f5);
      }

      .sort-button.active {
        border-color: var(--primary-color, #03a9f4);
        color: var(--primary-color, #03a9f4);
        font-weight: 500;
      }

      .sort-button ha-icon {
        --ha-icon-display-size: 14px;
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

      /* Swipe-to-delete wrapper */
      .link-card-wrapper {
        position: relative;
        overflow: hidden;
        border-radius: 8px;
        margin-bottom: 8px;
      }

      .swipe-delete-bg {
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 80px;
        background: var(--error-color, #db4437);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        border-radius: 0 8px 8px 0;
      }

      .swipe-delete-bg ha-icon {
        --ha-icon-display-size: 24px;
        color: white;
      }

      .link-card.swiping {
        transition: none !important;
      }

      .link-card {
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        padding: 12px 16px;
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
        overflow-wrap: break-word;
        word-break: break-all;
      }

      .empty-icon {
        --ha-icon-display-size: 48px;
        color: var(--secondary-text-color);
        opacity: 0.5;
        margin-bottom: 12px;
      }

      .empty-message {
        font-size: 16px;
        margin-bottom: 4px;
      }

      .empty-hint {
        font-size: 13px;
        color: var(--secondary-text-color);
      }

      .empty-action {
        margin-top: 16px;
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

      /* Touch device optimizations */
      @media (hover: none) and (pointer: coarse) {
        .link-card:not(.swiping) {
          transition: transform 0.2s ease-out;
        }
      }
    `,
  ];
}
