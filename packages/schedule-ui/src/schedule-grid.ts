import { LitElement, html, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "./safe-element";
import { repeat } from "lit/directives/repeat.js";
import {
  WEEKDAYS,
  Weekday,
  SimpleProfileData,
  TimeBlock,
  parseSimpleWeekdaySchedule,
  fillGapsWithBaseTemperature,
  getTemperatureColor,
  getTemperatureGradient,
  formatTemperature,
  formatTime,
} from "@hmip/schedule-core";
import type {
  GridTranslations,
  WeekdayClickDetail,
  CopyScheduleDetail,
  PasteScheduleDetail,
} from "./types";
import { gridStyles } from "./styles/grid-styles";

@safeCustomElement("hmip-schedule-grid")
export class HmipScheduleGrid extends LitElement {
  @property({ attribute: false }) scheduleData?: SimpleProfileData;
  @property({ type: Boolean }) editable = false;
  @property({ type: Boolean }) showTemperature = true;
  @property({ type: Boolean }) showGradient = false;
  @property({ type: String }) temperatureUnit = "\u00B0C";
  @property({ type: String }) hourFormat: "12" | "24" = "24";
  @property({ attribute: false }) translations?: GridTranslations;
  @property({ type: String }) copiedWeekday?: Weekday;
  @property({ type: Boolean }) editorOpen = false;
  @property({ type: String }) currentProfile?: string;
  @property({ type: String }) scheduleDataHash?: string;

  @state() private _currentTimePercent = 0;
  @state() private _currentTimeMinutes = 0;
  @state() private _currentWeekday?: Weekday;
  @state() private _isMobile = false;
  @state() private _mobileSelectedDayIndex = 0;
  private _timeUpdateInterval?: number;
  private _mediaQuery?: MediaQueryList;
  private _mediaHandler = (e: MediaQueryListEvent) => {
    this._isMobile = e.matches;
  };
  private _touchStartX = 0;
  private _touchStartY = 0;

  connectedCallback(): void {
    super.connectedCallback();
    this._updateCurrentTime();
    this._timeUpdateInterval = window.setInterval(() => {
      this._updateCurrentTime();
    }, 60000);
    this._mediaQuery = window.matchMedia("(max-width: 600px)");
    this._isMobile = this._mediaQuery.matches;
    this._mediaQuery.addEventListener("change", this._mediaHandler);
    this._initMobileSelectedDay();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timeUpdateInterval !== undefined) {
      clearInterval(this._timeUpdateInterval);
      this._timeUpdateInterval = undefined;
    }
    if (this._mediaQuery) {
      this._mediaQuery.removeEventListener("change", this._mediaHandler);
      this._mediaQuery = undefined;
    }
  }

  protected willUpdate(_changedProps: PropertyValues): void {
    super.willUpdate(_changedProps);
  }

  private _updateCurrentTime(): void {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    this._currentTimePercent = (totalMinutes / 1440) * 100;
    this._currentTimeMinutes = totalMinutes;

    const dayIndex = now.getDay();
    const weekdayMap: Weekday[] = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];
    this._currentWeekday = weekdayMap[dayIndex];
  }

  private _isBlockActive(weekday: Weekday, block: TimeBlock): boolean {
    if (!this._currentWeekday || this._currentWeekday !== weekday) {
      return false;
    }
    return (
      this._currentTimeMinutes >= block.startMinutes && this._currentTimeMinutes < block.endMinutes
    );
  }

  private _getTimeLabels(): { hour: number; label: string; position: number }[] {
    const labels = [];
    for (let hour = 0; hour <= 24; hour += 3) {
      const time24 = `${hour.toString().padStart(2, "0")}:00`;
      labels.push({
        hour,
        label: formatTime(time24, this.hourFormat),
        position: (hour / 24) * 100,
      });
    }
    return labels;
  }

  private _formatTimeDisplay(time: string): string {
    return formatTime(time, this.hourFormat);
  }

  private _getBaseTemperature(weekday: Weekday): number {
    if (this.scheduleData) {
      const weekdayData = this.scheduleData[weekday];
      if (weekdayData) {
        const { baseTemperature } = parseSimpleWeekdaySchedule(weekdayData);
        return baseTemperature;
      }
    }
    return 20.0;
  }

  private _getParsedBlocks(weekday: Weekday): TimeBlock[] {
    if (this.scheduleData) {
      const weekdayData = this.scheduleData[weekday];
      if (!weekdayData) return [];
      const { blocks } = parseSimpleWeekdaySchedule(weekdayData);
      return blocks;
    }
    return [];
  }

  private _getWeekdayLabel(weekday: Weekday): string {
    return this.translations?.weekdayShortLabels[weekday] ?? weekday.slice(0, 2);
  }

  private _handleWeekdayClick(weekday: Weekday): void {
    if (!this.editable) return;
    this.dispatchEvent(
      new CustomEvent<WeekdayClickDetail>("weekday-click", {
        detail: { weekday },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handleCopy(weekday: Weekday, e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent<CopyScheduleDetail>("copy-schedule", {
        detail: { weekday },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _handlePaste(weekday: Weekday, e: Event): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent<PasteScheduleDetail>("paste-schedule", {
        detail: { weekday },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _initMobileSelectedDay(): void {
    const jsDay = new Date().getDay();
    // WEEKDAYS: MON=0, TUE=1, ..., SUN=6; JS getDay(): SUN=0, MON=1, ..., SAT=6
    this._mobileSelectedDayIndex = jsDay === 0 ? 6 : jsDay - 1;
  }

  private _mobilePrevDay(): void {
    this._mobileSelectedDayIndex =
      (this._mobileSelectedDayIndex - 1 + WEEKDAYS.length) % WEEKDAYS.length;
  }

  private _mobileNextDay(): void {
    this._mobileSelectedDayIndex = (this._mobileSelectedDayIndex + 1) % WEEKDAYS.length;
  }

  private _getWeekdayLongLabel(weekday: Weekday): string {
    return (
      this.translations?.weekdayLongLabels?.[weekday] ??
      weekday.charAt(0) + weekday.slice(1).toLowerCase()
    );
  }

  private _handleTouchStart(e: TouchEvent): void {
    this._touchStartX = e.touches[0].clientX;
    this._touchStartY = e.touches[0].clientY;
  }

  private _handleTouchEnd(e: TouchEvent): void {
    const deltaX = e.changedTouches[0].clientX - this._touchStartX;
    const deltaY = e.changedTouches[0].clientY - this._touchStartY;
    // Only trigger swipe if horizontal movement is dominant and > 50px
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        this._mobileNextDay();
      } else {
        this._mobilePrevDay();
      }
    }
  }

  private _renderTimeBlocks(weekday: Weekday) {
    const rawBlocks = this._getParsedBlocks(weekday);
    const baseTemp = this._getBaseTemperature(weekday);
    const blocks = fillGapsWithBaseTemperature(rawBlocks, baseTemp);

    return html`
      <div
        class="time-blocks ${this.editable ? "editable" : ""}"
        tabindex=${this.editable ? "0" : "-1"}
        role=${this.editable ? "button" : "presentation"}
        aria-label=${this._getWeekdayLabel(weekday)}
        @click=${() => this._handleWeekdayClick(weekday)}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this._handleWeekdayClick(weekday);
          }
        }}
      >
        ${repeat(
          blocks,
          (block) => `${block.slot}-${block.startMinutes}-${this.currentProfile}`,
          (block, blockIndex) => {
            const isActive = this._isBlockActive(weekday, block);
            const isBaseTempBlock =
              block.temperature === baseTemp &&
              !rawBlocks.some(
                (b) => b.startMinutes === block.startMinutes && b.endMinutes === block.endMinutes,
              );

            let backgroundStyle: string;
            if (isBaseTempBlock) {
              backgroundStyle = `background-color: var(--secondary-background-color, #e0e0e0);`;
            } else if (this.showGradient) {
              const prevTemp = blockIndex > 0 ? blocks[blockIndex - 1].temperature : null;
              const nextTemp =
                blockIndex < blocks.length - 1 ? blocks[blockIndex + 1].temperature : null;
              const gradient = getTemperatureGradient(block.temperature, prevTemp, nextTemp);
              backgroundStyle = `background: ${gradient};`;
            } else {
              backgroundStyle = `background-color: ${getTemperatureColor(block.temperature)};`;
            }

            return html`
              <div
                class="time-block ${isActive ? "active" : ""} ${isBaseTempBlock
                  ? "base-temp-block"
                  : ""}"
                style="
                    height: ${((block.endMinutes - block.startMinutes) / 1440) * 100}%;
                    ${backgroundStyle}
                  "
              >
                ${this.showTemperature
                  ? html`<span class="temperature">${block.temperature.toFixed(1)}°</span>`
                  : ""}
                <div class="time-block-tooltip">
                  <div class="tooltip-time">
                    ${this._formatTimeDisplay(block.startTime)} -
                    ${this._formatTimeDisplay(block.endTime)}
                  </div>
                  <div class="tooltip-temp">
                    ${formatTemperature(block.temperature, this.temperatureUnit)}
                  </div>
                </div>
              </div>
            `;
          },
        )}
      </div>
    `;
  }

  private _renderMobile() {
    const weekday = WEEKDAYS[this._mobileSelectedDayIndex];
    const isCopiedSource = this.copiedWeekday === weekday;

    return html`
      <div class="mobile-day-nav">
        <ha-icon-button
          .path=${"M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z"}
          @click=${() => this._mobilePrevDay()}
          .label=${this.translations?.previousDay ?? "Previous day"}
        ></ha-icon-button>
        <span class="mobile-day-name">${this._getWeekdayLongLabel(weekday)}</span>
        <ha-icon-button
          .path=${"M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"}
          @click=${() => this._mobileNextDay()}
          .label=${this.translations?.nextDay ?? "Next day"}
        ></ha-icon-button>
      </div>

      <div
        class="mobile-schedule-container"
        @touchstart=${(e: TouchEvent) => this._handleTouchStart(e)}
        @touchend=${(e: TouchEvent) => this._handleTouchEnd(e)}
      >
        <div class="time-axis-labels">
          ${repeat(
            this._getTimeLabels(),
            (time) => time.hour,
            (time) => html`
              <div class="time-label" style="top: ${time.position}%">${time.label}</div>
            `,
          )}
        </div>

        <div class="mobile-day-content">
          ${this._renderTimeBlocks(weekday)}

          <!-- Current time indicator line (hidden when editor is open) -->
          ${!this.editorOpen && this._currentWeekday === weekday
            ? html`<div
                class="current-time-indicator"
                style="top: ${this._currentTimePercent}%"
              ></div>`
            : ""}
        </div>
      </div>

      ${this.editable
        ? html`
            <div class="mobile-day-actions">
              <ha-icon-button
                class="copy-btn ${isCopiedSource ? "active" : ""}"
                .path=${"M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"}
                @click=${(e: Event) => this._handleCopy(weekday, e)}
                .label=${this.translations?.copySchedule ?? ""}
              ></ha-icon-button>
              <ha-icon-button
                class="paste-btn"
                .path=${"M19,20H5V4H7V7H17V4H19M12,2A1,1 0 0,1 13,3A1,1 0 0,1 12,4A1,1 0 0,1 11,3A1,1 0 0,1 12,2M19,2H14.82C14.4,0.84 13.3,0 12,0C10.7,0 9.6,0.84 9.18,2H5A2,2 0 0,0 3,4V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V4A2,2 0 0,0 19,2Z"}
                @click=${(e: Event) => this._handlePaste(weekday, e)}
                .label=${this.translations?.pasteSchedule ?? ""}
                .disabled=${!this.copiedWeekday}
              ></ha-icon-button>
            </div>
          `
        : ""}
      ${this.editable ? html`<div class="hint">${this.translations?.clickToEdit ?? ""}</div>` : ""}
    `;
  }

  private _renderDesktop() {
    return html`
      <div class="schedule-container">
        <!-- Empty cell for time-axis header alignment -->
        <div class="time-axis-header"></div>

        <!-- Weekday headers -->
        ${repeat(
          WEEKDAYS,
          (weekday) => `header-${weekday}`,
          (weekday) => {
            const isCopiedSource = this.copiedWeekday === weekday;
            return html`
              <div class="weekday-header">
                <div class="weekday-label">${this._getWeekdayLabel(weekday)}</div>
                ${this.editable
                  ? html`
                      <div class="weekday-actions">
                        <ha-icon-button
                          class="copy-btn ${isCopiedSource ? "active" : ""}"
                          .path=${"M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"}
                          @click=${(e: Event) => this._handleCopy(weekday, e)}
                          .label=${this.translations?.copySchedule ?? ""}
                        ></ha-icon-button>
                        <ha-icon-button
                          class="paste-btn"
                          .path=${"M19,20H5V4H7V7H17V4H19M12,2A1,1 0 0,1 13,3A1,1 0 0,1 12,4A1,1 0 0,1 11,3A1,1 0 0,1 12,2M19,2H14.82C14.4,0.84 13.3,0 12,0C10.7,0 9.6,0.84 9.18,2H5A2,2 0 0,0 3,4V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V4A2,2 0 0,0 19,2Z"}
                          @click=${(e: Event) => this._handlePaste(weekday, e)}
                          .label=${this.translations?.pasteSchedule ?? ""}
                          .disabled=${!this.copiedWeekday}
                        ></ha-icon-button>
                      </div>
                    `
                  : ""}
              </div>
            `;
          },
        )}

        <!-- Time axis labels -->
        <div class="time-axis-labels">
          ${repeat(
            this._getTimeLabels(),
            (time) => time.hour,
            (time) => html`
              <div class="time-label" style="top: ${time.position}%">${time.label}</div>
            `,
          )}
        </div>

        <!-- Time blocks content wrapper (for correct indicator positioning) -->
        <div class="schedule-content">
          ${repeat(
            WEEKDAYS,
            (weekday) => `${weekday}-${this.currentProfile}-${this.scheduleDataHash}`,
            (weekday) => this._renderTimeBlocks(weekday),
          )}

          <!-- Current time indicator line (hidden when editor is open) -->
          ${!this.editorOpen
            ? html`<div
                class="current-time-indicator"
                style="top: ${this._currentTimePercent}%"
              ></div>`
            : ""}
        </div>
      </div>

      ${this.editable ? html`<div class="hint">${this.translations?.clickToEdit ?? ""}</div>` : ""}
    `;
  }

  render() {
    if (!this.scheduleData) return html``;
    return this._isMobile ? this._renderMobile() : this._renderDesktop();
  }

  static styles = gridStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    "hmip-schedule-grid": HmipScheduleGrid;
  }
}
