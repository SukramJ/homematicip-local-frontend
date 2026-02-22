import { css } from "lit";

export const deviceEditorStyles = css`
  :host {
    display: block;
  }

  /* Editor Overlay */
  .editor-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .editor-dialog {
    background-color: var(--card-background-color);
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--divider-color);
  }

  .editor-header h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .close-button {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--secondary-text-color);
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition:
      background-color 0.2s,
      color 0.2s;
  }

  .close-button:hover {
    background-color: var(--divider-color);
    color: var(--primary-text-color);
  }

  .editor-content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group label {
    font-weight: 500;
    font-size: 14px;
    color: var(--primary-text-color);
  }

  .form-group input[type="time"],
  .form-group input[type="text"],
  .form-group input[type="number"],
  .form-group select {
    padding: 8px;
    border: 1px solid var(--divider-color);
    border-radius: 4px;
    background-color: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 14px;
  }

  .form-group input[type="range"] {
    width: 100%;
  }

  .duration-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .duration-row input[type="number"] {
    flex: 1;
    padding: 8px;
    border: 1px solid var(--divider-color);
    border-radius: 4px;
    background-color: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 14px;
  }

  .duration-row select {
    padding: 8px;
    border: 1px solid var(--divider-color);
    border-radius: 4px;
    background-color: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 14px;
  }

  .weekday-checkboxes,
  .channel-checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 14px;
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
  }

  .editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px;
    border-top: 1px solid var(--divider-color);
  }

  .button-primary,
  .button-secondary {
    padding: 10px 24px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: opacity 0.2s;
  }

  .button-primary {
    background-color: var(--primary-color);
    color: var(--text-primary-color);
  }

  .button-primary:hover {
    opacity: 0.9;
  }

  .button-secondary {
    background-color: var(--divider-color);
    color: var(--primary-text-color);
    border: none;
  }

  .button-secondary:hover {
    opacity: 0.9;
  }

  .validation-errors {
    background-color: rgba(231, 76, 60, 0.1);
    border: 1px solid rgba(231, 76, 60, 0.3);
    border-radius: 4px;
    padding: 12px;
    margin: 0;
  }

  .validation-errors ul {
    margin: 0;
    padding-left: 20px;
    list-style-type: disc;
  }

  .validation-errors li {
    color: var(--error-color, #e74c3c);
    font-size: 13px;
    line-height: 1.6;
    margin: 4px 0;
  }

  /* Mobile Optimization */
  @media (max-width: 768px) {
    .button-primary,
    .button-secondary {
      min-height: 44px;
      padding: 10px 16px;
    }
  }
`;
