import { describe, expect, it } from "vitest";

import { click, eventSpy, mount, queryAll, update } from "@hmip/test-utils";
import { WEEKDAYS, type SimpleProfileData, type Weekday } from "@hmip/schedule-core";

import "./schedule-grid";
import type { HmipScheduleGrid } from "./schedule-grid";
import type { GridTranslations } from "./types";

const weekdayShortLabels = Object.fromEntries(
  WEEKDAYS.map((weekday) => [weekday, weekday.slice(0, 2)]),
) as Record<Weekday, string>;

const translations: GridTranslations = {
  weekdayShortLabels,
  clickToEdit: "Click to edit",
  copySchedule: "Copy day",
  pasteSchedule: "Paste day",
};

/** One warm morning period; the rest of the day stays at the base temperature. */
const scheduleData: SimpleProfileData = Object.fromEntries(
  WEEKDAYS.map((weekday) => [
    weekday,
    {
      base_temperature: 17,
      periods: [{ starttime: "06:00", endtime: "09:00", temperature: 21.5 }],
    },
  ]),
);

const mountGrid = (properties: Partial<HmipScheduleGrid> = {}) =>
  mount<HmipScheduleGrid>("hmip-schedule-grid", { translations, scheduleData, ...properties });

describe("hmip-schedule-grid", () => {
  it("renders nothing before schedule data arrives", async () => {
    const grid = await mount<HmipScheduleGrid>("hmip-schedule-grid", { translations });

    expect(queryAll(grid, ".schedule-container")).toHaveLength(0);
  });

  it("renders a column per weekday", async () => {
    const grid = await mountGrid();

    expect(queryAll(grid, ".weekday-header")).toHaveLength(7);
    expect(queryAll(grid, ".time-blocks")).toHaveLength(7);
  });

  it("labels the columns from the translations", async () => {
    const grid = await mountGrid();

    expect(queryAll(grid, ".weekday-label").map((label) => label.textContent?.trim())).toEqual([
      "MO",
      "TU",
      "WE",
      "TH",
      "FR",
      "SA",
      "SU",
    ]);
  });

  it("falls back to a shortened weekday when no translation is supplied", async () => {
    const grid = await mount<HmipScheduleGrid>("hmip-schedule-grid", { scheduleData });

    expect(queryAll(grid, ".weekday-label")[0].textContent?.trim()).toBe("MO");
  });

  it("fills the gaps around a period with base-temperature blocks", async () => {
    const grid = await mountGrid();
    const monday = queryAll(grid, ".time-blocks")[0];

    // 00:00-06:00 base, 06:00-09:00 period, 09:00-24:00 base.
    expect(queryAll(monday, ".time-block")).toHaveLength(3);
  });

  it("offers no copy and paste while it is read-only", async () => {
    const grid = await mountGrid();

    expect(queryAll(grid, ".copy-btn")).toHaveLength(0);
    expect(queryAll(grid, ".paste-btn")).toHaveLength(0);
  });

  it("offers copy and paste per weekday once editable", async () => {
    const grid = await mountGrid({ editable: true });

    expect(queryAll(grid, ".copy-btn")).toHaveLength(7);
    expect(queryAll(grid, ".paste-btn")).toHaveLength(7);
  });

  it("stays silent on a click while it is read-only", async () => {
    const grid = await mountGrid();
    const clicks = eventSpy(grid, "weekday-click");

    await click(queryAll(grid, ".time-blocks")[0], grid);

    expect(clicks).toHaveLength(0);
  });

  it("reports which weekday was clicked", async () => {
    const grid = await mountGrid({ editable: true });
    const clicks = eventSpy<{ weekday: Weekday }>(grid, "weekday-click");

    await click(queryAll(grid, ".time-blocks")[2], grid);

    expect(clicks.map((event) => event.detail.weekday)).toEqual(["WEDNESDAY"]);
  });

  it("reports a copy without also reporting the weekday click underneath", async () => {
    const grid = await mountGrid({ editable: true });
    const copies = eventSpy<{ weekday: Weekday }>(grid, "copy-schedule");
    const clicks = eventSpy(grid, "weekday-click");

    await click(queryAll(grid, ".copy-btn")[1], grid);

    expect(copies.map((event) => event.detail.weekday)).toEqual(["TUESDAY"]);
    expect(clicks).toHaveLength(0);
  });

  it("reports a paste for its weekday", async () => {
    const grid = await mountGrid({ editable: true, copiedWeekday: "MONDAY" });
    const pastes = eventSpy<{ weekday: Weekday }>(grid, "paste-schedule");

    await click(queryAll(grid, ".paste-btn")[4], grid);

    expect(pastes.map((event) => event.detail.weekday)).toEqual(["FRIDAY"]);
  });

  it("disables pasting until a weekday was copied", async () => {
    const grid = await mountGrid({ editable: true });
    const pasteButton = queryAll<HTMLElement & { disabled: boolean }>(grid, ".paste-btn")[0];

    expect(pasteButton.disabled).toBe(true);

    await update(grid, { copiedWeekday: "MONDAY" });

    expect(queryAll<HTMLElement & { disabled: boolean }>(grid, ".paste-btn")[0].disabled).toBe(
      false,
    );
  });

  it("marks the weekday the schedule was copied from", async () => {
    const grid = await mountGrid({ editable: true, copiedWeekday: "THURSDAY" });

    expect(queryAll(grid, ".copy-btn.active")).toHaveLength(1);
    expect(queryAll(grid, ".copy-btn")[3].classList.contains("active")).toBe(true);
  });
});
