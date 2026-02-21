/**
 * Helpers for interacting with Home Assistant's native UI features
 * (confirmation dialogs, toast notifications) via DOM events.
 */

/**
 * Show a native HA confirmation dialog.
 * Returns a promise that resolves to true if confirmed, false otherwise.
 */
export function showConfirmationDialog(
  element: HTMLElement,
  params: {
    title?: string;
    text?: string;
    confirmText?: string;
    dismissText?: string;
    destructive?: boolean;
  },
): Promise<boolean> {
  return new Promise((resolve) => {
    const event = new CustomEvent("hass-dialog", {
      bubbles: true,
      composed: true,
      detail: {
        dialogTag: "ha-confirmation-dialog",
        dialogImport: () => Promise.resolve(),
        dialogParams: {
          ...params,
          confirm: () => resolve(true),
          cancel: () => resolve(false),
        },
      },
    });
    element.dispatchEvent(event);
  });
}

/**
 * Show a native HA toast notification.
 */
export function showToast(
  element: HTMLElement,
  params: {
    message: string;
    duration?: number;
  },
): void {
  const event = new CustomEvent("hass-notification", {
    bubbles: true,
    composed: true,
    detail: params,
  });
  element.dispatchEvent(event);
}
