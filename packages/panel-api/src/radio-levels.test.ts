import { describe, expect, it } from "vitest";

import { createHass, hassEntity } from "@hmip/test-utils";

import { csLevelClass, dcLevelClass, getRadioLevels, loadEntryEntityIds } from "./radio-levels";

const dutyCycle = (id: string, name: string, state: string) =>
  hassEntity(`sensor.${id}_duty_cycle_level`, state, { friendly_name: `${name} Duty Cycle Level` });

const carrierSense = (id: string, name: string, state: string) =>
  hassEntity(`sensor.${id}_carrier_sense_level`, state, {
    friendly_name: `${name} Carrier Sense Level`,
  });

const statesOf = (...entities: ReturnType<typeof hassEntity>[]) =>
  Object.fromEntries(entities.map((entity) => [entity.entity_id, entity]));

describe("getRadioLevels", () => {
  it("returns nothing without states", () => {
    expect(getRadioLevels(undefined, undefined)).toEqual([]);
  });

  it("pairs the duty cycle and carrier sense sensors of one device", () => {
    const levels = getRadioLevels(
      statesOf(dutyCycle("ccu", "CCU", "12.5"), carrierSense("ccu", "CCU", "3")),
      undefined,
    );

    expect(levels).toEqual([{ name: "CCU", dutyCycle: 12.5, carrierSense: 3 }]);
  });

  it("leaves the missing half of a pair null", () => {
    const levels = getRadioLevels(statesOf(dutyCycle("ccu", "CCU", "12.5")), undefined);

    expect(levels).toEqual([{ name: "CCU", dutyCycle: 12.5, carrierSense: null }]);
  });

  it("ignores sensors that are neither duty cycle nor carrier sense", () => {
    const levels = getRadioLevels(
      statesOf(hassEntity("sensor.ccu_temperature", "21.5"), dutyCycle("ccu", "CCU", "1")),
      undefined,
    );

    expect(levels).toHaveLength(1);
    expect(levels[0].name).toBe("CCU");
  });

  it("ignores non-sensor entities", () => {
    expect(
      getRadioLevels(statesOf(hassEntity("switch.ccu_duty_cycle_level", "5")), undefined),
    ).toEqual([]);
  });

  it("keeps a non-numeric state as null instead of NaN", () => {
    const levels = getRadioLevels(statesOf(dutyCycle("ccu", "CCU", "unavailable")), undefined);

    expect(levels).toEqual([{ name: "CCU", dutyCycle: null, carrierSense: null }]);
  });

  it("falls back to the entity id when the entity has no friendly name", () => {
    const levels = getRadioLevels(
      { "sensor.ccu_duty_cycle_level": hassEntity("sensor.ccu_duty_cycle_level", "1") },
      undefined,
    );

    expect(levels[0].name).toBe("sensor.ccu_duty_cycle_level");
  });

  it("strips the spaced and unspaced label suffixes", () => {
    const levels = getRadioLevels(
      {
        "sensor.a_duty_cycle_level": hassEntity("sensor.a_duty_cycle_level", "1", {
          friendly_name: "Hub A DutyCycle Level",
        }),
        "sensor.b_carrier_sense_level": hassEntity("sensor.b_carrier_sense_level", "1", {
          friendly_name: "Hub B CarrierSense Level",
        }),
      },
      undefined,
    );

    expect(levels.map((level) => level.name)).toEqual(["Hub A", "Hub B"]);
  });

  it("keeps only entities belonging to the config entry", () => {
    const levels = getRadioLevels(
      statesOf(dutyCycle("mine", "Mine", "1"), dutyCycle("other", "Other", "2")),
      new Set(["sensor.mine_duty_cycle_level"]),
    );

    expect(levels.map((level) => level.name)).toEqual(["Mine"]);
  });

  it("sorts devices by name", () => {
    const levels = getRadioLevels(
      statesOf(
        dutyCycle("zulu", "Zulu", "1"),
        dutyCycle("alpha", "Alpha", "2"),
        dutyCycle("mike", "Mike", "3"),
      ),
      undefined,
    );

    expect(levels.map((level) => level.name)).toEqual(["Alpha", "Mike", "Zulu"]);
  });
});

describe("loadEntryEntityIds", () => {
  it("keeps the entity ids of the requested entry only", async () => {
    const hass = createHass({
      ws: {
        "config/entity_registry/list": [
          { entity_id: "sensor.mine", config_entry_id: "entry-1" },
          { entity_id: "sensor.other", config_entry_id: "entry-2" },
        ],
      },
    });

    expect(await loadEntryEntityIds(hass, "entry-1")).toEqual(new Set(["sensor.mine"]));
  });

  it("returns undefined when the registry is unreachable, so callers stop filtering", async () => {
    const hass = createHass();
    hass.failWith("config/entity_registry/list", new Error("unauthorized"));

    expect(await loadEntryEntityIds(hass, "entry-1")).toBeUndefined();
  });
});

describe("level severity classes", () => {
  it.each([
    [null, ""],
    [0, ""],
    [59.9, ""],
    [60, "warning"],
    [79.9, "warning"],
    [80, "error"],
    [100, "error"],
  ])("maps a duty cycle of %s to %s", (value, expected) => {
    expect(dcLevelClass(value)).toBe(expected);
  });

  it.each([
    [null, ""],
    [0, ""],
    [9.9, ""],
    [10, "error"],
  ])("maps a carrier sense of %s to %s", (value, expected) => {
    expect(csLevelClass(value)).toBe(expected);
  });
});
