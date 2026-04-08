import { css } from "lit";

export const cardStyles = css`
  :host {
    display: block;
    font-family: var(--paper-font-body1_-_font-family, "Roboto", sans-serif);
    color: var(--primary-text-color);
  }

  ha-card {
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 16px 0;
    font-size: 16px;
    font-weight: 500;
  }

  .card-content {
    padding: 12px 16px 16px;
  }

  .badges {
    display: flex;
    gap: 6px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .badge.ok {
    background: var(--success-color, #4caf50);
    color: #fff;
  }

  .badge.warning {
    background: var(--warning-color, #ff9800);
    color: #fff;
  }

  .badge.error {
    background: var(--error-color, #db4437);
    color: #fff;
  }

  .badge.info {
    background: var(--info-color, var(--primary-color, #03a9f4));
    color: #fff;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
    padding: 8px 0;
  }

  .stat-item {
    text-align: center;
    padding: 8px;
    border-radius: 8px;
    background: var(--card-background-color, var(--ha-card-background, #fff));
    border: 1px solid var(--divider-color, #e0e0e0);
  }

  .stat-value {
    font-size: 24px;
    font-weight: 600;
    line-height: 1.2;
  }

  .stat-label {
    font-size: 11px;
    color: var(--secondary-text-color);
    margin-top: 2px;
  }

  .stat-item.warning {
    border-color: var(--warning-color, #ff9800);
    background: color-mix(in srgb, var(--warning-color, #ff9800) 8%, transparent);
  }

  .stat-item.error {
    border-color: var(--error-color, #db4437);
    background: color-mix(in srgb, var(--error-color, #db4437) 8%, transparent);
  }

  .item-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 8px;
    background: var(--card-background-color, var(--ha-card-background, #fff));
    border: 1px solid var(--divider-color, #e0e0e0);
  }

  .item-row.warning {
    border-color: var(--warning-color, #ff9800);
    background: color-mix(in srgb, var(--warning-color, #ff9800) 6%, transparent);
  }

  .item-row.error {
    border-color: var(--error-color, #db4437);
    background: color-mix(in srgb, var(--error-color, #db4437) 6%, transparent);
  }

  .item-row.ok .item-icon {
    color: var(--success-color, #4caf50);
  }

  .item-secondary .warning {
    color: var(--warning-color, #ff9800);
    font-weight: 500;
  }

  .item-secondary .error {
    color: var(--error-color, #db4437);
    font-weight: 500;
  }

  .item-icon {
    flex: 0 0 auto;
    color: var(--secondary-text-color);
  }

  .item-content {
    flex: 1;
    min-width: 0;
  }

  .item-primary {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-secondary {
    font-size: 12px;
    color: var(--secondary-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-action {
    flex: 0 0 auto;
  }

  .status-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .status-dot.online {
    background: var(--success-color, #4caf50);
  }

  .status-dot.offline {
    background: var(--error-color, #db4437);
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--secondary-text-color);
    padding: 8px 0 4px;
  }

  .empty-state {
    text-align: center;
    padding: 24px;
    color: var(--secondary-text-color);
    font-size: 14px;
  }

  .loading {
    display: flex;
    justify-content: center;
    padding: 24px;
  }

  .error-msg {
    color: var(--error-color, #db4437);
    padding: 16px;
    font-size: 14px;
  }

  .summary-line {
    font-size: 13px;
    color: var(--secondary-text-color);
    padding-top: 8px;
    text-align: center;
  }

  /* ---- Responsive: mobile (< 600px) ---- */
  @media (max-width: 600px) {
    .stat-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
`;
