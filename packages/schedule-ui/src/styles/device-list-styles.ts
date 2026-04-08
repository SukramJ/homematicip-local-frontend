import { css } from "lit";

export const deviceListStyles = css`
  :host {
    display: block;
  }

  .schedule-list {
    display: flex;
    flex-direction: column;
  }

  .toolbar {
    margin-bottom: 16px;
    display: flex;
    justify-content: flex-end;
  }

  ha-button {
    --ha-button-color: var(--primary-color);
  }

  .no-data {
    text-align: center;
    padding: 32px;
    color: var(--secondary-text-color);
  }

  .events-table {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .event-card {
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    overflow: hidden;
    transition: background-color 0.2s;
  }

  .event-card.inactive {
    opacity: 0.5;
  }

  .event-card:hover {
    background-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.05);
  }

  .event-row-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px 4px;
    gap: 8px;
  }

  .col-condition {
    font-weight: 500;
    font-size: 14px;
    color: var(--primary-text-color);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-actions {
    display: flex;
    gap: 0;
    flex-shrink: 0;
  }

  ha-icon-button {
    --ha-icon-button-size: 36px;
    color: var(--secondary-text-color);
  }

  .event-row-details {
    padding: 0 16px 4px;
  }

  .col-details-text {
    font-size: 13px;
    color: var(--secondary-text-color);
  }

  .event-row-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px 10px;
    gap: 12px;
  }

  .col-weekdays {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .weekday-badges {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
  }

  .weekday-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
  }

  .weekday-badge.active {
    background-color: var(--primary-color);
    color: var(--text-primary-color);
  }

  .weekday-badge.inactive {
    background-color: var(--divider-color);
    color: var(--disabled-text-color, var(--secondary-text-color));
    opacity: 0.5;
  }

  .col-details {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    font-size: 13px;
  }

  .col-state {
    color: var(--primary-text-color);
  }

  .col-state .level-2 {
    color: var(--secondary-text-color);
    font-size: 0.9em;
  }

  .col-duration {
    color: var(--secondary-text-color);
  }

  /* Mobile Optimization */
  @media (max-width: 768px) {
    .event-row-top {
      padding: 8px 12px 4px;
    }

    .event-row-details {
      padding: 0 12px 4px;
    }

    .event-row-bottom {
      padding: 0 12px 8px;
      flex-wrap: wrap;
    }

    ha-icon-button {
      --ha-icon-button-size: 44px;
    }

    .weekday-badge {
      min-width: 22px;
      padding: 2px 3px;
      font-size: 10px;
    }
  }

  @media (max-width: 480px) {
    .col-condition {
      font-size: 13px;
    }

    .weekday-badge {
      min-width: 20px;
      padding: 1px 2px;
      font-size: 9px;
    }
  }

  /* Touch device optimizations */
  @media (hover: none) and (pointer: coarse) {
    .event-card:hover {
      background-color: transparent;
    }

    .event-card:active {
      background-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.1);
    }
  }
`;
