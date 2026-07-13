import { LitElement, html, css, nothing } from "lit";
import { property } from "lit/decorators.js";
import { safeCustomElement } from "../safe-element";

export interface BreadcrumbItem {
  label: string;
  view?: string;
  detail?: Record<string, string>;
}

@safeCustomElement("hm-breadcrumb")
export class HmBreadcrumb extends LitElement {
  @property({ attribute: false }) public items: BreadcrumbItem[] = [];

  private _handleClick(item: BreadcrumbItem): void {
    if (!item.view) return;
    this.dispatchEvent(
      new CustomEvent("breadcrumb-navigate", {
        detail: { view: item.view, ...item.detail },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    if (this.items.length <= 1) return nothing;

    return html`
      <nav class="breadcrumb" aria-label="Navigation">
        ${this.items.map((item, index) => {
          const isLast = index === this.items.length - 1;
          return html`
            ${index > 0 ? html`<span class="separator" aria-hidden="true">›</span>` : nothing}
            ${isLast
              ? html`<span class="current" aria-current="page">${item.label}</span>`
              : html`<a
                  class="link"
                  href="#"
                  @click=${(e: Event) => {
                    e.preventDefault();
                    this._handleClick(item);
                  }}
                  >${item.label}</a
                >`}
          `;
        })}
      </nav>
    `;
  }

  static styles = css`
    .breadcrumb {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      font-size: 13px;
      padding: 4px 0 8px;
      color: var(--secondary-text-color);
    }

    .link {
      color: var(--primary-color, #03a9f4);
      text-decoration: none;
      cursor: pointer;
    }

    .link:hover {
      text-decoration: underline;
    }

    .link:focus-visible {
      outline: 2px solid var(--primary-color, #03a9f4);
      outline-offset: 2px;
      border-radius: 2px;
    }

    .separator {
      color: var(--secondary-text-color);
      user-select: none;
    }

    .current {
      color: var(--primary-text-color);
      font-weight: 500;
    }

    @media (max-width: 600px) {
      .breadcrumb {
        font-size: 12px;
      }
    }
  `;
}
