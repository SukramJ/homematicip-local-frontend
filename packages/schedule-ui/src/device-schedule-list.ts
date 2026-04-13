import { LitElement, html } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "./safe-element";
import { repeat } from "lit/directives/repeat.js";
import {
  WEEKDAYS,
  scheduleToUIEntries,
  formatLevel,
  formatDurationDisplay,
  formatConditionDisplay,
} from "@hmip/schedule-core";
import type { SimpleSchedule, SimpleScheduleEntryUI, ScheduleDomain } from "@hmip/schedule-core";
import type { DeviceListTranslations, EditEventDetail, DeleteEventDetail } from "./types";
import { deviceListStyles } from "./styles/device-list-styles";

const SWIPE_THRESHOLD = 80;
const SWIPE_DISMISS_THRESHOLD = 120;

@safeCustomElement("hmip-device-schedule-list")
export class HmipDeviceScheduleList extends LitElement {
  @property({ attribute: false }) scheduleData?: SimpleSchedule;
  @property({ attribute: false }) domain?: ScheduleDomain;
  @property({ type: Boolean }) editable = true;
  @property({ type: Number }) collapseAfter = 0;
  @property({ attribute: false }) translations!: DeviceListTranslations;

  @state() private _expanded = false;
  @state() private _swipingGroupNo?: string;
  @state() private _swipeX = 0;

  private _touchStartX = 0;
  private _touchStartY = 0;
  private _isSwiping = false;
  private _isScrolling = false;

  static styles = deviceListStyles;

  private _onTouchStart(e: TouchEvent, groupNo: string): void {
    if (!this.editable) return;
    const touch = e.touches[0];
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
    this._isSwiping = false;
    this._isScrolling = false;
    this._swipingGroupNo = groupNo;
    this._swipeX = 0;
  }

