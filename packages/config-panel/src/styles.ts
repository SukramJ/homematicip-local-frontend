import { css } from "lit";

export const sharedStyles = css`
  :host {
    display: block;
    font-family: var(--paper-font-body1_-_font-family, "Roboto", sans-serif);
    color: var(--primary-text-color);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    font-size: 18px;
    font-weight: 500;
  }

  .card-content {
    padding: 0 16px 16px;
  }

  .device-info {
    color: var(--secondary-text-color);
    font-size: 14px;
    margin-top: 4px;
  }

  .back-button {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--primary-color);
    font-size: 14px;
    padding: 8px 0;
    background: none;
    border: none;
    font-family: inherit;
  }

  .back-button:hover {
    text-decoration: underline;
  }

  .loading {
    display: flex;
    justify-content: center;
    padding: 32px;
  }

  .empty-state {
    text-align: center;
    padding: 32px;
    color: var(--secondary-text-color);
  }

  .error {
    color: var(--error-color, #db4437);
    padding: 16px;
  }

  .action-bar {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px;
    border-top: 1px solid var(--divider-color);
  }

  .modified-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--primary-color);
    margin-left: 8px;
  }

  .section-header {
    font-size: 16px;
    font-weight: 500;
    padding: 16px 0 8px;
    border-bottom: 1px solid var(--divider-color);
    margin-bottom: 8px;
  }

  .parameter-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    min-height: 48px;
  }

  .parameter-label {
    font-size: 14px;
    flex: 1;
    min-width: 0;
  }

  .parameter-unit {
    color: var(--secondary-text-color);
    font-size: 12px;
    margin-left: 4px;
  }

  .parameter-control {
    flex: 0 0 auto;
    max-width: 200px;
  }

  .validation-error {
    color: var(--error-color, #db4437);
    font-size: 12px;
    margin-top: 4px;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
    padding: 8px 0;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .status-icon {
    width: 20px;
    text-align: center;
  }

  /* ---- Responsive: mobile (< 600px) ---- */
  @media (max-width: 600px) {
    .parameter-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }

    .parameter-control {
      max-width: 100%;
      width: 100%;
    }

    .action-bar {
      flex-direction: column;
      gap: 8px;
    }

    .action-bar button {
      width: 100%;
    }

    .status-grid {
      grid-template-columns: 1fr;
    }
  }
`;
