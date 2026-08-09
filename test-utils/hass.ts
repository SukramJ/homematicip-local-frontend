/**
 * A fake `HomeAssistant` object.
 *
 * Every panel and card API call goes through `hass.callWS()`, so injecting a
 * fake `hass` is the whole seam needed to test them — no module mocking, no
 * live WebSocket connection.
 *
 * `@hmip/panel-api` and `@hmip/schedule-core` each declare their own slice of
 * Home Assistant: the panel reads `config.language`, the cards read `language` /
 * `locale.language`, and only the cards require `states`. The fake is built on
 * the wider `schedule-core` shape, which structurally satisfies the panel's too,
 * so a single helper serves every package.
 */
import type { HassEntity, HassUser, HomeAssistant } from "@hmip/schedule-core";

/** A WebSocket message as the panel sends it: a command `type` plus payload. */
export type WsMessage = Record<string, unknown> & { type: string };

/** A canned response, or a function computing one from the incoming message. */
export type WsResponse = unknown | ((message: WsMessage) => unknown);

export interface FakeHassOptions {
  /** Drives every language lookup; `"en"` unless a test needs other strings. */
  language?: string;
  darkMode?: boolean;
  states?: Record<string, HassEntity>;
  user?: Partial<HassUser>;
  /** Responses keyed by the command `type` the code under test sends. */
  ws?: Record<string, WsResponse>;
}

export interface FakeHass extends HomeAssistant {
  themes: { darkMode: boolean };
  user: HassUser;
  /** Every message passed to `callWS`, in call order. */
  readonly sent: WsMessage[];
  /** The messages sent for one command type. */
  sentOf(type: string): WsMessage[];
  /** The single message sent for one command type; throws unless there is exactly one. */
  lastSent(type: string): WsMessage;
  /** Register or replace a response after construction. */
  respond(type: string, response: WsResponse): void;
  /** Make a command reject, to exercise error paths. */
  failWith(type: string, error: Error): void;
}

/** Marker for responses that should reject rather than resolve. */
class Rejection {
  constructor(readonly error: Error) {}
}

/**
 * Build a fake `hass`.
 *
 * Commands without a registered response reject with a message naming the type,
 * so a forgotten stub fails loudly instead of resolving to `undefined` and
 * surfacing much later as an unrelated render error.
 */
export function createHass(options: FakeHassOptions = {}): FakeHass {
  const responses = new Map<string, WsResponse>(Object.entries(options.ws ?? {}));
  const sent: WsMessage[] = [];
  const language = options.language ?? "en";

  const hass: FakeHass = {
    config: { language },
    language,
    locale: { language },
    themes: { darkMode: options.darkMode ?? false },
    states: options.states ?? {},
    user: { id: "user-1", name: "Test User", is_owner: true, is_admin: true, ...options.user },
    sent,

    async callWS<T>(message: Record<string, unknown>): Promise<T> {
      const typed = message as WsMessage;
      sent.push(typed);

      if (!responses.has(typed.type)) {
        throw new Error(
          `createHass: no response registered for "${typed.type}". ` +
            `Registered: ${[...responses.keys()].join(", ") || "(none)"}`,
        );
      }

      const response = responses.get(typed.type);
      const resolved = typeof response === "function" ? response(typed) : response;
      if (resolved instanceof Rejection) {
        throw resolved.error;
      }
      return resolved as T;
    },

    sentOf(type: string): WsMessage[] {
      return sent.filter((message) => message.type === type);
    },

    lastSent(type: string): WsMessage {
      const matches = sent.filter((message) => message.type === type);
      if (matches.length === 0) {
        throw new Error(`createHass: "${type}" was never sent.`);
      }
      return matches[matches.length - 1];
    },

    respond(type: string, response: WsResponse): void {
      responses.set(type, response);
    },

    failWith(type: string, error: Error): void {
      responses.set(type, new Rejection(error));
    },
  };

  return hass;
}

/** A `HassEntity`, for the cards that read `hass.states`. */
export function hassEntity(
  entityId: string,
  state = "on",
  attributes: Record<string, unknown> = {},
): HassEntity {
  return {
    entity_id: entityId,
    state,
    attributes,
    last_changed: "2026-01-01T00:00:00.000Z",
    last_updated: "2026-01-01T00:00:00.000Z",
  };
}

/** Index entities by their id, ready for `createHass({ states })`. */
export function statesOf(...entities: HassEntity[]): Record<string, HassEntity> {
  return Object.fromEntries(entities.map((entity) => [entity.entity_id, entity]));
}
