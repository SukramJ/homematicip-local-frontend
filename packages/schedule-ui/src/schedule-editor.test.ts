import { describe, expect, it } from "vitest";

import { click, eventSpy, mount, query, queryAll, setValue, settle } from "@hmip/test-utils";
import {
  WEEKDAYS,
  type ClimateValidationMessageKey,
  type SimpleProfileData,
  type Weekday,
} from "@hmip/schedule-core";

import "./schedule-editor";
import type { HmipScheduleEditor } from "./schedule-editor";
import type { EditorTranslations, SaveScheduleDetail } from "./types";

const weekdayShortLabels = Object.fromEntries(
  WEEKDAYS.map((weekday) => [weekday, weekday.slice(0, 2)]),
) as Record<Weekday, string>;

const validationMessages = {} as Record<ClimateValidationMessageKey, string>;

const translations: EditorTranslations = {
  weekdayShortLabels,
  weekdayLongLabels: weekdayShortLabels,
  edit: "Edit {weekday}",
  cancel: "Cancel",
  save: "Save",
  saveAll: "Save all",
  discard: "Discard",
  keepEditing: "Keep editing",
  unsavedChanges: "Unsaved changes",
  confirmDiscardChanges: "Discard your changes?",
  addTimeBlock: "+ Add",
  from: "From",
  to: "To",
  baseTemperature: "Base",
  baseTemperatureDescription: "Base description",
  temperaturePeriods: "Periods",
  editSlot: "Edit",
  saveSlot: "Apply",
  cancelSlotEdit: "Cancel",
  undoShortcut: "Undo",
  redoShortcut: "Redo",
  removeSlot: "Remove",
  close: "Close",
  warningsTitle: "Warnings",
  validationMessages,
};

/** One warm morning period per day; the rest of the day stays at 17 °C. */
const buildScheduleData = (): SimpleProfileData =>
  Object.fromEntries(
    WEEKDAYS.map((weekday) => [
      weekday,
      {
        base_temperature: 17,
        periods: [{ starttime: "06:00", endtime: "09:00", temperature: 21.5 }],
      },
    ]),
  );

const mountEditor = (properties: Partial<HmipScheduleEditor> = {}) =>
  mount<HmipScheduleEditor>("hmip-schedule-editor", {
    translations,
    scheduleData: buildScheduleData(),
    open: true,
    weekday: "MONDAY",
    ...properties,
  });

/** The weekday tab buttons, in `WEEKDAYS` order. */
const tabs = (editor: HmipScheduleEditor) => queryAll<HTMLButtonElement>(editor, ".weekday-tab");

const switchToWeekday = async (editor: HmipScheduleEditor, weekday: Weekday) => {
  await click(tabs(editor)[WEEKDAYS.indexOf(weekday)], editor);
};

/** Every rendered row, base-temperature fillers included. */
const rows = (editor: HmipScheduleEditor) => queryAll(editor, ".time-block-editor");

/** The temperatures shown in the rows, in display order. */
const shownTemperatures = (editor: HmipScheduleEditor) =>
  queryAll(editor, ".temp-display").map((cell) => cell.textContent?.trim());

/** Rows backed by a real period — only those carry an edit button. */
const editableRows = (editor: HmipScheduleEditor) =>
  rows(editor).filter((row) => queryAll(row, ".slot-actions ha-button").length > 0);

/** Buttons of the row currently in inline-edit mode. */
const slotButton = (editor: HmipScheduleEditor, label: string) =>
  queryAll(editor, ".time-block-editor.editing .slot-actions ha-button").find(
    (button) => button.textContent?.trim() === label,
  )!;

const footerButton = (editor: HmipScheduleEditor, label: string) =>
  queryAll(editor, ".editor-footer ha-button").find(
    (button) => button.textContent?.trim() === label,
  )!;

/** Open the first period of the shown weekday, set a temperature, apply it. */
const changeFirstPeriod = async (editor: HmipScheduleEditor, temperature: number) => {
  await click(queryAll(editableRows(editor)[0], ".slot-actions ha-button")[0], editor);
  setValue(query(editor, ".time-block-editor.editing .temp-input")!, String(temperature));
  await settle(editor);
  await click(slotButton(editor, "Apply"), editor);
};

