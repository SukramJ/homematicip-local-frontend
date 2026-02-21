import { LitElement, html, css, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";
import { sharedStyles } from "../styles";
import { listDevices, getLinkableChannels, addLink } from "../api";
import { localize } from "../localize";
import { showToast } from "../ha-helpers";
import type { HomeAssistant, DeviceInfo, ChannelInfo, LinkableChannel } from "../types";

type WizardStep = "select-channel" | "select-peer" | "confirm";

@safeCustomElement("hm-add-link")
export class HmAddLink extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property() public entryId = "";
  @property() public interfaceId = "";
  @property() public deviceAddress = "";

  @state() private _step: WizardStep = "select-channel";
  @state() private _device: DeviceInfo | null = null;
  @state() private _selectedChannel = "";
  @state() private _selectedRole: "sender" | "receiver" = "sender";
  @state() private _selectedPeer = "";
  @state() private _linkName = "";
  @state() private _linkableChannels: LinkableChannel[] = [];
  @state() private _filteredChannels: LinkableChannel[] = [];
  @state() private _searchQuery = "";
  @state() private _loading = false;
  @state() private _error = "";

  updated(changedProps: Map<string, unknown>): void {
    if (
      (changedProps.has("entryId") || changedProps.has("deviceAddress")) &&
      this.entryId &&
      this.deviceAddress
    ) {
      this._fetchDevice();
    }
  }

  private async _fetchDevice(): Promise<void> {
    this._loading = true;
    try {
      const devices = await listDevices(this.hass, this.entryId);
      this._device = devices.find((d) => d.address === this.deviceAddress) ?? null;
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
    if (this._step === "select-peer") {
      this._step = "select-channel";
      this._selectedPeer = "";
      this._linkableChannels = [];
      this._filteredChannels = [];
      this._searchQuery = "";
      return;
    }
    if (this._step === "confirm") {
      this._step = "select-peer";
      return;
    }
    this.dispatchEvent(new CustomEvent("back", { bubbles: true, composed: true }));
  }

  /** Get linkable channels for the current device. */
  private _getLinkableChannels(): ChannelInfo[] {
    if (!this._device) return [];
    return this._device.channels.filter(
      (ch) => !ch.address.endsWith(":0") && ch.paramset_keys.includes("LINK"),
    );
  }

  private _handleSelectChannel(address: string): void {
    this._selectedChannel = address;
  }

  private async _handleNextToSelectPeer(): Promise<void> {
    if (!this._selectedChannel) return;
    this._step = "select-peer";
    await this._fetchLinkableChannels();
  }

  private async _fetchLinkableChannels(): Promise<void> {
    this._loading = true;
    this._error = "";
    this._linkableChannels = [];
    this._filteredChannels = [];
    this._searchQuery = "";
    try {
      this._linkableChannels = await getLinkableChannels(
        this.hass,
        this.entryId,
        this.interfaceId,
        this._selectedChannel,
        this._selectedRole,
      );
      this._filteredChannels = this._linkableChannels;
    } catch (err) {
      this._error = String(err);
    } finally {
      this._loading = false;
    }
  }

  private async _handleRoleChange(role: "sender" | "receiver"): Promise<void> {
    this._selectedRole = role;
    this._selectedPeer = "";
    await this._fetchLinkableChannels();
  }

  private _handleSearchInput(e: Event): void {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    this._searchQuery = query;
    if (!query) {
      this._filteredChannels = this._linkableChannels;
    } else {
      this._filteredChannels = this._linkableChannels.filter(
        (ch) =>
          ch.address.toLowerCase().includes(query) ||
          ch.device_name.toLowerCase().includes(query) ||
          ch.device_model.toLowerCase().includes(query) ||
          ch.channel_type.toLowerCase().includes(query),
      );
    }
  }

  private _handleSelectPeer(address: string): void {
    this._selectedPeer = address;
  }

  private _handleNextToConfirm(): void {
    if (!this._selectedPeer) return;
    this._linkName = "";
    this._step = "confirm";
  }

  private async _handleCreate(): Promise<void> {
    this._loading = true;
    try {
      const sender = this._selectedRole === "sender" ? this._selectedChannel : this._selectedPeer;
      const receiver = this._selectedRole === "sender" ? this._selectedPeer : this._selectedChannel;

      await addLink(this.hass, this.entryId, sender, receiver, this._linkName || undefined);
      showToast(this, { message: this._l("add_link.create_success") });
      this.dispatchEvent(
        new CustomEvent("link-created", {
          bubbles: true,
          composed: true,
        }),
      );
    } catch {
      showToast(this, { message: this._l("add_link.create_failed") });
    } finally {
      this._loading = false;
    }
  }

  render() {
    if (this._loading && !this._device) {
      return html`<div class="loading">${this._l("common.loading")}</div>`;
    }

    return html`
      <button class="back-button" @click=${this._handleBack}>
        ◂ ${this._step === "select-channel" ? this._l("common.back") : this._l("add_link.back")}
      </button>

      <div class="wizard-header">
        <h2>${this._l("add_link.title")}</h2>
      </div>

      ${this._error ? html`<div class="error">${this._error}</div>` : nothing}
      ${this._step === "select-channel"
        ? this._renderStepChannel()
        : this._step === "select-peer"
          ? this._renderStepPeer()
          : this._renderStepConfirm()}
    `;
  }

  private _renderStepChannel() {
    const channels = this._getLinkableChannels();

    return html`
      <div class="wizard-step">
        <div class="step-indicator">${this._l("add_link.step_channel")}</div>
        <div class="step-description">${this._l("add_link.select_channel")}</div>

        <div class="radio-list">
          ${channels.length === 0
            ? html`<div class="empty-state">${this._l("add_link.no_compatible")}</div>`
            : channels.map((ch) => {
                const channelNo = ch.address.split(":").pop() ?? "";
                const isSelected = this._selectedChannel === ch.address;
                return html`
                  <div
                    class="radio-option ${isSelected ? "selected" : ""}"
                    @click=${() => this._handleSelectChannel(ch.address)}
                  >
                    <input type="radio" name="channel" .checked=${isSelected} />
                    <div class="radio-content">
                      <div class="radio-title">
                        ${this._l("device_detail.channel")} ${channelNo}: ${ch.channel_type_label}
                      </div>
                      <div class="radio-subtitle">${ch.address}</div>
                    </div>
                  </div>
                `;
              })}
        </div>

        ${channels.length > 0
          ? html`
              <div class="wizard-actions">
                <button
                  class="btn btn-primary"
                  ?disabled=${!this._selectedChannel}
                  @click=${this._handleNextToSelectPeer}
                >
                  ${this._l("add_link.next")} ▸
                </button>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderStepPeer() {
    return html`
      <div class="wizard-step">
        <div class="step-indicator">${this._l("add_link.step_peer")}</div>

        <div class="role-selector">
          <span class="role-label">${this._l("add_link.select_role")}</span>
          <div class="role-buttons">
            <button
              class="role-btn ${this._selectedRole === "sender" ? "active" : ""}"
              @click=${() => this._handleRoleChange("sender")}
            >
              ${this._l("add_link.role_sender")}
            </button>
            <button
              class="role-btn ${this._selectedRole === "receiver" ? "active" : ""}"
              @click=${() => this._handleRoleChange("receiver")}
            >
              ${this._l("add_link.role_receiver")}
            </button>
          </div>
        </div>

        ${this._loading
          ? html`<div class="loading">${this._l("common.loading")}</div>`
          : html`
              <div class="search-box">
                <input
                  type="text"
                  .value=${this._searchQuery}
                  @input=${this._handleSearchInput}
                  placeholder="${this._l("add_link.search_devices")}"
                />
              </div>

              <div class="radio-list">
                ${this._filteredChannels.length === 0
                  ? html`<div class="empty-state">${this._l("add_link.no_compatible")}</div>`
                  : this._filteredChannels.map((ch) => {
                      const isSelected = this._selectedPeer === ch.address;
                      return html`
                        <div
                          class="radio-option ${isSelected ? "selected" : ""}"
                          @click=${() => this._handleSelectPeer(ch.address)}
                        >
                          <input type="radio" name="peer" .checked=${isSelected} />
                          <div class="radio-content">
                            <div class="radio-title">${ch.device_name} (${ch.device_model})</div>
                            <div class="radio-subtitle">
                              ${ch.address} — ${ch.channel_type_label}
                            </div>
                          </div>
                        </div>
                      `;
                    })}
              </div>

              ${this._filteredChannels.length > 0
                ? html`
                    <div class="wizard-actions">
                      <button
                        class="btn btn-primary"
                        ?disabled=${!this._selectedPeer}
                        @click=${this._handleNextToConfirm}
                      >
                        ${this._l("add_link.next")} ▸
                      </button>
                    </div>
                  `
                : nothing}
            `}
      </div>
    `;
  }

  private _renderStepConfirm() {
    const senderAddr = this._selectedRole === "sender" ? this._selectedChannel : this._selectedPeer;
    const receiverAddr =
      this._selectedRole === "sender" ? this._selectedPeer : this._selectedChannel;

    const senderName = this._resolveName(senderAddr);
    const receiverName = this._resolveName(receiverAddr);

    return html`
      <div class="wizard-step">
        <div class="step-indicator">${this._l("add_link.step_confirm")}</div>

        <div class="link-summary">
          <div class="link-endpoint">
            <div class="link-endpoint-label">${this._l("link_config.sender")}</div>
            <div class="link-endpoint-address">${senderAddr}</div>
            <div class="link-endpoint-name">${senderName}</div>
          </div>

          <div class="link-direction-arrow">→</div>

          <div class="link-endpoint">
            <div class="link-endpoint-label">${this._l("link_config.receiver")}</div>
            <div class="link-endpoint-address">${receiverAddr}</div>
            <div class="link-endpoint-name">${receiverName}</div>
          </div>
        </div>

        <div class="name-input">
          <label for="link-name">${this._l("add_link.link_name")}</label>
          <input
            id="link-name"
            type="text"
            .value=${this._linkName}
            @input=${(e: Event) => {
              this._linkName = (e.target as HTMLInputElement).value;
            }}
            placeholder="${senderAddr} -> ${receiverAddr}"
          />
        </div>

        <div class="wizard-actions">
          <button class="btn btn-primary" ?disabled=${this._loading} @click=${this._handleCreate}>
            ${this._loading ? this._l("common.loading") : this._l("add_link.create")}
          </button>
        </div>
      </div>
    `;
  }

  private _resolveName(address: string): string {
    if (!this._device) return address;
    // Check if it's a channel of the current device
    if (address.startsWith(this.deviceAddress)) {
      return this._device.name || this.deviceAddress;
    }
    // Check linkable channels for peer name
    const peer = this._linkableChannels.find((ch) => ch.address === address);
    if (peer) return `${peer.device_name} (${peer.device_model})`;
    return address;
  }

  static styles = [
    sharedStyles,
    css`
      .wizard-header {
        margin-bottom: 16px;
      }

      .wizard-header h2 {
        margin: 8px 0 4px;
        font-size: 20px;
        font-weight: 400;
      }

      .wizard-step {
        padding: 0;
      }

      .step-indicator {
        font-size: 13px;
        color: var(--secondary-text-color);
        margin-bottom: 4px;
        font-weight: 500;
      }

      .step-description {
        font-size: 14px;
        margin-bottom: 16px;
      }

      .role-selector {
        margin-bottom: 16px;
      }

      .role-label {
        font-size: 14px;
        display: block;
        margin-bottom: 8px;
      }

      .role-buttons {
        display: flex;
        gap: 8px;
      }

      .role-btn {
        flex: 1;
        padding: 8px 16px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
        color: var(--primary-text-color);
        transition: all 0.15s;
      }

      .role-btn:hover {
        border-color: var(--primary-color, #03a9f4);
      }

      .role-btn.active {
        border-color: var(--primary-color, #03a9f4);
        background: var(--primary-color, #03a9f4);
        color: #fff;
      }

      .search-box {
        margin-bottom: 12px;
      }

      .search-box input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
        background: var(--primary-background-color);
        color: var(--primary-text-color);
      }

      .search-box input:focus {
        outline: none;
        border-color: var(--primary-color, #03a9f4);
      }

      .radio-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 400px;
        overflow-y: auto;
      }

      .radio-option {
        display: flex;
        align-items: center;
        padding: 12px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 8px;
        cursor: pointer;
        transition: border-color 0.15s;
      }

      .radio-option:hover {
        border-color: var(--primary-color, #03a9f4);
      }

      .radio-option.selected {
        border-color: var(--primary-color, #03a9f4);
        background: rgba(3, 169, 244, 0.05);
      }

      .radio-option input[type="radio"] {
        margin-right: 12px;
        flex-shrink: 0;
      }

      .radio-content {
        min-width: 0;
      }

      .radio-title {
        font-size: 14px;
        font-weight: 500;
      }

      .radio-subtitle {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-top: 2px;
        font-family: monospace;
      }

      .link-summary {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 24px;
        background: var(--secondary-background-color, #fafafa);
        border-radius: 8px;
        margin-bottom: 16px;
      }

      .link-endpoint {
        text-align: center;
      }

      .link-endpoint-label {
        font-size: 11px;
        text-transform: uppercase;
        color: var(--secondary-text-color);
        font-weight: 500;
        margin-bottom: 4px;
      }

      .link-endpoint-address {
        font-family: monospace;
        font-size: 15px;
        font-weight: 500;
      }

      .link-endpoint-name {
        font-size: 13px;
        color: var(--secondary-text-color);
        margin-top: 2px;
      }

      .link-direction-arrow {
        font-size: 24px;
        color: var(--primary-color, #03a9f4);
      }

      .name-input {
        margin-bottom: 16px;
      }

      .name-input label {
        display: block;
        font-size: 14px;
        margin-bottom: 6px;
        color: var(--secondary-text-color);
      }

      .name-input input {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
        background: var(--primary-background-color);
        color: var(--primary-text-color);
      }

      .name-input input:focus {
        outline: none;
        border-color: var(--primary-color, #03a9f4);
      }

      .wizard-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--divider-color, #e0e0e0);
      }

      .btn {
        padding: 8px 20px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-family: inherit;
        border: 1px solid transparent;
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-primary {
        background: var(--primary-color, #03a9f4);
        color: #fff;
        border-color: var(--primary-color, #03a9f4);
      }

      .btn-primary:hover:not(:disabled) {
        opacity: 0.9;
      }

      @media (max-width: 600px) {
        .role-buttons {
          flex-direction: column;
        }

        .link-summary {
          padding: 16px;
        }
      }
    `,
  ];
}
