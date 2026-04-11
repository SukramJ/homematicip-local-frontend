/**
 * Combined entry point for ALL HomematicIP Lovelace cards.
 *
 * Loading all cards from a single module (instead of 3 separate imports)
 * reduces race conditions during async module loading.
 *
 * Includes a recovery mechanism for Firefox where the `customElements`
 * registry object gets replaced between ES module evaluation and later
 * execution contexts. Elements registered during module eval become
 * invisible to HA's rendering pipeline. The fix: save class references
 * at module time, then re-register them if they go missing.
 */

// ---- Schedule card (from source for single-bundle compilation) ----
import "../../schedule-card/src/card";

// ---- Climate schedule card (from source for single-bundle compilation) ----
import "../../climate-schedule-card/src/card";

// ---- Status cards ----
import "./cards/system-health-card";
import "./cards/system-health-editor";
import "./cards/device-status-card";
import "./cards/device-status-editor";
import "./cards/messages-card";
import "./cards/messages-editor";

// ---- Card picker registration ----
declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
    }>;
  }
}

window.customCards = window.customCards || [];

const registerCard = (type: string, name: string, description: string) => {
  if (!window.customCards!.some((c) => c.type === type)) {
    window.customCards!.push({ type, name, description });
  }
};

registerCard(
  "homematicip-local-climate-schedule-card",
  "Homematic(IP) Local Climate Schedule Card",
  "Display and edit Homematic thermostat schedules",
);

registerCard(
  "homematicip-local-schedule-card",
  "HomematicIP Local Scheduler Card",
  "A custom card for Homematic(IP) Local schedules (switch, valve, cover, light)",
);

registerCard(
  "homematicip-system-health-card",
  "HomematicIP System Health",
  "System health, device statistics, and incidents for HomematicIP Local",
);

registerCard(
  "homematicip-device-status-card",
  "HomematicIP Device Status",
  "Device status overview with problem highlighting for HomematicIP Local",
);

registerCard(
  "homematicip-messages-card",
  "HomematicIP Messages",
  "Service messages and alarms with acknowledgment for HomematicIP Local",
);

// ---- Firefox recovery: save element classes and re-register if needed ----

const OUR_CARD_TYPES = new Set([
  "homematicip-local-climate-schedule-card",
  "homematicip-local-schedule-card",
  "homematicip-system-health-card",
  "homematicip-device-status-card",
  "homematicip-messages-card",
]);

// Save element class constructors at module evaluation time.
// In Firefox, the customElements registry object can get replaced after
// ES module evaluation, making all registered elements invisible.
const SAVED_CLASSES = new Map<string, CustomElementConstructor>();
for (const tag of OUR_CARD_TYPES) {
  const ctor = customElements.get(tag);
  if (ctor) {
    SAVED_CLASSES.set(tag, ctor);
  }
}

/**
 * Re-register saved element classes if they are missing from the
 * current customElements registry (Firefox registry replacement fix).
 *
 * The original constructor has an internal [[CustomElementDefinition]] slot
 * from the old registry, so we first try a direct define, then fall back
 * to a transparent subclass if the constructor is rejected.
 */
function ensureElementsDefined(): number {
  let reregistered = 0;
  for (const [tag, ctor] of SAVED_CLASSES) {
    if (!customElements.get(tag)) {
      try {
        customElements.define(tag, ctor);
        reregistered++;
        console.info(`[HMIP] Re-registered: ${tag}`);
      } catch {
        // Constructor already marked — create transparent subclass
        try {
          customElements.define(tag, class extends ctor {});
          reregistered++;
          console.info(`[HMIP] Re-registered (subclass): ${tag}`);
        } catch {
          console.warn(`[HMIP] Failed to re-register: ${tag}`);
        }
      }
    }
  }
  return reregistered;
}

/**
 * Walk the DOM tree including shadow roots to find elements.
 */
function walkDom(root: Document | ShadowRoot, callback: (el: Element) => void): void {
  for (const el of Array.from(root.querySelectorAll("*"))) {
    callback(el);
    if (el.shadowRoot) {
      walkDom(el.shadowRoot, callback);
    }
  }
}

/**
 * Find hui-card elements that show error cards for our card types
 * and force them to recreate the card element.
 */
function recoverErrorCards(): number {
  let recovered = 0;

  walkDom(document, (el) => {
    if (el.tagName.toLowerCase() !== "hui-card") return;

    const hasErrorChild = el.querySelector("hui-error-card") !== null;
    const internalElement = (el as unknown as Record<string, unknown>)._element as
      | Element
      | undefined;
    const hasErrorInternal = internalElement?.tagName?.toLowerCase() === "hui-error-card";

    if (!hasErrorChild && !hasErrorInternal) return;

    const config = (el as unknown as Record<string, unknown>).config as
      | { type?: string }
      | undefined;
    if (!config?.type) return;

    const cardType = config.type.startsWith("custom:") ? config.type.slice(7) : config.type;

    if (!OUR_CARD_TYPES.has(cardType)) return;
    if (!customElements.get(cardType)) return;

    const loadElement = (el as unknown as Record<string, unknown>)._loadElement;
    if (typeof loadElement === "function") {
      console.info(`[HMIP] Recovering error card: ${cardType}`);
      loadElement.call(el, config);
      recovered++;
    }
  });

  return recovered;
}

// Run recovery with increasing delays to catch various timing scenarios.
for (const delay of [100, 500, 1500, 3000, 5000]) {
  setTimeout(() => {
    const reregistered = ensureElementsDefined();
    const recovered = recoverErrorCards();
    if (reregistered > 0 || recovered > 0) {
      console.info(
        `[HMIP] Recovery @${delay}ms: ${reregistered} re-registered, ${recovered} error cards recovered`,
      );
    }
  }, delay);
}