  private _onTouchMove(e: TouchEvent): void {
    if (!this._swipingGroupNo) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - this._touchStartX;
    const deltaY = touch.clientY - this._touchStartY;

    // Determine intent on first significant movement
    if (!this._isSwiping && !this._isScrolling) {
      if (Math.abs(deltaY) > 10) {
        this._isScrolling = true;
        this._swipingGroupNo = undefined;
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

  private _onTouchEnd(entry: SimpleScheduleEntryUI): void {
    if (!this._swipingGroupNo || !this._isSwiping) {
      this._resetSwipe();
      return;
    }

    if (Math.abs(this._swipeX) >= SWIPE_DISMISS_THRESHOLD) {
      // Past dismiss threshold — delete the event
      this.dispatchEvent(
        new CustomEvent<DeleteEventDetail>("delete-event", {
          bubbles: true,
          composed: true,
          detail: { entry },
        }),
      );
      this._resetSwipe();
    } else {
      // Animate back
      this._swipeX = 0;
      // Delay reset to allow CSS transition
      setTimeout(() => this._resetSwipe(), 200);
    }
  }

  private _resetSwipe(): void {
    this._swipingGroupNo = undefined;
    this._swipeX = 0;
    this._isSwiping = false;
    this._isScrolling = false;
  }

  private _handleAdd(): void {
    this.dispatchEvent(new CustomEvent("add-event", { bubbles: true, composed: true }));
  }

  private _handleEdit(entry: SimpleScheduleEntryUI): void {
    this.dispatchEvent(
      new CustomEvent<EditEventDetail>("edit-event", {
        bubbles: true,
        composed: true,
        detail: { entry },
      }),
    );
  }

  private _handleDelete(entry: SimpleScheduleEntryUI): void {
    this.dispatchEvent(
      new CustomEvent<DeleteEventDetail>("delete-event", {
        bubbles: true,
        composed: true,
        detail: { entry },
      }),
    );
  }

  private _getConditionDisplay(entry: SimpleScheduleEntryUI) {
    const conditionLabel = this.translations.conditionLabels[entry.condition] || entry.condition;
    return formatConditionDisplay(entry, conditionLabel, this.translations.conditionSummaryLabels);
  }

  private _toggleExpanded(): void {
    this._expanded = !this._expanded;
  }

  protected render() {
    if (!this.scheduleData) {
      return html`<div class="no-data">${this.translations.loading}</div>`;
    }

    const entries = scheduleToUIEntries(this.scheduleData);

    if (entries.length === 0) {
      return html`
        <div class="no-data">
          <p>${this.translations.noScheduleEvents}</p>
          ${this.editable
            ? html`<ha-button @click=${this._handleAdd}> ${this.translations.addEvent} </ha-button>`
            : ""}
        </div>
      `;
    }

    const shouldCollapse = this.collapseAfter > 0 && entries.length > this.collapseAfter;
    const visibleEntries =
      shouldCollapse && !this._expanded ? entries.slice(0, this.collapseAfter) : entries;
    const hiddenCount = entries.length - this.collapseAfter;

    return html`
      <div class="schedule-list">
        <div class="events-table">
          ${repeat(
            visibleEntries,
            (entry) => entry.groupNo,
            (entry) => this._renderEvent(entry),
          )}
        </div>
        ${shouldCollapse
          ? html`<div class="collapse-toggle">
              <ha-button @click=${this._toggleExpanded}>
                ${this._expanded
                  ? this.translations.showLess
                  : `${this.translations.showMore} (${hiddenCount})`}
              </ha-button>
            </div>`
          : ""}
        ${this.editable
          ? html`<div class="toolbar">
              <ha-button @click=${this._handleAdd}> ${this.translations.addEvent} </ha-button>
            </div>`
          : ""}
      </div>
    `;
  }

  private _renderEvent(entry: SimpleScheduleEntryUI) {
    const levelText = formatLevel(entry.level, this.domain, {
      on: this.translations.levelOn,
      off: this.translations.levelOff,
    });
    const durationText = formatDurationDisplay(entry.duration);
    const { label, details } = this._getConditionDisplay(entry);
    const isSwiping = this._swipingGroupNo === entry.groupNo;
    const swipeX = isSwiping ? this._swipeX : 0;
    const showDeleteBg = isSwiping && swipeX < -SWIPE_THRESHOLD / 2;

    return html`
      <div class="event-card-wrapper">
        ${showDeleteBg
          ? html`<div class="swipe-delete-bg">
              <ha-icon .icon=${"mdi:delete"}></ha-icon>
            </div>`
          : ""}
        <div
          class="event-card ${entry.isActive ? "active" : "inactive"} ${isSwiping && this._isSwiping
            ? "swiping"
            : ""}"
          style=${isSwiping && this._isSwiping ? `transform: translateX(${swipeX}px)` : ""}
          @touchstart=${(e: TouchEvent) => this._onTouchStart(e, entry.groupNo)}
          @touchmove=${(e: TouchEvent) => this._onTouchMove(e)}
          @touchend=${() => this._onTouchEnd(entry)}
        >
          <div class="event-row-top">
            <div class="col-condition">${label}</div>
            ${this.editable
              ? html`<div class="col-actions">
                  <ha-icon-button
                    .path=${"M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"}
                    @click=${() => this._handleEdit(entry)}
                    .label=${this.translations?.editEvent ?? "Edit"}
                  ></ha-icon-button>
                  <ha-icon-button
                    .path=${"M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"}
                    @click=${() => this._handleDelete(entry)}
                    .label=${this.translations?.deleteEvent ?? "Delete"}
                  ></ha-icon-button>
                </div>`
              : ""}
          </div>
          <div class="event-row-details">
            <span class="col-details-text">${details}</span>
          </div>
          <div class="event-row-bottom">
            <div class="col-weekdays">
              <div class="weekday-badges">
                ${WEEKDAYS.map((weekday) => {
                  const isActive = entry.weekdays.includes(weekday);
                  return html`<span class="weekday-badge ${isActive ? "active" : "inactive"}"
                    >${this.translations.weekdayShortLabels[weekday]}</span
                  >`;
                })}
              </div>
            </div>
            <div class="col-details">
              <span class="col-state">
                ${levelText}
                ${entry.level_2 !== null
                  ? html`<span class="level-2"
                      >, ${this.translations.slat}: ${Math.round(entry.level_2 * 100)}%</span
                    >`
                  : ""}
              </span>
              ${durationText !== "-" ? html`<span class="col-duration">${durationText}</span>` : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