describe("hmip-schedule-editor", () => {
  it("renders nothing while closed", async () => {
    const editor = await mountEditor({ open: false });

    expect(queryAll(editor, ".weekday-tab")).toHaveLength(0);
  });

  it("renders a tab per weekday and marks the edited one", async () => {
    const editor = await mountEditor();

    expect(tabs(editor)).toHaveLength(7);
    expect(tabs(editor)[0].classList.contains("active")).toBe(true);
  });

  it("fills the gaps around a period with base-temperature rows", async () => {
    const editor = await mountEditor();

    // 00:00-06:00 base, 06:00-09:00 period, 09:00-24:00 base.
    expect(rows(editor)).toHaveLength(3);
    expect(editableRows(editor)).toHaveLength(1);
  });

  it("applies an inline slot edit to the shown weekday", async () => {
    const editor = await mountEditor();

    await changeFirstPeriod(editor, 23);

    expect(shownTemperatures(editor)).toContain("23.0");
  });

  // Regression: issue #95 — leaving a weekday tab discarded every unsaved edit.
  it("keeps an applied slot edit when switching weekdays and back", async () => {
    const editor = await mountEditor();

    await changeFirstPeriod(editor, 23);
    await switchToWeekday(editor, "TUESDAY");

    expect(shownTemperatures(editor)).toContain("21.5");

    await switchToWeekday(editor, "MONDAY");

    expect(shownTemperatures(editor)).toContain("23.0");
  });

  it("keeps a changed base temperature when switching weekdays and back", async () => {
    const editor = await mountEditor();

    setValue(query(editor, ".base-temp-input")!, "18.5");
    await settle(editor);
    await switchToWeekday(editor, "TUESDAY");
    await switchToWeekday(editor, "MONDAY");

    expect(query<HTMLInputElement>(editor, ".base-temp-input")!.value).toBe("18.5");
  });

  it("marks the weekdays carrying unsaved changes", async () => {
    const editor = await mountEditor();

    await changeFirstPeriod(editor, 23);
    await switchToWeekday(editor, "WEDNESDAY");
    await changeFirstPeriod(editor, 19);

    expect(
      tabs(editor)
        .filter((tab) => tab.classList.contains("dirty"))
        .map((tab) => tab.textContent?.trim()),
    ).toEqual(["MO", "WE"]);
  });

  it("marks no weekday when an edit ends up back at the stored value", async () => {
    const editor = await mountEditor();

    await changeFirstPeriod(editor, 23);
    await changeFirstPeriod(editor, 21.5);

    expect(tabs(editor).filter((tab) => tab.classList.contains("dirty"))).toHaveLength(0);
  });

  it("keeps an independent undo history per weekday", async () => {
    const editor = await mountEditor();

    await changeFirstPeriod(editor, 23);
    await switchToWeekday(editor, "TUESDAY");

    // Tuesday was never touched, so its history is empty and undo is disabled.
    const [undo] = queryAll<HTMLElement & { disabled: boolean }>(
      editor,
      ".editor-actions ha-icon-button",
    );
    expect(undo.disabled).toBe(true);

    await switchToWeekday(editor, "MONDAY");
    expect(
      queryAll<HTMLElement & { disabled: boolean }>(editor, ".editor-actions ha-icon-button")[0]
        .disabled,
    ).toBe(false);
  });

  it("blocks the weekday tabs while a slot is being edited", async () => {
    const editor = await mountEditor();

    await click(queryAll(editableRows(editor)[0], ".slot-actions ha-button")[0], editor);

    expect(tabs(editor).every((tab) => tab.disabled)).toBe(true);
  });

  it("saves every changed weekday in one event", async () => {
    const editor = await mountEditor();
    const saves = eventSpy<SaveScheduleDetail>(editor, "save-schedule");

    await changeFirstPeriod(editor, 23);
    await switchToWeekday(editor, "WEDNESDAY");
    await changeFirstPeriod(editor, 19);
    await click(footerButton(editor, "Save all"), editor);

    expect(saves).toHaveLength(1);
    expect(saves[0].detail.days.map((day) => day.weekday)).toEqual(["MONDAY", "WEDNESDAY"]);
    expect(saves[0].detail.days.map((day) => day.blocks[0].temperature)).toEqual([23, 19]);
  });

  it("saves the shown weekday alone without touching the untouched ones", async () => {
    const editor = await mountEditor();
    const saves = eventSpy<SaveScheduleDetail>(editor, "save-schedule");

    await changeFirstPeriod(editor, 23);
    await click(footerButton(editor, "Save"), editor);

    expect(saves[0].detail.days.map((day) => day.weekday)).toEqual(["MONDAY"]);
  });

  it("closes instead of saving when nothing was changed", async () => {
    const editor = await mountEditor();
    const saves = eventSpy(editor, "save-schedule");
    const closes = eventSpy(editor, "editor-closed");

    await click(footerButton(editor, "Save"), editor);

    expect(saves).toHaveLength(0);
    expect(closes).toHaveLength(1);
  });

  it("closes straight away when there is nothing to lose", async () => {
    const editor = await mountEditor();
    const closes = eventSpy(editor, "editor-closed");

    await click(footerButton(editor, "Cancel"), editor);

    expect(closes).toHaveLength(1);
  });

  it("asks before dropping unsaved changes", async () => {
    const editor = await mountEditor();
    const closes = eventSpy(editor, "editor-closed");

    await changeFirstPeriod(editor, 23);
    await click(footerButton(editor, "Cancel"), editor);

    expect(closes).toHaveLength(0);
    expect(query(editor, ".discard-confirm")).not.toBeNull();
  });

  it("returns to the editor when the discard prompt is dismissed", async () => {
    const editor = await mountEditor();

    await changeFirstPeriod(editor, 23);
    await click(footerButton(editor, "Cancel"), editor);
    await click(
      queryAll(editor, ".discard-confirm ha-button").find(
        (button) => button.textContent?.trim() === "Keep editing",
      )!,
      editor,
    );

    expect(query(editor, ".discard-confirm")).toBeNull();
    expect(shownTemperatures(editor)).toContain("23.0");
  });

  it("closes once the discard is confirmed", async () => {
    const editor = await mountEditor();
    const closes = eventSpy(editor, "editor-closed");

    await changeFirstPeriod(editor, 23);
    await click(footerButton(editor, "Cancel"), editor);
    await click(
      queryAll(editor, ".discard-confirm ha-button").find(
        (button) => button.textContent?.trim() === "Discard",
      )!,
      editor,
    );

    expect(closes).toHaveLength(1);
  });

  it("starts from the stored schedule again after being reopened", async () => {
    const editor = await mountEditor();

    await changeFirstPeriod(editor, 23);
    await click(footerButton(editor, "Cancel"), editor);
    await click(
      queryAll(editor, ".discard-confirm ha-button").find(
        (button) => button.textContent?.trim() === "Discard",
      )!,
      editor,
    );

    editor.open = false;
    await settle(editor);
    editor.open = true;
    await settle(editor);

    expect(shownTemperatures(editor)).toContain("21.5");
    expect(tabs(editor).filter((tab) => tab.classList.contains("dirty"))).toHaveLength(0);
  });
});
