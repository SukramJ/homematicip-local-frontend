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
    --mdc-theme-primary: var(--primary-color);
  }

  .no-data {
    text-align: center;
    padding: 32px;
    color: var(--secondary-text-color);
  }

  .events-table {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .events-header {
    display: grid;
    grid-template-columns: 70px 1fr minmax(60px, auto) minmax(60px, auto) 70px;
    gap: 8px;
    padding: 8px 16px;
    background-color: var(--secondary-background-color);
    font-weight: 500;
    font-size: 13px;
    color: var(--secondary-text-color);
    text-transform: uppercase;
  }

  .events-header.no-actions {
    grid-template-columns: 70px 1fr minmax(60px, auto) minmax(60px, auto);
  }

  .event-row {
    display: grid;
    grid-template-columns: 70px 1fr minmax(60px, auto) minmax(60px, auto) 70px;
    gap: 8px;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid var(--divider-color);
    transition: background-color 0.2s;
  }

  .event-row.no-actions {
    grid-template-columns: 70px 1fr minmax(60px, auto) minmax(60px, auto);
  }

  .event-row:last-child {
    border-bottom: none;
  }

  .event-row.inactive {
    opacity: 0.5;
  }

  .event-row:hover {
    background-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.05);
  }

  .col-time {
    font-weight: 500;
    font-family: monospace;
    color: var(--primary-text-color);
  }

  .col-weekdays {
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

  .col-actions {
    display: flex;
    gap: 0;
    justify-content: flex-end;
  }

  ha-icon-button {
    --mdc-icon-button-size: 36px;
    color: var(--secondary-text-color);
  }

  /* Mobile Optimization */
  @media (max-width: 768px) {
    .events-header {
      grid-template-columns: 55px 1fr minmax(50px, auto) minmax(50px, auto) 60px;
      gap: 6px;
      padding: 8px 12px;
      font-size: 11px;
    }

    .event-row {
      grid-template-columns: 55px 1fr minmax(50px, auto) minmax(50px, auto) 60px;
      gap: 6px;
      padding: 10px 12px;
    }

    .weekday-badge {
      min-width: 22px;
      padding: 2px 3px;
      font-size: 10px;
    }
  }

  @media (max-width: 480px) {
    .events-header {
      grid-template-columns: 50px 1fr 50px;
      gap: 6px;
      padding: 6px 8px;
      font-size: 10px;
    }

    .events-header .col-duration,
    .events-header .col-state {
      display: none;
    }

    .event-row {
      grid-template-columns: 50px 1fr 50px;
      gap: 6px;
      padding: 8px;
    }

    .event-row .col-duration,
    .event-row .col-state {
      display: none;
    }

    .col-time {
      font-size: 12px;
    }

    .weekday-badge {
      min-width: 20px;
      padding: 1px 2px;
      font-size: 9px;
    }
  }

  /* Touch device optimizations */
  @media (hover: none) and (pointer: coarse) {
    .event-row:hover {
      background-color: transparent;
    }

    .event-row:active {
      background-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.1);
    }
  }
`;
