import type { HomeAssistant } from "./types";

import en from "../translations/en.json";
import de from "../translations/de.json";

type TranslationDict = Record<string, string | Record<string, string | Record<string, string>>>;

const translations: Record<string, TranslationDict> = { en, de };

/**
 * Flatten nested translation keys into dotted paths.
 * { "a": { "b": "c" } } => { "a.b": "c" }
 */
function flatten(obj: TranslationDict, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      result[path] = value;
    } else if (typeof value === "object" && value !== null) {
      Object.assign(result, flatten(value as TranslationDict, path));
    }
  }
  return result;
}

const flatCache = new Map<string, Record<string, string>>();

function getFlatTranslations(lang: string): Record<string, string> {
  if (flatCache.has(lang)) {
    return flatCache.get(lang)!;
  }
  const dict = translations[lang] ?? translations["en"];
  const flat = flatten(dict);
  flatCache.set(lang, flat);
  return flat;
}

/**
 * Localize a key with optional placeholder substitution.
 * Placeholders use `{name}` syntax.
 */
export function localize(
  hass: HomeAssistant,
  key: string,
  params?: Record<string, string | number>,
): string {
  const lang = hass.config.language ?? "en";
  const flat = getFlatTranslations(lang);
  let text = flat[key] ?? flat[key.replace(/^panel\./, "")] ?? key;

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }

  return text;
}
