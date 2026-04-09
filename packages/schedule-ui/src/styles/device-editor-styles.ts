import { css } from "lit";

export const deviceEditorStyles = css`
  :host {
    display: block;
  }

  /* Dialog styles */
  ha-dialog {
    --ha-dialog-max-width: min(500px, 95vw);
    --ha-dialog-max-height: 90vh;
  }

  .editor-content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    max-height: calc(90vh - 200px);
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
  .form-group input[type="number"] {
    padding: 8px;
    border: 1px solid var(--divider-color);
    border-radius: 4px;
    background-color: var(--card-background-color);
    color: var(--primary-text-color);
    font-size: 14px;
  }

  ha-select {
    width: 100%;
  }

  ha-slider {
    width: 100%;
  }

  .slider-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .slider-group ha-slider {
    flex: 1;
  }

  .slider-value {
    min-width: 40px;
    text-align: right;
    font-size: 14px;
    color: var(--primary-text-color);
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

  .duration-row ha-select {
    min-width: 80px;
    flex: 0 0 auto;
  }

  .weekday-checkboxes,
  .channel-checkboxes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .validation-list {
    margin: 0;
    padding-left: 20px;
    list-style-type: disc;
  }

  .validation-list li {
    font-size: 13px;
    line-height: 1.6;
    margin: 4px 0;
  }

  .editor-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--divider-color);
  }

  /* Mobile Optimization */
  @media (max-width: 768px) {
    ha-dialog {
      --ha-dialog-max-width: 100vw;
      --ha-dialog-max-height: 100vh;
    }

    .editor-content {
      max-height: calc(100vh - 150px);
    }

    .editor-footer {
      flex-direction: column-reverse;
      gap: 8px;
      position: sticky;
      bottom: 0;
      background-color: var(--card-background-color, #fff);
      margin: 0 -16px -16px;
      padding: 16px;
      z-index: 1;
    }

    .editor-footer ha-button {
      width: 100%;
    }

    .form-group input[type="time"],
    .form-group input[type="text"],
    .form-group input[type="number"] {
      font-size: 16px;
      min-height: 44px;
    }
  }
`;
