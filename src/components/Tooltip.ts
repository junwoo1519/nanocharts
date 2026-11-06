import { DataItem, TooltipEntry, TooltipOptions } from '../types';

export class Tooltip {
  private element: HTMLElement;
  private container: HTMLElement;
  private options?: TooltipOptions;

  constructor(container: HTMLElement, options?: TooltipOptions) {
    this.container = container;
    this.options = options;

    this.element = document.createElement('div');
    this.element.className = options?.className || 'canvas-chart-tooltip';
    this.applyDefaultStyles();
    this.container.appendChild(this.element);
  }

  private applyDefaultStyles(): void {
    const el = this.element;
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9999';
    el.style.padding = '8px 12px';
    el.style.backgroundColor = 'rgba(15, 23, 42, 0.92)';
    el.style.backdropFilter = 'blur(8px)';
    el.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    el.style.color = '#FFFFFF';
    el.style.borderRadius = '8px';
    el.style.fontSize = '12px';
    el.style.lineHeight = '1.4';
    el.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    el.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.25), 0 4px 6px -4px rgba(0, 0, 0, 0.15)';
    el.style.transition = 'opacity 0.1s ease-out, transform 0.05s ease-out';
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -100%)';
    el.style.whiteSpace = 'nowrap';
  }

  show(x: number, y: number, item: DataItem, index: number): void {
    if (this.options?.enabled === false) return;

    if (this.options?.formatter) {
      this.element.innerHTML = this.options.formatter(item, index);
    } else {
      this.element.innerHTML = `
        <div style="font-weight: 600; color: #94A3B8; margin-bottom: 2px;">${item.label}</div>
        <div style="font-size: 14px; font-weight: 700; color: #F8FAFC;">
          ${typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
        </div>
      `;
    }

    this.positionTooltip(x, y);
  }

  /**
   * 다중 시리즈(Multi-Series / Stacked) 통합 툴팁 표시
   */
  showMulti(
    x: number,
    y: number,
    title: string,
    entries: TooltipEntry[],
    index: number,
    footerLabel?: string,
    footerValue?: string
  ): void {
    if (this.options?.enabled === false || entries.length === 0) return;

    if (this.options?.multiFormatter) {
      this.element.innerHTML = this.options.multiFormatter(title, entries, index);
    } else {
      const rowsHtml = entries
        .map((entry) => {
          const isBold = entry.highlighted ? '700' : '500';
          const nameColor = entry.highlighted ? '#F8FAFC' : '#CBD5E1';
          const pctStr =
            entry.percentage !== undefined ? ` <span style="color:#94A3B8;font-size:11px;">(${entry.percentage.toFixed(1)}%)</span>` : '';
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:3px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${entry.color};box-shadow:${entry.highlighted ? `0 0 6px ${entry.color}` : 'none'};"></span>
                <span style="color:${nameColor};font-weight:${isBold};">${entry.seriesName}</span>
              </div>
              <div style="font-weight:700;color:#F8FAFC;">
                ${entry.value.toLocaleString()}${pctStr}
              </div>
            </div>
          `;
        })
        .join('');

      const footerHtml =
        footerLabel && footerValue
          ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:6px;padding-top:5px;border-top:1px solid rgba(148,163,184,0.2);font-size:11px;">
               <span style="color:#94A3B8;font-weight:600;">${footerLabel}</span>
               <span style="color:#38BDF8;font-weight:700;">${footerValue}</span>
             </div>`
          : '';

      this.element.innerHTML = `
        <div style="font-weight: 600; color: #94A3B8; margin-bottom: 4px; font-size: 11px;">${title}</div>
        ${rowsHtml}
        ${footerHtml}
      `;
    }

    this.positionTooltip(x, y);
  }

  private positionTooltip(x: number, y: number): void {
    const offsetY = -12;
    const clampedY = Math.max(40, y);
    this.element.style.left = `${x}px`;
    this.element.style.top = `${clampedY + offsetY}px`;
    this.element.style.opacity = '1';
  }

  hide(): void {
    this.element.style.opacity = '0';
  }

  destroy(): void {
    this.element.remove();
  }
}
