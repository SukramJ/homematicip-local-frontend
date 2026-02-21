/**
 * Device address helper utilities.
 */

/**
 * Extract device address from the entity address attribute.
 * Address format: "device_address:channel_no" (e.g., "000C9709AEF157:1").
 * Return the device_address part, or undefined if the format is invalid.
 */
export function getDeviceAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const parts = address.split(":");
  if (parts.length !== 2) return undefined;
  return parts[0];
}
