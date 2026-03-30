import { LitElement, html, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { safeCustomElement } from "./safe-element";
import {
  WEEKDAYS,
  Weekday,
  SimpleProfileData,
  TimeBlock,
  parseSimpleWeekdaySchedule,
  fillGapsWithBaseTemperature,
  getTemperatureColor,
  formatTime,
  timeToMinutes,
  minutesToTime,
  validateTimeBlocks,
  timeBlocksToSimpleWeekdayData,
  validateSimpleWeekdayData,
  insertBlockWithSplitting,
  sortBlocksChronologically,
  mergeConsecutiveBlocks,
} from "@hmip/schedule-core";
import type { ClimateValidationMessage as ValidationMessage } from "@hmip/schedule-core";
import type { EditorTranslations, SaveScheduleDetail, ValidationFailedDetail } from "./types";
import { editorStyles } from "./styles/editor-styles";

@safeCustomElement("hmip-schedule-editor")
export class HmipScheduleEditor extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ type: String }) weekday?: Weekday;
  @property({ attribute: false }) scheduleData?: SimpleProfileData;
  @property({ type: Number }) minTemp = 5.0;
  @property({ type: Number }) maxTemp = 30.5;
  @property({ type: Number }) tempStep = 0.5;
  @property({ type: String }) temperatureUnit = "\u00B0C";
  @property({ type: String }) hourFormat: "12" | "24" = "24";
  @property({ attribute: false }) translations?: EditorTranslations;

  @state() private _editingWeekday?: Weekday;
  @state() private _editingBlocks?: TimeBlock[];
  @state() private _editingBaseTemperature?: number;
  @state() private _validationWarnings: ValidationMessage[] = [];
  @state() private _editingSlotIndex?: number;
  @state() private _editingSlotData?: {
    startTime: string;
    endTime: string;
    temperature: number;
  };

  private _historyStack: TimeBlock[][] = [];
  private _historyIndex = -1;
  private _keyDownHandler: (e: KeyboardEvent) => void;

  constructor() {
    super();
    this._keyDownHandler = this._handleKeyDown.bind(this);
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this._keyDownHandler);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this._keyDownHandler);
  }

  protected willUpdate(changedProps: PropertyValues): void {
    super.willUpdate(changedProps);

    // When opening or when weekday changes externally, load blocks from scheduleData
    if (changedProps.has("open") || changedProps.has("weekday")) {
      if (this.open && this.weekday) {
        // Only re-parse if we're newly opening or the weekday changed from outside
        const wasOpen = changedProps.get("open") as boolean | undefined;
        const oldWeekday = changedProps.get("weekday") as Weekday | undefined;
        if ((!wasOpen && this.open) || (this.open && oldWeekday !== this.weekday)) {
          this._initializeEditor(this.weekday);
        }
      }
    }
  }

  private _initializeEditor(weekday: Weekday): void {
    this._editingWeekday = weekday;
    this._editingBlocks = this._getParsedBlocks(weekday);
    this._editingSlotIndex = undefined;
    this._editingSlotData = undefined;

    const weekdayData = this.scheduleData?.[weekday];
    if (weekdayData) {
      const { baseTemperature } = parseSimpleWeekdaySchedule(weekdayData);
      this._editingBaseTemperature = baseTemperature;
    } else {
      this._editingBaseTemperature = 20.0;
    }

    this._historyStack = [JSON.parse(JSON.stringify(this._editingBlocks)) as TimeBlock[]];
    this._historyIndex = 0;
    this._updateValidationWarnings();
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

  private _getWeekdayLabel(weekday: Weekday, format: "short" | "long"): string {
    if (format === "long") {
      return this.translations?.weekdayLongLabels[weekday] ?? weekday;
    }
    return this.translations?.weekdayShortLabels[weekday] ?? weekday.slice(0, 2);
  }

  private _formatTimeDisplay(time: string): string {
    return formatTime(time, this.hourFormat);
  }

  private _formatValidationParams(params?: Record<string, string>): Record<string, string> {
    if (!params) return {};
    const formatted: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (key === "weekday" && (WEEKDAYS as readonly Weekday[]).includes(value as Weekday)) {
        formatted.weekday = this._getWeekdayLabel(value as Weekday, "long");
      } else {
        formatted[key] = value;
      }
    }
    return formatted;
  }

  private _translateValidationMessage(message: ValidationMessage): string {
    const template = this.translations?.validationMessages[message.key] || message.key;
    const params = this._formatValidationParams(message.params);

    if (message.nested) {
      params.details = this._translateValidationMessage(message.nested);
    }

    let result = template;
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(`{${key}}`, value);
    }
    return result;
  }

  // History management
  private _saveHistoryState(): void {
    if (!this._editingBlocks) return;
    const stateCopy = JSON.parse(JSON.stringify(this._editingBlocks)) as TimeBlock[];
    this._historyStack = this._historyStack.slice(0, this._historyIndex + 1);
    this._historyStack.push(stateCopy);
    this._historyIndex++;
    if (this._historyStack.length > 50) {
      this._historyStack.shift();
      this._historyIndex--;
    }
  }

  private _undo(): void {
    if (this._historyIndex <= 0) return;
    this._historyIndex--;
    this._editingBlocks = JSON.parse(
      JSON.stringify(this._historyStack[this._historyIndex]),
    ) as TimeBlock[];
    this._updateValidationWarnings();
  }

  private _redo(): void {
    if (this._historyIndex >= this._historyStack.length - 1) return;
    this._historyIndex++;
    this._editingBlocks = JSON.parse(
      JSON.stringify(this._historyStack[this._historyIndex]),
    ) as TimeBlock[];
    this._updateValidationWarnings();
  }

  private _canUndo(): boolean {
    return this._historyIndex > 0;
  }

  private _canRedo(): boolean {
    return this._historyIndex < this._historyStack.length - 1;
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    if (!this.open || !this._editingWeekday || !this._editingBlocks) return;
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isCtrlOrCmd && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      this._undo();
    } else if (isCtrlOrCmd && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      this._redo();
    }
  }

  private _updateValidationWarnings(): void {
    if (!this._editingBlocks) {
      this._validationWarnings = [];
      return;
    }
    this._validationWarnings = validateTimeBlocks(this._editingBlocks, this.minTemp, this.maxTemp);
  }

  // Slot editing
  private _startSlotEdit(editingIndex: number): void {
    if (!this._editingBlocks || editingIndex < 0 || editingIndex >= this._editingBlocks.length)
      return;
    const block = this._editingBlocks[editingIndex];
    this._editingSlotIndex = editingIndex;
    this._editingSlotData = {
      startTime: block.startTime,
      endTime: block.endTime,
      temperature: block.temperature,
    };
  }

  private _startSlotEditFromDisplay(displayIndex: number, displayBlocks: TimeBlock[]): void {
    if (!this._editingBlocks) return;
    const displayBlock = displayBlocks[displayIndex];
    const editingIndex = this._editingBlocks.findIndex(
      (b) =>
        b.startMinutes === displayBlock.startMinutes &&
        b.endMinutes === displayBlock.endMinutes &&
        b.temperature === displayBlock.temperature,
    );
    if (editingIndex === -1) return;
    this._startSlotEdit(editingIndex);
  }

  private _cancelSlotEdit(): void {
    this._editingSlotIndex = undefined;
    this._editingSlotData = undefined;
  }

  private _saveSlotEdit(): void {
    if (
      this._editingSlotIndex === undefined ||
      !this._editingSlotData ||
      !this._editingBlocks ||
      this._editingBaseTemperature === undefined
    ) {
      return;
    }

    const index = this._editingSlotIndex;
    const { startTime, endTime, temperature } = this._editingSlotData;

    const updatedBlock: TimeBlock = {
      startTime,
      startMinutes: timeToMinutes(startTime),
      endTime,
      endMinutes: timeToMinutes(endTime),
      temperature,
      slot: index + 1,
    };

    const otherBlocks = this._editingBlocks.filter((_, i) => i !== index);
    const newBlocks = insertBlockWithSplitting(
      otherBlocks,
      updatedBlock,
      this._editingBaseTemperature,
    );
    const sortedBlocks = sortBlocksChronologically(newBlocks);
    const mergedBlocks = mergeConsecutiveBlocks(sortedBlocks);

    this._saveHistoryState();
    this._editingBlocks = mergedBlocks;
    this._editingSlotIndex = undefined;
    this._editingSlotData = undefined;
    this._updateValidationWarnings();
  }

  private _addNewSlot(): void {
    if (!this._editingBlocks || this._editingBaseTemperature === undefined) return;
    if (this._editingBlocks.length >= 12) return;

    let newStartMinutes = 0;
    let newEndMinutes = 60;

    if (this._editingBlocks.length > 0) {
      const sortedBlocks = sortBlocksChronologically(this._editingBlocks);
      const lastBlock = sortedBlocks[sortedBlocks.length - 1];

      if (lastBlock.endMinutes < 1440) {
        newStartMinutes = lastBlock.endMinutes;
        newEndMinutes = Math.min(newStartMinutes + 60, 1440);
      } else {
        let foundGap = false;
        for (let i = 0; i < sortedBlocks.length; i++) {
          const expectedStart = i === 0 ? 0 : sortedBlocks[i - 1].endMinutes;
          if (sortedBlocks[i].startMinutes > expectedStart) {
            newStartMinutes = expectedStart;
            newEndMinutes = sortedBlocks[i].startMinutes;
            foundGap = true;
            break;
          }
        }
        if (!foundGap) return;
      }
    }

    const newTemperature = Math.min(this._editingBaseTemperature + 2, this.maxTemp);

    const newBlock: TimeBlock = {
      startTime: minutesToTime(newStartMinutes),
      startMinutes: newStartMinutes,
      endTime: minutesToTime(newEndMinutes),
      endMinutes: newEndMinutes,
      temperature: newTemperature,
      slot: this._editingBlocks.length + 1,
    };

    this._saveHistoryState();
    const newBlocks = [...this._editingBlocks, newBlock];
    const sortedBlocks = sortBlocksChronologically(newBlocks);
    this._editingBlocks = sortedBlocks;

    const newIndex = sortedBlocks.findIndex(
      (b) => b.startMinutes === newStartMinutes && b.endMinutes === newEndMinutes,
    );
    if (newIndex >= 0) {
      this._startSlotEdit(newIndex);
    }
    this._updateValidationWarnings();
  }

  private _removeTimeBlockByIndex(displayIndex: number, displayBlocks: TimeBlock[]): void {
    if (!this._editingBlocks || this._editingBaseTemperature === undefined) return;

    const blockToRemove = displayBlocks[displayIndex];
    const editingIndex = this._editingBlocks.findIndex(
      (b) =>
        b.startMinutes === blockToRemove.startMinutes &&
        b.endMinutes === blockToRemove.endMinutes &&
        b.temperature === blockToRemove.temperature,
    );
    if (editingIndex === -1) return;

    this._saveHistoryState();
    const newBlocks = this._editingBlocks.filter((_, i) => i !== editingIndex);
    this._editingBlocks = mergeConsecutiveBlocks(sortBlocksChronologically(newBlocks));
    this._updateValidationWarnings();
  }

  // Navigation
  private _switchToWeekday(weekday: Weekday): void {
    if (weekday === this._editingWeekday) return;
    this._initializeEditor(weekday);
  }

  // Close / Save
  private _closeEditor(): void {
    this._editingWeekday = undefined;
    this._editingBlocks = undefined;
    this._editingBaseTemperature = undefined;
    this._editingSlotIndex = undefined;
    this._editingSlotData = undefined;
    this._historyStack = [];
    this._historyIndex = -1;

    this.dispatchEvent(new CustomEvent("editor-closed", { bubbles: true, composed: true }));
  }

  private _saveSchedule(): void {
    if (
      !this._editingWeekday ||
      !this._editingBlocks ||
      this._editingBaseTemperature === undefined
    ) {
      return;
    }

    const simpleWeekdayData = timeBlocksToSimpleWeekdayData(
      this._editingBlocks,
      this._editingBaseTemperature,
    );

    const validationError = validateSimpleWeekdayData(
      simpleWeekdayData,
      this.minTemp,
      this.maxTemp,
    );
    if (validationError) {
      const localizedError = this._translateValidationMessage(validationError);
      this.dispatchEvent(
        new CustomEvent<ValidationFailedDetail>("validation-failed", {
          detail: { error: localizedError },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }

    this.dispatchEvent(
      new CustomEvent<SaveScheduleDetail>("save-schedule", {
        detail: {
          weekday: this._editingWeekday,
          blocks: this._editingBlocks,
          baseTemperature: this._editingBaseTemperature,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    if (!this.open || !this._editingWeekday) return html``;

    return html`
      <ha-dialog
        open
        @closed=${this._closeEditor}
        .heading=${this._formatEdit(this._editingWeekday)}
      >
        <div class="dialog-content">
          <!-- Weekday selector tabs -->
          <div class="weekday-tabs">
            ${WEEKDAYS.map(
              (weekday) => html`
                <button
                  class="weekday-tab ${weekday === this._editingWeekday ? "active" : ""}"
                  @click=${() => this._switchToWeekday(weekday)}
                >
                  ${this._getWeekdayLabel(weekday, "short")}
                </button>
              `,
            )}
          </div>

          <!-- Editor content in dialog -->
          <div class="dialog-editor">${this._renderEditor()}</div>
        </div>
      </ha-dialog>
    `;
  }

  private _formatEdit(weekday: Weekday): string {
    const template = this.translations?.edit ?? "Edit {weekday}";
    return template.replace("{weekday}", this._getWeekdayLabel(weekday, "long"));
  }

  private _renderEditor() {
    if (!this._editingWeekday || !this._editingBlocks) return html``;

    const displayBlocks =
      this._editingBaseTemperature !== undefined
        ? fillGapsWithBaseTemperature(this._editingBlocks, this._editingBaseTemperature)
        : this._editingBlocks;

    return html`
      <div class="editor">
        <div class="editor-header">
          <h3>${this._formatEdit(this._editingWeekday)}</h3>
          <div class="editor-actions">
            <ha-icon-button
              .path=${"M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z"}
              @click=${this._undo}
              .disabled=${!this._canUndo()}
              .label=${this.translations?.undoShortcut ?? "Undo"}
            ></ha-icon-button>
            <ha-icon-button
              .path=${"M18.4,10.6C16.55,9 14.15,8 11.5,8C6.85,8 2.92,11.03 1.54,15.22L3.9,16C4.95,12.81 7.95,10.5 11.5,10.5C13.45,10.5 15.23,11.22 16.62,12.38L13,16H22V7L18.4,10.6Z"}
              @click=${this._redo}
              .disabled=${!this._canRedo()}
              .label=${this.translations?.redoShortcut ?? "Redo"}
            ></ha-icon-button>
            <ha-icon-button
              .path=${"M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"}
              @click=${this._closeEditor}
              .label=${"Close"}
            ></ha-icon-button>
          </div>
        </div>

        ${this._validationWarnings.length > 0
          ? html`
              <ha-alert alert-type="warning" .title=${this.translations?.warningsTitle ?? ""}>
                <ul class="warnings-list">
                  ${this._validationWarnings.map(
                    (warning) =>
                      html`<li class="warning-item">
                        ${this._translateValidationMessage(warning)}
                      </li>`,
                  )}
                </ul>
              </ha-alert>
            `
          : ""}

        <!-- Base Temperature Section -->
        <div class="base-temperature-section">
          <div class="base-temperature-header">
            <span class="base-temp-label">${this.translations?.baseTemperature ?? ""}</span>
            <span class="base-temp-description"
              >${this.translations?.baseTemperatureDescription ?? ""}</span
            >
          </div>
          <div class="base-temperature-input">
            <input
              type="number"
              class="temp-input base-temp-input"
              .value=${this._editingBaseTemperature?.toString() || "20.0"}
              step=${this.tempStep}
              min=${this.minTemp}
              max=${this.maxTemp}
              @change=${(e: Event) => {
                this._saveHistoryState();
                this._editingBaseTemperature = parseFloat((e.target as HTMLInputElement).value);
                this.requestUpdate();
              }}
            />
            <span class="temp-unit">${this.temperatureUnit}</span>
            <div
              class="color-indicator"
              style="background-color: ${getTemperatureColor(this._editingBaseTemperature || 20.0)}"
            ></div>
          </div>
        </div>

        <div class="editor-content-label">${this.translations?.temperaturePeriods ?? ""}</div>
        <div class="editor-content">
          <div class="time-block-header">
            <span class="header-cell header-from">${this.translations?.from ?? ""}</span>
            <span class="header-cell header-to">${this.translations?.to ?? ""}</span>
            <span class="header-cell header-temp">Temp</span>
            <span class="header-cell header-actions"></span>
          </div>
          ${displayBlocks.map((block, displayIndex) => {
            const editingIndex = this._editingBlocks!.findIndex(
              (b) => b.startMinutes === block.startMinutes && b.endMinutes === block.endMinutes,
            );

            const isActualBlock = editingIndex !== -1;
            const isEditing =
              this._editingSlotIndex !== undefined &&
              this._editingSlotIndex === editingIndex &&
              this._editingSlotData !== undefined;

            const isBaseTemp = !isActualBlock;

            if (isEditing && this._editingSlotData) {
              return html`
                <div class="time-block-editor editing">
                  <input
                    type="time"
                    class="time-input"
                    .value=${this._editingSlotData.startTime}
                    @change=${(e: Event) => {
                      if (this._editingSlotData) {
                        this._editingSlotData = {
                          ...this._editingSlotData,
                          startTime: (e.target as HTMLInputElement).value,
                        };
                        this.requestUpdate();
                      }
                    }}
                  />
                  <input
                    type="time"
                    class="time-input"
                    .value=${this._editingSlotData.endTime === "24:00"
                      ? "23:59"
                      : this._editingSlotData.endTime}
                    @change=${(e: Event) => {
                      if (this._editingSlotData) {
                        let value = (e.target as HTMLInputElement).value;
                        if (value === "23:59") value = "24:00";
                        this._editingSlotData = {
                          ...this._editingSlotData,
                          endTime: value,
                        };
                        this.requestUpdate();
                      }
                    }}
                  />
                  <div class="temp-input-group">
                    <input
                      type="number"
                      class="temp-input"
                      .value=${this._editingSlotData.temperature.toString()}
                      step=${this.tempStep}
                      min=${this.minTemp}
                      max=${this.maxTemp}
                      @change=${(e: Event) => {
                        if (this._editingSlotData) {
                          this._editingSlotData = {
                            ...this._editingSlotData,
                            temperature: parseFloat((e.target as HTMLInputElement).value),
                          };
                          this.requestUpdate();
                        }
                      }}
                    />
                    <span class="temp-unit">${this.temperatureUnit}</span>
                  </div>
                  <div class="slot-actions">
                    <ha-button @click=${this._saveSlotEdit}>
                      ${this.translations?.saveSlot ?? "Save"}
                    </ha-button>
                    <ha-button @click=${this._cancelSlotEdit}>
                      ${this.translations?.cancelSlotEdit ?? "Cancel"}
                    </ha-button>
                  </div>
                  <div
                    class="color-indicator"
                    style="background-color: ${getTemperatureColor(
                      this._editingSlotData.temperature,
                    )}"
                  ></div>
                </div>
              `;
            }

            return html`
              <div class="time-block-editor ${isBaseTemp ? "base-temp-slot" : ""}">
                <span class="time-display">${this._formatTimeDisplay(block.startTime)}</span>
                <span class="time-display">${this._formatTimeDisplay(block.endTime)}</span>
                <div class="temp-display-group">
                  <span class="temp-display">${block.temperature.toFixed(1)}</span>
                  <span class="temp-unit">${this.temperatureUnit}</span>
                </div>
                <div class="slot-actions">
                  ${isBaseTemp
                    ? html``
                    : html`
                        <ha-button
                          @click=${() =>
                            this._startSlotEditFromDisplay(displayIndex, displayBlocks)}
                          .disabled=${this._editingSlotIndex !== undefined}
                        >
                          ${this.translations?.editSlot ?? "Edit"}
                        </ha-button>
                        <ha-icon-button
                          class="remove-btn"
                          .path=${"M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"}
                          @click=${() => this._removeTimeBlockByIndex(displayIndex, displayBlocks)}
                          .disabled=${this._editingSlotIndex !== undefined}
                        ></ha-icon-button>
                      `}
                </div>
                <div
                  class="color-indicator"
                  style="background-color: ${getTemperatureColor(block.temperature)}"
                ></div>
              </div>
            `;
          })}
          ${this._editingBlocks.length < 12 && this._editingSlotIndex === undefined
            ? html`
                <ha-button class="add-btn" @click=${this._addNewSlot}>
                  ${this.translations?.addTimeBlock ?? "+ Add Time Block"}
                </ha-button>
              `
            : ""}
        </div>

        <div class="editor-footer">
          <ha-button @click=${this._closeEditor}>
            ${this.translations?.cancel ?? "Cancel"}
          </ha-button>
          <ha-button @click=${this._saveSchedule}> ${this.translations?.save ?? "Save"} </ha-button>
        </div>
      </div>
    `;
  }

  static styles = editorStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    "hmip-schedule-editor": HmipScheduleEditor;
  }
}
