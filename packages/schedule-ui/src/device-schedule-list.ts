import { LitElement, html } from "lit";
import { property } from "lit/decorators.js";
import { safeCustomElement } from "./safe-element";
import { repeat } from "lit/directives/repeat.js";
import {
  WEEKDAYS,
  scheduleToUIEntries,
  formatLevel,
  formatDurationDisplay,
} from "@hmip/schedule-core";
import type { SimpleSchedule, SimpleScheduleEntryUI, ScheduleDomain } from "@hmip/schedule-core";
import type { DeviceListTranslations, EditEventDetail, DeleteEventDetail } from "./types";
import { deviceListStyles } from "./styles/device-list-styles";

@safeCustomElement("hmip-device-schedule-list")
export class HmipDeviceScheduleList extends LitElement {
  @property({ attribute: false }) scheduleData?: SimpleSchedule;
  @property({ attribute: false }) domain?: ScheduleDomain;
  @property({ type: Boolean }) editable = true;
  @property({ attribute: false }) translations!: DeviceListTranslations;

  static styles = deviceListStyles;

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

    return html`
      <div class="schedule-list">
        ${this.editable
          ? html`<div class="toolbar">
              <ha-button @click=${this._handleAdd}> ${this.translations.addEvent} </ha-button>
            </div>`
          : ""}
        <div class="events-table">
          <div class="events-header ${this.editable ? "" : "no-actions"}">
            <div class="col-time">${this.translations.time}</div>
            <div class="col-weekdays">${this.translations.weekdays}</div>
            <div class="col-state">${this.translations.state}</div>
            <div class="col-duration">${this.translations.duration}</div>
            ${this.editable ? html`<div class="col-actions"></div>` : ""}
          </div>
          ${repeat(
            entries,
            (entry) => entry.groupNo,
            (entry) => this._renderEvent(entry),
          )}
        </div>
      </div>
    `;
  }

  private _renderEvent(entry: SimpleScheduleEntryUI) {
    const levelText = formatLevel(entry.level, this.domain);
    const durationText = formatDurationDisplay(entry.duration);

    return html`
      <div
        class="event-row ${entry.isActive ? "active" : "inactive"} ${this.editable
          ? ""
          : "no-actions"}"
      >
        <div class="col-time">${entry.time}</div>
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
        <div class="col-state">
          ${levelText}
          ${entry.level_2 !== null
            ? html`<span class="level-2"
                >, ${this.translations.slat}: ${Math.round(entry.level_2 * 100)}%</span
              >`
            : ""}
        </div>
        <div class="col-duration">${durationText}</div>
        ${this.editable
          ? html`<div class="col-actions">
              <ha-icon-button
                .path=${"M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"}
                @click=${() => this._handleEdit(entry)}
              ></ha-icon-button>
              <ha-icon-button
                .path=${"M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"}
                @click=${() => this._handleDelete(entry)}
              ></ha-icon-button>
            </div>`
          : ""}
      </div>
    `;
  }
}
