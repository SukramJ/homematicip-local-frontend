/**
 * Helpers for interacting with Home Assistant's native UI features
 * (confirmation dialogs, toast notifications) via DOM events.
 */

/**
 * Show a confirmation dialog.
 * Uses HA's native dialog-box if available, otherwise falls back
 * to a styled HTML <dialog> element.
 * Returns a promise that resolves to true if confirmed, false otherwise.
 */
export function showConfirmationDialog(
  _element: HTMLElement,
  params: {
    title?: string;
    text?: string;
    confirmText?: string;
    dismissText?: string;
    destructive?: boolean;
  },
): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.style.cssText = [
      "border: none",
      "border-radius: var(--ha-card-border-radius, 12px)",
      "padding: 24px",
      "max-width: 450px",
      "width: calc(100% - 48px)",
      "box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3)",
      "font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif)",
      "background: var(--card-background-color, var(--ha-card-background, #fff))",
      "color: var(--primary-text-color, #212121)",
    ].join("; ");

    const titleEl = params.title
      ? `<h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 500;">${escapeHtml(params.title)}</h2>`
      : "";

    const textEl = params.text
      ? `<p style="margin: 0 0 24px; white-space: pre-line; line-height: 1.5; color: var(--secondary-text-color, #727272);">${escapeHtml(params.text)}</p>`
      : "";

    const confirmColor = params.destructive
      ? "var(--error-color, #db4437)"
      : "var(--primary-color, #03a9f4)";

    dialog.innerHTML = `
      ${titleEl}
      ${textEl}
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button class="dismiss" style="
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: var(--primary-text-color, #212121);
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
        ">${escapeHtml(params.dismissText || "Cancel")}</button>
        <button class="confirm" style="
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          background: ${confirmColor};
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
        ">${escapeHtml(params.confirmText || "OK")}</button>
      </div>
    `;

    const close = (result: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    dialog.querySelector(".confirm")!.addEventListener("click", () => close(true));
    dialog.querySelector(".dismiss")!.addEventListener("click", () => close(false));
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close(false);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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
