import { css } from "lit";

export const editorStyles = css`
  :host {
    display: block;
  }

  /* Dialog styles */
  ha-dialog {
    --mdc-dialog-max-width: 90vw;
    --mdc-dialog-max-height: 90vh;
  }

  .dialog-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    overflow-y: auto;
    max-height: calc(90vh - 200px);
  }

  .weekday-tabs {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .weekday-tab {
    padding: 8px 12px;
    border: 1px solid var(--divider-color);
    border-radius: 4px;
    background-color: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 14px;
    cursor: pointer;
    transition:
      background-color 0.2s,
      border-color 0.2s;
    min-width: 40px;
    text-align: center;
  }

  .weekday-tab:hover {
    background-color: var(--divider-color);
  }

  .weekday-tab.active {
    background-color: var(--primary-color);
    color: var(--text-primary-color, #fff);
    border-color: var(--primary-color);
  }

  .dialog-editor {
    flex: 1;
    min-height: 0;
  }

  .dialog-editor .editor {
    box-shadow: none;
    border: none;
    padding: 0;
  }

  .dialog-editor .editor-header {
    display: none;
  }

  .dialog-editor .editor-footer {
    display: none;
  }

  /* Editor Styles */
  .editor {
    background-color: var(--card-background-color);
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--divider-color);
  }

  .editor-header h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 500;
  }

  .editor-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .undo-btn,
  .redo-btn,
  .close-btn {
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
      opacity 0.2s;
  }

  .undo-btn:hover:not(:disabled),
  .redo-btn:hover:not(:disabled),
  .close-btn:hover {
    background-color: var(--divider-color);
  }

  .undo-btn:disabled,
  .redo-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .validation-warnings {
    background-color: rgba(255, 152, 0, 0.1);
    border: 1px solid rgba(255, 152, 0, 0.3);
    border-radius: 4px;
    padding: 12px;
    margin: 12px 0;
  }

  .warnings-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .warning-icon {
    font-size: 18px;
  }

  .warnings-title {
    font-size: 14px;
  }

  .warnings-list {
    margin: 0;
    padding-left: 28px;
    list-style-type: disc;
  }

  .warning-item {
    color: var(--secondary-text-color);
    font-size: 13px;
    line-height: 1.6;
    margin: 4px 0;
  }

  /* Base Temperature Section */
  .base-temperature-section {
    background-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.1);
    border: 1px solid var(--divider-color);
    border-radius: 4px;
    padding: 12px;
    margin: 12px 0;
  }

  .base-temperature-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }

  .base-temp-label {
    font-weight: 500;
    font-size: 14px;
    color: var(--primary-text-color);
  }

  .base-temp-description {
    font-size: 12px;
    color: var(--secondary-text-color);
  }

  .base-temperature-input {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .base-temp-input {
    width: 80px;
    font-weight: 500;
  }

  .editor-content-label {
    font-weight: 500;
    font-size: 14px;
    color: var(--primary-text-color);
    margin: 16px 0 8px 0;
    padding-left: 8px;
  }

  .editor-content {
    max-height: 500px;
    overflow-y: auto;
  }

  .time-block-header {
    display: grid;
    grid-template-columns: 100px 100px 90px 1fr 24px;
    gap: 8px;
    align-items: center;
    padding: 8px;
    border-bottom: 2px solid var(--divider-color);
    font-weight: 500;
    font-size: 12px;
    color: var(--secondary-text-color);
    text-transform: uppercase;
  }

  .header-cell {
    text-align: left;
  }

  .time-block-editor {
    display: grid;
    grid-template-columns: 100px 100px 90px 1fr 24px;
    gap: 8px;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid var(--divider-color);
  }

  .time-block-editor.editing {
    background-color: var(--primary-color-light, rgba(3, 169, 244, 0.1));
    border: 1px solid var(--primary-color);
    border-radius: 4px;
    margin: 4px 0;
  }

  .time-block-editor.base-temp-slot {
    opacity: 0.6;
    background-color: var(--divider-color);
  }

  .time-display {
    font-size: 14px;
    color: var(--primary-text-color);
    font-family: monospace;
  }

  .temp-display-group,
  .temp-input-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .temp-display {
    font-size: 14px;
    color: var(--primary-text-color);
    font-weight: 500;
  }

  .slot-actions {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }

  .slot-edit-btn,
  .slot-save-btn,
  .slot-cancel-btn {
    padding: 4px 8px;
    border: 1px solid var(--divider-color);
    border-radius: 4px;
    background-color: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
  }

  .slot-edit-btn:hover,
  .slot-save-btn:hover,
  .slot-cancel-btn:hover {
    background-color: var(--divider-color);
  }

  .slot-save-btn {
    background-color: var(--primary-color);
    color: var(--text-primary-color);
    border-color: var(--primary-color);
  }

  .slot-cancel-btn {
    background-color: var(--error-color, #e74c3c);
    color: white;
    border-color: var(--error-color, #e74c3c);
  }

  .slot-edit-btn:disabled,
  .remove-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .block-number {
    font-weight: 500;
    color: var(--secondary-text-color);
  }

  .time-input,
  .temp-input {
    padding: 6px 8px;
    border: 1px solid var(--divider-color);
    border-radius: 4px;
    background-color: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 14px;
    width: 100%;
    box-sizing: border-box;
  }

  .time-input {
    min-width: 100px;
    max-width: 120px;
  }

  .temp-input {
    max-width: 60px;
  }

  .temp-unit {
    color: var(--secondary-text-color);
    font-size: 14px;
  }

  .remove-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 18px;
    padding: 4px;
  }

  .remove-btn:hover {
    opacity: 0.7;
  }

  .color-indicator {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid var(--divider-color);
    flex-shrink: 0;
  }

  .add-btn {
    margin: 12px 0;
    padding: 10px 16px;
    background-color: var(--primary-color);
    color: var(--text-primary-color);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    width: 100%;
  }

  .add-btn:hover {
    opacity: 0.9;
  }

  .editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--divider-color);
  }

  .cancel-btn,
  .save-btn {
    padding: 10px 24px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  }

  .cancel-btn {
    background-color: var(--divider-color);
    color: var(--primary-text-color);
  }

  .save-btn {
    background-color: var(--primary-color);
    color: var(--text-primary-color);
  }

  .cancel-btn:hover,
  .save-btn:hover {
    opacity: 0.9;
  }

  /* Mobile Optimization */
  @media (max-width: 768px) {
    ha-dialog {
      --mdc-dialog-max-width: 100vw;
      --mdc-dialog-max-height: 100vh;
    }

    .dialog-content {
      max-height: calc(100vh - 150px);
    }

    .editor-header h3 {
      font-size: 18px;
    }

    .undo-btn,
    .redo-btn,
    .close-btn {
      width: 44px;
      height: 44px;
      font-size: 28px;
    }

    .editor-content {
      max-height: 400px;
    }

    .time-block-editor {
      grid-template-columns: 30px 1fr 70px 40px 44px 20px;
      gap: 6px;
      padding: 10px 6px;
    }

    .block-number {
      font-size: 13px;
    }

    .time-input,
    .temp-input {
      padding: 10px 8px;
      font-size: 16px;
      min-height: 44px;
    }

    .temp-unit {
      font-size: 13px;
    }

    .remove-btn {
      font-size: 22px;
      padding: 8px;
      min-width: 44px;
      min-height: 44px;
    }

    .add-btn {
      padding: 14px 16px;
      font-size: 16px;
      min-height: 48px;
    }

    .editor-footer {
      flex-direction: column-reverse;
      gap: 8px;
    }

    .cancel-btn,
    .save-btn {
      width: 100%;
      padding: 14px 24px;
      font-size: 16px;
      min-height: 48px;
    }

    .validation-warnings {
      padding: 10px;
      margin: 10px 0;
    }

    .warnings-title {
      font-size: 13px;
    }

    .warning-item {
      font-size: 12px;
    }
  }

  /* Small mobile devices (portrait phones) */
  @media (max-width: 480px) {
    .time-block-editor {
      grid-template-columns: 25px 1fr 60px 35px 44px 16px;
      gap: 4px;
      padding: 8px 4px;
    }

    .block-number {
      font-size: 12px;
    }

    .editor-header h3 {
      font-size: 16px;
    }
  }

  /* Landscape mobile optimization */
  @media (max-width: 768px) and (orientation: landscape) {
    .editor-content {
      max-height: 200px;
    }
  }

  /* Touch-specific optimizations */
  @media (hover: none) and (pointer: coarse) {
    .undo-btn:hover:not(:disabled),
    .redo-btn:hover:not(:disabled),
    .close-btn:hover,
    .add-btn:hover,
    .cancel-btn:hover,
    .save-btn:hover,
    .remove-btn:hover {
      opacity: 1;
      background-color: transparent;
    }

    .undo-btn:active:not(:disabled),
    .redo-btn:active:not(:disabled),
    .close-btn:active {
      background-color: var(--divider-color);
    }

    .add-btn:active,
    .save-btn:active {
      opacity: 0.85;
    }

    .cancel-btn:active {
      opacity: 0.85;
    }

    .remove-btn:active {
      opacity: 0.5;
    }
  }
`;
