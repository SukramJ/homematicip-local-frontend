import { LitElement, html, PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
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
import type {
  EditorTranslations,
  SaveScheduleDay,
  SaveScheduleDetail,
  ValidationFailedDetail,
} from "./types";
import { editorStyles } from "./styles/editor-styles";

/** A weekday's work in progress, kept while another tab is shown. */
interface WeekdayDraft {
  blocks: TimeBlock[];
  baseTemperature: number;
  historyStack: TimeBlock[][];
  historyIndex: number;
}

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
  /** The weekdays edited but not written back yet, in `WEEKDAYS` order. */
  @state() private _dirtyWeekdays: Weekday[] = [];
  /** Shows the "drop your changes?" prompt instead of the editor body. */
  @state() private _confirmDiscard = false;
  /** Rebuilds `ha-dialog` after it closed itself on Escape or a scrim click. */
  @state() private _dialogEpoch = 0;

  /**
   * The weekdays left behind by a tab switch, keyed by weekday.
   *
   * The backend stores schedules per weekday and the editor writes them all at
   * once on save, so leaving a tab may not drop what was edited there — before
   * this existed, switching away re-parsed `scheduleData` and silently reverted
   * every unsaved change (issue #95).
   */
  private _drafts = new Map<Weekday, WeekdayDraft>();
  /** Each weekday's stored state, to tell an actual change from a round trip. */
  private _baselines = new Map<Weekday, string>();
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
          // A weekday arriving from outside starts a new editing session, so
          // whatever an earlier one left behind is no longer ours to keep.
          this._resetSession(this.weekday);
        }
      }
    }
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);

    // Focus the first interactive element when the editor opens
    if (changedProps.has("open") && this.open && !changedProps.get("open")) {
      this.updateComplete.then(() => {
        const firstButton = this.shadowRoot?.querySelector<HTMLElement>(
          ".weekday-tab, .base-temp-input, ha-button",
        );
        firstButton?.focus();
      });
    }
  }

  /** Drop every draft and start over on `weekday`. */
  private _resetSession(weekday: Weekday): void {
    this._drafts.clear();
    this._baselines.clear();
    this._dirtyWeekdays = [];
    this._confirmDiscard = false;
    this._showWeekday(weekday);
  }

  /**
   * Show `weekday`, restoring its draft if it has one and parsing it from
   * `scheduleData` otherwise.
   */
  private _showWeekday(weekday: Weekday): void {
    this._editingWeekday = weekday;
    this._editingSlotIndex = undefined;
    this._editingSlotData = undefined;

    const draft = this._drafts.get(weekday);
    if (draft) {
      this._editingBlocks = draft.blocks;
      this._editingBaseTemperature = draft.baseTemperature;
      this._historyStack = draft.historyStack;
      this._historyIndex = draft.historyIndex;
      this._updateValidationWarnings();
      return;
    }

    this._editingBlocks = this._getParsedBlocks(weekday);

    const weekdayData = this.scheduleData?.[weekday];
    if (weekdayData) {
      const { baseTemperature } = parseSimpleWeekdaySchedule(weekdayData);
      this._editingBaseTemperature = baseTemperature;
    } else {
      this._editingBaseTemperature = 20.0;
    }

    this._baselines.set(
      weekday,
      this._serializeDay(this._editingBlocks, this._editingBaseTemperature),
    );
    this._historyStack = [JSON.parse(JSON.stringify(this._editingBlocks)) as TimeBlock[]];
    this._historyIndex = 0;
    this._updateValidationWarnings();
  }

  /** Copy what is on screen into the draft of the weekday it belongs to. */
  private _stashCurrentWeekday(): void {
    if (!this._editingWeekday || !this._editingBlocks) return;
    if (this._editingBaseTemperature === undefined) return;

    this._drafts.set(this._editingWeekday, {
      blocks: this._editingBlocks,
      baseTemperature: this._editingBaseTemperature,
      historyStack: this._historyStack,
      historyIndex: this._historyIndex,
    });
  }

  /**
   * A weekday's schedule in the exact shape that would reach the backend.
   *
   * Comparing that instead of the blocks themselves keeps equivalent block
   * layouts — a split that was merged back, a period re-entered unchanged —
   * from counting as an edit.
   */
  private _serializeDay(blocks: TimeBlock[], baseTemperature: number): string {
    return JSON.stringify(timeBlocksToSimpleWeekdayData(blocks, baseTemperature));
  }

  /** Re-check whether the shown weekday still matches its stored schedule. */
  private _refreshDirtyState(): void {
    if (!this._editingWeekday || !this._editingBlocks) return;
    if (this._editingBaseTemperature === undefined) return;

    const weekday = this._editingWeekday;
    const changed =
      this._serializeDay(this._editingBlocks, this._editingBaseTemperature) !==
      this._baselines.get(weekday);
    const wasDirty = this._dirtyWeekdays.includes(weekday);

    if (changed === wasDirty) return;
    this._dirtyWeekdays = WEEKDAYS.filter((day) =>
      day === weekday ? changed : this._dirtyWeekdays.includes(day),
    );
  }

  /** Every changed weekday, the shown one included. */
  private _collectChangedDays(): SaveScheduleDay[] {
    this._stashCurrentWeekday();
    return this._dirtyWeekdays.flatMap((weekday) => {
      const draft = this._drafts.get(weekday);
      if (!draft) return [];
      return [{ weekday, blocks: draft.blocks, baseTemperature: draft.baseTemperature }];
    });
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
    this._commitEdit();
  }

  private _redo(): void {
    if (this._historyIndex >= this._historyStack.length - 1) return;
    this._historyIndex++;
    this._editingBlocks = JSON.parse(
      JSON.stringify(this._historyStack[this._historyIndex]),
    ) as TimeBlock[];
    this._commitEdit();
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

  /**
   * Finish an edit of the shown weekday: re-validate, re-check whether it still
   * matches the stored schedule, and keep its draft current so a tab switch
   * cannot lose it.
   */
  private _commitEdit(): void {
    this._updateValidationWarnings();
    this._refreshDirtyState();
    this._stashCurrentWeekday();
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
    this._commitEdit();
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
    this._commitEdit();
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
    this._commitEdit();
  }

  // Navigation
  private _switchToWeekday(weekday: Weekday): void {
    if (weekday === this._editingWeekday) return;
    // A half-finished inline edit has no place in a draft, and the tabs are
    // disabled while one is open, so this only guards a stray programmatic call.
    if (this._editingSlotIndex !== undefined) return;

    this._stashCurrentWeekday();
    this._showWeekday(weekday);
  }

  // Close / Save
  /**
   * `ha-dialog` closed itself. Reopen it around the discard prompt when there
   * is unsaved work, since by then the dialog is already gone.
   */
  private _onDialogClosed(): void {
    this._stashCurrentWeekday();
    if (this._dirtyWeekdays.length > 0) {
      this._confirmDiscard = true;
      this._dialogEpoch++;
      return;
    }
    this._closeEditor();
  }

  private _cancelDiscard(): void {
    this._confirmDiscard = false;
  }

  /** Close unless there is unsaved work, in which case ask about it first. */
  private _requestClose(): void {
    this._stashCurrentWeekday();
    if (this._dirtyWeekdays.length > 0) {
      this._confirmDiscard = true;
      return;
    }
    this._closeEditor();
  }

  private _closeEditor(): void {
    this._editingWeekday = undefined;
    this._editingBlocks = undefined;
    this._editingBaseTemperature = undefined;
    this._editingSlotIndex = undefined;
    this._editingSlotData = undefined;
    this._historyStack = [];
    this._historyIndex = -1;
    this._drafts.clear();
    this._baselines.clear();
    this._dirtyWeekdays = [];
    this._confirmDiscard = false;

    this.dispatchEvent(new CustomEvent("editor-closed", { bubbles: true, composed: true }));
  }

  /**
   * Report every changed weekday in one event.
   *
   * A weekday that failed to validate is brought back on screen so the warning
   * banner points at the schedule it is about.
   */
  private _saveSchedule(): void {
    if (!this._editingWeekday) return;

    const days = this._collectChangedDays();
    if (days.length === 0) {
      // Nothing to write — a save that changes nothing just closes the dialog.
      this._closeEditor();
      return;
    }

    for (const day of days) {
      const validationError = validateSimpleWeekdayData(
        timeBlocksToSimpleWeekdayData(day.blocks, day.baseTemperature),
        this.minTemp,
        this.maxTemp,
      );
      if (!validationError) continue;

      if (day.weekday !== this._editingWeekday) {
        this._showWeekday(day.weekday);
      }
      this.dispatchEvent(
        new CustomEvent<ValidationFailedDetail>("validation-failed", {
          detail: { error: this._translateValidationMessage(validationError) },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }

    this.dispatchEvent(
      new CustomEvent<SaveScheduleDetail>("save-schedule", {
        detail: { days },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    if (!this.open || !this._editingWeekday) return html``;

    // Escape and a scrim click close `ha-dialog` outright — HA 2026.3 dropped
    // `escapeKeyAction` / `scrimClickAction`. Bumping the key rebuilds the
    // element, which is what brings the discard prompt back into view.
    return keyed(
      this._dialogEpoch,
      html`
        <ha-dialog
          open
          @closed=${this._onDialogClosed}
          .heading=${this._formatEdit(this._editingWeekday)}
        >
          <div class="dialog-content">
            <!-- Weekday selector tabs -->
            <div class="weekday-tabs">
              ${WEEKDAYS.map(
                (weekday) => html`
                  <button
                    class="weekday-tab ${weekday === this._editingWeekday ? "active" : ""} ${
                      this._dirtyWeekdays.includes(weekday) ? "dirty" : ""
                    }"
                    .disabled=${this._editingSlotIndex !== undefined || this._confirmDiscard}
                    .title=${
                      this._dirtyWeekdays.includes(weekday)
                        ? (this.translations?.unsavedChanges ?? "Unsaved changes")
                        : ""
                    }
                    @click=${() => this._switchToWeekday(weekday)}
                  >
                    ${this._getWeekdayLabel(weekday, "short")}
                  </button>
                `,
              )}
            </div>

            <!-- Editor content in dialog -->
            <div class="dialog-editor">
              ${this._confirmDiscard ? this._renderDiscardConfirm() : this._renderEditor()}
            </div>
          </div>
        </ha-dialog>
      `,
    );
  }

  private _renderDiscardConfirm() {
    const days = this._dirtyWeekdays
      .map((weekday) => this._getWeekdayLabel(weekday, "long"))
      .join(", ");

    return html`
      <div class="discard-confirm">
        <ha-alert alert-type="warning" .title=${this.translations?.unsavedChanges ?? ""}>
          ${this.translations?.confirmDiscardChanges ?? "Discard your unsaved changes?"}
          <div class="discard-days">${days}</div>
        </ha-alert>
        <div class="editor-footer">
          <ha-button @click=${this._cancelDiscard}>
            ${this.translations?.keepEditing ?? "Keep editing"}
          </ha-button>
          <ha-button class="discard-btn" @click=${this._closeEditor}>
            ${this.translations?.discard ?? "Discard"}
          </ha-button>
        </div>
      </div>
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
              @click=${this._requestClose}
              .label=${this.translations?.close ?? "Close"}
            ></ha-icon-button>
          </div>
        </div>

        <div aria-live="polite">
          ${
            this._validationWarnings.length > 0
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
              : ""
          }
        </div>

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
                this._commitEdit();
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
                    .value=${
                      this._editingSlotData.endTime === "24:00"
                        ? "23:59"
                        : this._editingSlotData.endTime
                    }
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
                  ${
                    isBaseTemp
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
                            .label=${this.translations?.removeSlot ?? "Remove"}
                          ></ha-icon-button>
                        `
                  }
                </div>
                <div
                  class="color-indicator"
                  style="background-color: ${getTemperatureColor(block.temperature)}"
                ></div>
              </div>
            `;
          })}
          ${
            this._editingBlocks.length < 12 && this._editingSlotIndex === undefined
              ? html`
                  <ha-button class="add-btn" @click=${this._addNewSlot}>
                    ${this.translations?.addTimeBlock ?? "+ Add Time Block"}
                  </ha-button>
                `
              : ""
          }
        </div>

        <div class="editor-footer">
          <ha-button @click=${this._requestClose}>
            ${this.translations?.cancel ?? "Cancel"}
          </ha-button>
          <ha-button class="save-btn" @click=${this._saveSchedule}>
            ${
              this._dirtyWeekdays.length > 1
                ? (this.translations?.saveAll ?? "Save all")
                : (this.translations?.save ?? "Save")
            }
          </ha-button>
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
