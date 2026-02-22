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
  private _timeUpdateInterval?: number;

  connectedCallback(): void {
    super.connectedCallback();
    this._updateCurrentTime();
    this._timeUpdateInterval = window.setInterval(() => {
      this._updateCurrentTime();
    }, 60000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timeUpdateInterval !== undefined) {
      clearInterval(this._timeUpdateInterval);
      this._timeUpdateInterval = undefined;
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

  render() {
    if (!this.scheduleData) return html``;

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
                        <button
                          class="copy-btn ${isCopiedSource ? "active" : ""}"
                          @click=${(e: Event) => this._handleCopy(weekday, e)}
                          title="${this.translations?.copySchedule ?? ""}"
                        >
                          📋
                        </button>
                        <button
                          class="paste-btn"
                          @click=${(e: Event) => this._handlePaste(weekday, e)}
                          title="${this.translations?.pasteSchedule ?? ""}"
                          ?disabled=${!this.copiedWeekday}
                        >
                          📄
                        </button>
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
            (weekday) => {
              const rawBlocks = this._getParsedBlocks(weekday);
              const baseTemp = this._getBaseTemperature(weekday);
              const blocks = fillGapsWithBaseTemperature(rawBlocks, baseTemp);

              return html`
                <div
                  class="time-blocks ${this.editable ? "editable" : ""}"
                  @click=${() => this._handleWeekdayClick(weekday)}
                >
                  ${repeat(
                    blocks,
                    (block) => `${block.slot}-${block.startMinutes}-${this.currentProfile}`,
                    (block, blockIndex) => {
                      const isActive = this._isBlockActive(weekday, block);
                      const isBaseTempBlock =
                        block.temperature === baseTemp &&
                        !rawBlocks.some(
                          (b) =>
                            b.startMinutes === block.startMinutes &&
                            b.endMinutes === block.endMinutes,
                        );

                      let backgroundStyle: string;
                      if (isBaseTempBlock) {
                        backgroundStyle = `background-color: var(--secondary-background-color, #e0e0e0);`;
                      } else if (this.showGradient) {
                        const prevTemp = blockIndex > 0 ? blocks[blockIndex - 1].temperature : null;
                        const nextTemp =
                          blockIndex < blocks.length - 1
                            ? blocks[blockIndex + 1].temperature
                            : null;
                        const gradient = getTemperatureGradient(
                          block.temperature,
                          prevTemp,
                          nextTemp,
                        );
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
                            ? html`<span class="temperature"
                                >${block.temperature.toFixed(1)}°</span
                              >`
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
            },
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

  static styles = gridStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    "hmip-schedule-grid": HmipScheduleGrid;
  }
}
