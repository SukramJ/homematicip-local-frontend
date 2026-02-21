/**
 * Temperature color utilities for climate schedule visualization.
 */

/**
 * Return color for a temperature value.
 * Color scale aligned with Home Assistant climate state colors.
 */
export function getTemperatureColor(temperature: number): string {
  if (temperature < 10) return "#2b9af9";
  if (temperature < 14) return "#40c4ff";
  if (temperature < 17) return "#26c6da";
  if (temperature < 19) return "#66bb6a";
  if (temperature < 21) return "#9ccc65";
  if (temperature < 23) return "#ffb74d";
  if (temperature < 25) return "#ff8100";
  return "#f4511e";
}

/**
 * Return gradient background for a temperature block based on adjacent blocks.
 */
export function getTemperatureGradient(
  currentTemp: number,
  prevTemp: number | null,
  nextTemp: number | null,
): string {
  const currentColor = getTemperatureColor(currentTemp);

  if (prevTemp === null && nextTemp === null) {
    return currentColor;
  }

  if (prevTemp !== null && nextTemp === null) {
    const prevColor = getTemperatureColor(prevTemp);
    return `linear-gradient(to bottom, ${prevColor}, ${currentColor})`;
  }

  if (prevTemp === null && nextTemp !== null) {
    const nextColor = getTemperatureColor(nextTemp);
    return `linear-gradient(to bottom, ${currentColor}, ${nextColor})`;
  }

  const prevColor = getTemperatureColor(prevTemp!);
  const nextColor = getTemperatureColor(nextTemp!);
  return `linear-gradient(to bottom, ${prevColor}, ${currentColor} 50%, ${nextColor})`;
}

/**
 * Format temperature for display.
 */
export function formatTemperature(temperature: number, unit: string = "°C"): string {
  return `${temperature.toFixed(1)}${unit}`;
}
