import { describe, expect, it } from "vitest";

import {
  createHass,
  hassEntity,
  mount,
  optionsOf,
  query,
  queryOrThrow,
  statesOf,
  textOf,
  update,
} from "@hmip/test-utils";
import { WEEKDAYS } from "@hmip/schedule-core";

import { HomematicScheduleCard } from "./card";

const CARD = "homematicip-local-climate-schedule-card";

const scheduleData = Object.fromEntries(
  WEEKDAYS.map((weekday) => [
    weekday,
    {
      base_temperature: 17,
      periods: [{ starttime: "06:00", endtime: "09:00", temperature: 21.5 }],
    },
  ]),
);

const thermostat = (entityId: string, attributes: Record<string, unknown> = {}) =>
  hassEntity(entityId, "heat", {
    friendly_name: "Living Room",
    active_profile: "P1",
    available_profiles: ["P1", "P2"],
    schedule_data: scheduleData,
    ...attributes,
  });

/** Mount the card with a config applied, the way Lovelace does. */
async function mountCard(
  config: Record<string, unknown>,
  states: Record<string, ReturnType<typeof hassEntity>> = statesOf(thermostat("climate.living")),
): Promise<HomematicScheduleCard> {
  const card = await mount<HomematicScheduleCard>(CARD);
  card.setConfig(config as never);
  await update(card, { hass: createHass({ states }) as never });
  return card;
}

describe("climate schedule card", () => {
  it("registers itself under the Lovelace card type", () => {
    expect(customElements.get(CARD)).toBeDefined();
  });

  it("announces itself to the card picker", () => {
    expect(window.customCards?.some((card) => card.type === CARD)).toBe(true);
  });

  describe("getStubConfig", () => {
    it("preselects a climate entity that carries schedule data", () => {
      const hass = createHass({
        states: statesOf(
          hassEntity("climate.without_schedule", "heat"),
          thermostat("climate.living"),
        ),
      });

      expect(HomematicScheduleCard.getStubConfig(hass as never)).toEqual({
        type: `custom:${CARD}`,
        entities: ["climate.living"],
      });
    });

    it("yields an empty card when nothing schedulable exists", () => {
      const hass = createHass({ states: statesOf(hassEntity("light.kitchen")) });

      expect(HomematicScheduleCard.getStubConfig(hass as never)).toEqual({
        type: `custom:${CARD}`,
        entities: [],
      });
    });
  });

  it("renders nothing before Lovelace supplies a config", async () => {
    const card = await mount<HomematicScheduleCard>(CARD);

    expect(textOf(card)).toBe("");
  });

  it("renders the schedule grid for a thermostat", async () => {
    const card = await mountCard({ entity: "climate.living" });

    expect(query(card, "hmip-schedule-grid")).not.toBeNull();
  });

  it("names the card after the entity", async () => {
    const card = await mountCard({ entity: "climate.living" });

    expect(textOf(card)).toContain("Living Room");
  });

  it("prefers an explicitly configured name", async () => {
    const card = await mountCard({ entity: "climate.living", name: "Upstairs" });

    expect(textOf(card)).toContain("Upstairs");
  });

  it("reports an entity that is not in the state machine", async () => {
    const card = await mountCard({ entity: "climate.missing" }, {});

    expect(textOf(card)).toContain("Entity climate.missing not found");
  });

  it("reports a thermostat that exposes no schedule", async () => {
    const card = await mountCard(
      { entity: "climate.living" },
      statesOf(thermostat("climate.living", { schedule_data: undefined })),
    );

    expect(textOf(card)).toContain("does not provide schedule data");
  });

  it("rejects a sensor whose schedule is not a climate schedule", async () => {
    const card = await mountCard(
      { entity: "sensor.switch_schedule" },
      statesOf(
        hassEntity("sensor.switch_schedule", "on", {
          schedule_type: "switch",
          schedule_data: scheduleData,
        }),
      ),
    );

    expect(textOf(card)).toContain("does not have a climate schedule type");
  });

  it("translates the error into the Home Assistant language", async () => {
    const card = await mount<HomematicScheduleCard>(CARD);
    card.setConfig({ entity: "climate.missing" } as never);
    await update(card, { hass: createHass({ language: "de", states: {} }) as never });

    expect(textOf(card)).toContain("nicht gefunden");
  });

  it("lets the card config override the Home Assistant language", async () => {
    const card = await mount<HomematicScheduleCard>(CARD);
    card.setConfig({ entity: "climate.missing", language: "de" } as never);
    await update(card, { hass: createHass({ language: "en", states: {} }) as never });

    expect(textOf(card)).toContain("nicht gefunden");
  });

  describe("setConfig", () => {
    it("accepts the single-entity form", async () => {
      const card = await mountCard({ entity: "climate.living" });

      expect(textOf(card)).toContain("Living Room");
    });

    it("accepts the list form with plain entity ids", async () => {
      const card = await mountCard({ entities: ["climate.living"] });

      expect(textOf(card)).toContain("Living Room");
    });

    it("accepts the list form with entity objects", async () => {
      const card = await mountCard({ entities: [{ entity: "climate.living" }] });

      expect(textOf(card)).toContain("Living Room");
    });

    it("trims surrounding whitespace", async () => {
      const card = await mountCard({ entity: "  climate.living  " });

      expect(textOf(card)).toContain("Living Room");
    });

    it("shows an entity selector once more than one entity is configured", async () => {
      const card = await mountCard(
        { entities: ["climate.living", "climate.bedroom"] },
        statesOf(
          thermostat("climate.living"),
          thermostat("climate.bedroom", { friendly_name: "Bedroom" }),
        ),
      );

      expect(
        optionsOf(queryOrThrow(card, "ha-select.entity-selector")).map((option) => option.value),
      ).toEqual(["climate.bedroom", "climate.living"]);
    });

    it("keeps no entity selector for a single entity", async () => {
      const card = await mountCard({ entity: "climate.living" });

      expect(query(card, "ha-select.entity-selector")).toBeNull();
    });

    it("ignores an empty entity id", async () => {
      const card = await mountCard({ entity: "", entities: ["climate.living"] });

      expect(textOf(card)).toContain("Living Room");
    });
  });
});
