import { describe, expect, it } from "vitest";

import { createHass, hassEntity, mount, query, statesOf, textOf, update } from "@hmip/test-utils";

import { HomematicScheduleCard } from "./card";

const CARD = "homematicip-local-schedule-card";

/** One "switch on at 06:30 on weekdays" event, in the backend's wire shape. */
const scheduleEntries = {
  "1": {
    weekdays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    time: "06:30",
    condition: "fixed_time",
    astro_type: null,
    astro_offset_minutes: 0,
    target_channels: ["VCU0000001:4"],
    level: 1,
    level_2: null,
    duration: null,
    ramp_time: null,
    lock_mode: null,
    lock_action: null,
    permission: null,
  },
};

/** A switch entity carrying the schedule attributes the card requires. */
const scheduleEntity = (entityId: string, attributes: Record<string, unknown> = {}) =>
  hassEntity(entityId, "on", {
    friendly_name: "Garden Pump",
    schedule_type: "default",
    schedule_domain: "switch",
    schedule_channel_address: "VCU0000001:4",
    schedule_data: { entries: scheduleEntries },
    ...attributes,
  });

async function mountCard(
  config: Record<string, unknown>,
  states: Record<string, ReturnType<typeof hassEntity>> = statesOf(
    scheduleEntity("switch.garden_pump"),
  ),
): Promise<HomematicScheduleCard> {
  const card = await mount<HomematicScheduleCard>(CARD);
  card.setConfig(config as never);
  await update(card, { hass: createHass({ states }) as never });
  return card;
}

describe("schedule card", () => {
  it("registers itself under the Lovelace card type", () => {
    expect(customElements.get(CARD)).toBeDefined();
  });

  it("announces itself to the card picker", () => {
    expect(window.customCards?.some((card) => card.type === CARD)).toBe(true);
  });

  it("offers an editable stub config to the card picker", () => {
    expect(HomematicScheduleCard.getStubConfig()).toEqual({
      entity: "",
      editable: true,
      hour_format: "24",
    });
  });

  it("points the visual editor at its own editor element", () => {
    expect(HomematicScheduleCard.getConfigElement().localName).toBe(`${CARD}-editor`);
  });

  it("renders nothing before Lovelace supplies a config", async () => {
    const card = await mount<HomematicScheduleCard>(CARD);

    expect(textOf(card)).toBe("");
  });

  it("renders the schedule list for a compatible entity", async () => {
    const card = await mountCard({ entity: "switch.garden_pump" });

    expect(query(card, "hmip-device-schedule-list")).not.toBeNull();
  });

  it("waits with a loading state until the entity carries schedule entries", async () => {
    const card = await mountCard(
      { entity: "switch.garden_pump" },
      statesOf(scheduleEntity("switch.garden_pump", { schedule_data: undefined })),
    );

    expect(query(card, "hmip-device-schedule-list")).toBeNull();
    expect(textOf(card)).toContain("Loading");
  });

  it("names the card after the entity", async () => {
    const card = await mountCard({ entity: "switch.garden_pump" });

    expect(textOf(card)).toContain("Garden Pump");
  });

  it("prefers an explicitly configured name", async () => {
    const card = await mountCard({ entity: "switch.garden_pump", name: "Irrigation" });

    expect(textOf(card)).toContain("Irrigation");
  });

  it("reports an entity that is not in the state machine", async () => {
    const card = await mountCard({ entity: "switch.missing" }, {});

    expect(textOf(card)).toContain("Entity switch.missing not found");
  });

  it("rejects an entity whose schedule type is not 'default'", async () => {
    const card = await mountCard(
      { entity: "climate.living" },
      statesOf(scheduleEntity("climate.living", { schedule_type: "climate" })),
    );

    expect(textOf(card)).toContain("not a compatible schedule entity");
  });

  it("translates into the Home Assistant language", async () => {
    const card = await mount<HomematicScheduleCard>(CARD);
    card.setConfig({ entity: "switch.missing" } as never);
    await update(card, { hass: createHass({ language: "de", states: {} }) as never });

    expect(textOf(card)).toContain("nicht gefunden");
  });

  describe("setConfig", () => {
    it("accepts the single-entity form", async () => {
      const card = await mountCard({ entity: "switch.garden_pump" });

      expect(textOf(card)).toContain("Garden Pump");
    });

    it("accepts the list form with plain entity ids", async () => {
      const card = await mountCard({ entities: ["switch.garden_pump"] });

      expect(textOf(card)).toContain("Garden Pump");
    });

    it("trims surrounding whitespace", async () => {
      const card = await mountCard({ entity: "  switch.garden_pump  " });

      expect(textOf(card)).toContain("Garden Pump");
    });
  });
});
