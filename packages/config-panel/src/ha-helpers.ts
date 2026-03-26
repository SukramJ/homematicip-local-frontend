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

/**
 * Show a prompt dialog with a text input field.
 * Returns the entered value if confirmed, or null if dismissed.
 */
export function showPromptDialog(
  _element: HTMLElement,
  params: {
    title?: string;
    text?: string;
    inputLabel?: string;
    defaultValue?: string;
    confirmText?: string;
    dismissText?: string;
  },
): Promise<string | null> {
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
      ? `<p style="margin: 0 0 16px; white-space: pre-line; line-height: 1.5; color: var(--secondary-text-color, #727272);">${escapeHtml(params.text)}</p>`
      : "";

    const inputLabelEl = params.inputLabel
      ? `<label style="display: block; margin-bottom: 4px; font-size: 12px; color: var(--secondary-text-color, #727272);">${escapeHtml(params.inputLabel)}</label>`
      : "";

    dialog.innerHTML = `
      ${titleEl}
      ${textEl}
      ${inputLabelEl}
      <input type="text" class="prompt-input" value="${escapeHtml(params.defaultValue || "")}" style="
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--divider-color, #e0e0e0);
        border-radius: 4px;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color, #212121);
        font-size: 14px;
        font-family: inherit;
        box-sizing: border-box;
        margin-bottom: 24px;
      " />
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
          background: var(--primary-color, #03a9f4);
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
        ">${escapeHtml(params.confirmText || "OK")}</button>
      </div>
    `;

    const close = (result: string | null) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    const input = dialog.querySelector(".prompt-input") as HTMLInputElement;
    dialog.querySelector(".confirm")!.addEventListener("click", () => close(input.value));
    dialog.querySelector(".dismiss")!.addEventListener("click", () => close(null));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") close(input.value);
    });
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close(null);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    input.focus();
    input.select();
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
