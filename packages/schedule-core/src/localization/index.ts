/**
 * Localization module for schedule components.
 */

import type { ScheduleTranslations, SupportedLanguage } from "./types";
import type { ScheduleDomain } from "../models/device-types";
import { en } from "./en";
import { de } from "./de";

export type { ScheduleTranslations, SupportedLanguage };

const translations: Record<string, ScheduleTranslations> = {
  en,
  de,
};

/**
 * Return translations for a language with fallback to English.
 */
export function getTranslations(language: string): ScheduleTranslations {
  const lang = language.toLowerCase().split("-")[0];
  return translations[lang] || translations.en;
}

/**
 * Replace template placeholders with parameter values.
 */
export function formatString(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

/**
 * Return localized domain label.
 */
export function getDomainLabel(domain: ScheduleDomain | undefined, language: string): string {
  if (!domain) return "";
  const t = getTranslations(language);
  return t.domains[domain] || domain;
}
